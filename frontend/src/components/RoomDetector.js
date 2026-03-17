import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Wand2, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// ==================== FLOOD FILL ROOM DETECTOR ====================
// Detects enclosed rooms in floor plans using flood fill algorithm.
// Uses wall dilation to close door gaps before filling.

const WALL_THRESHOLD = 160; // Pixels darker than this are walls
const MAX_FILL_RATIO = 0.35; // If fill > 35% of image, it leaked out
const GAP_CLOSE_RADIUS = 8;  // Dilate walls by this many pixels to close door gaps

// Build a wall map with dilation to close small gaps (doorways)
function buildWallMap(imageData, width, height, radius) {
  const data = imageData.data;
  const wallMap = new Uint8Array(width * height);
  
  // Step 1: Mark original wall pixels
  const origWall = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      if (brightness < WALL_THRESHOLD) {
        origWall[y * width + x] = 1;
      }
    }
  }
  
  // Step 2: Horizontal dilation (expand walls left/right by radius)
  const wallH = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    // Use running count for O(width) per row
    let count = 0;
    // Initialize window for first pixel
    for (let dx = 0; dx <= radius && dx < width; dx++) {
      if (origWall[y * width + dx]) count++;
    }
    if (count > 0) wallH[y * width] = 1;
    
    for (let x = 1; x < width; x++) {
      // Add right edge of window
      const addX = x + radius;
      if (addX < width && origWall[y * width + addX]) count++;
      // Remove left edge of window
      const remX = x - radius - 1;
      if (remX >= 0 && origWall[y * width + remX]) count--;
      if (count > 0) wallH[y * width + x] = 1;
    }
  }
  
  // Step 3: Vertical dilation of horizontal result
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let dy = 0; dy <= radius && dy < height; dy++) {
      if (wallH[dy * width + x]) count++;
    }
    if (count > 0) wallMap[x] = 1;
    
    for (let y = 1; y < height; y++) {
      const addY = y + radius;
      if (addY < height && wallH[addY * width + x]) count++;
      const remY = y - radius - 1;
      if (remY >= 0 && wallH[remY * width + x]) count--;
      if (count > 0) wallMap[y * width + x] = 1;
    }
  }
  
  return wallMap;
}

// Flood fill using pre-computed wall map
function floodFillDetect(wallMap, width, height, startX, startY) {
  const visited = new Uint8Array(width * height);
  
  // Check if starting pixel is on a dilated wall
  if (wallMap[startY * width + startX]) {
    return null; // Clicked on a wall
  }
  
  const maxPixels = width * height * MAX_FILL_RATIO;
  const stack = [[startX, startY]];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  let pixelCount = 0;
  
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const idx = y * width + x;
    if (visited[idx]) continue;
    if (wallMap[idx]) continue;
    
    visited[idx] = 1;
    pixelCount++;
    
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    
    if (pixelCount > maxPixels) {
      return null; // Leaked out
    }
    
    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }
  
  if (pixelCount < 100) return null; // Too small
  
  return {
    pixelCount,
    bbox: { minX, minY, maxX, maxY },
    width: maxX - minX,
    height: maxY - minY,
    visited,
  };
}

// Draw the detected area on an overlay canvas
function drawDetectedArea(overlayCanvas, visited, canvasWidth, canvasHeight) {
  overlayCanvas.width = canvasWidth;
  overlayCanvas.height = canvasHeight;
  const ctx = overlayCanvas.getContext('2d');
  const imgData = ctx.createImageData(canvasWidth, canvasHeight);
  const d = imgData.data;
  
  for (let i = 0; i < canvasWidth * canvasHeight; i++) {
    if (visited[i]) {
      d[i * 4] = 74;      // R (teal)
      d[i * 4 + 1] = 155;  // G
      d[i * 4 + 2] = 173;  // B
      d[i * 4 + 3] = 80;   // A (semi-transparent)
    }
  }
  
  ctx.putImageData(imgData, 0, 0);
}

export const RoomDetector = ({
  isActive,
  pdfCanvasRef,
  scale,
  zoom,
  currentPage,
  onRoomDetected,
  presetSelectorOpen,
  onCancel,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [detected, setDetected] = useState(null);
  const [error, setError] = useState(null);
  const overlayRef = useRef(null);
  const highlightCanvasRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      setDetected(null);
      setError(null);
      setIsProcessing(false);
      // Clear highlight canvas
      if (highlightCanvasRef.current) {
        const ctx = highlightCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, highlightCanvasRef.current.width, highlightCanvasRef.current.height);
      }
    }
  }, [isActive]);

  const handleOverlayClick = useCallback((e) => {
    if (!isActive || isProcessing) return;
    
    const canvas = pdfCanvasRef?.current;
    if (!canvas) {
      toast.error('PDF canvas not found');
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    // Get click position in canvas pixel coordinates
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = Math.floor((e.clientX - rect.left) * scaleX);
    const canvasY = Math.floor((e.clientY - rect.top) * scaleY);
    
    console.log(`Click at canvas pixel (${canvasX}, ${canvasY}), canvas ${canvas.width}x${canvas.height}`);
    
    // Use setTimeout to not block the UI during heavy computation
    setTimeout(() => {
      try {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Build wall map with gap closing (closes door openings)
        console.time('wallMap');
        const wallMap = buildWallMap(imageData, canvas.width, canvas.height, GAP_CLOSE_RADIUS);
        console.timeEnd('wallMap');
        
        console.time('floodFill');
        const result = floodFillDetect(wallMap, canvas.width, canvas.height, canvasX, canvasY);
        console.timeEnd('floodFill');
        
        if (!result) {
          toast.warning('Ei löytynyt huonetta. Klikkaa tyhjän alueen keskelle (ei seinän tai tekstin päälle).');
          setIsProcessing(false);
          return;
        }
        
        // Draw the detected area
        if (highlightCanvasRef.current) {
          drawDetectedArea(highlightCanvasRef.current, result.visited, canvas.width, canvas.height);
        }
        
        // Calculate area in m²
        let areaM2 = 0;
        if (scale?.pixelsPerMeter) {
          const ppm = scale.pixelsPerMeter * zoom;
          areaM2 = result.pixelCount / (ppm * ppm);
        }
        
        console.log(`Detected room: ${result.pixelCount} pixels, bbox ${result.width}x${result.height}, area=${areaM2.toFixed(2)}m²`);
        
        setDetected(result);
        toast.success(`Huone tunnistettu! ~${areaM2.toFixed(1)} m²`);
        
        // Trigger callback with bbox corner points as normalized coords (zoom=1)
        const { minX, minY, maxX, maxY } = result.bbox;
        const normalizedPoints = [
          { x: minX / zoom, y: minY / zoom },
          { x: maxX / zoom, y: minY / zoom },
          { x: maxX / zoom, y: maxY / zoom },
          { x: minX / zoom, y: maxY / zoom },
        ];
        
        onRoomDetected({
          estimatedArea: areaM2,
          pixelCount: result.pixelCount,
          bbox: result.bbox,
          points: normalizedPoints,
          clickPoint: { x: canvasX / canvas.width, y: canvasY / canvas.height },
          page: currentPage,
        });
        
      } catch (err) {
        console.error('Room detection error:', err);
        setError(err.message);
        toast.error(`Virhe: ${err.message}`);
      } finally {
        setIsProcessing(false);
      }
    }, 10);
  }, [isActive, isProcessing, pdfCanvasRef, scale, zoom, currentPage, onRoomDetected]);

  if (!isActive) return null;

  const canvas = pdfCanvasRef?.current;
  const canvasRect = canvas?.getBoundingClientRect();

  // Don't show clickable overlay when preset selector is open (it would block clicks)
  const showOverlay = !presetSelectorOpen;

  return (
    <>
      {/* Clickable overlay */}
      {showOverlay && (
        <div 
          ref={overlayRef}
          data-testid="room-detector-overlay"
          onClick={handleOverlayClick}
          className="fixed z-[100]"
          style={{ 
            cursor: isProcessing ? 'wait' : 'crosshair',
            backgroundColor: 'rgba(74, 155, 173, 0.08)',
            top: canvasRect?.top || 0,
            left: canvasRect?.left || 0,
            width: canvasRect?.width || '100%',
            height: canvasRect?.height || '100%',
          }}
        />
      )}
      
      {/* Highlight canvas - shows detected area in teal */}
      <canvas
        ref={highlightCanvasRef}
        className="fixed pointer-events-none z-[99]"
        style={{
          top: canvasRect?.top || 0,
          left: canvasRect?.left || 0,
          width: canvasRect?.width || 0,
          height: canvasRect?.height || 0,
        }}
      />
      
      {/* Processing indicator */}
      {isProcessing && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-lg shadow-xl p-4 flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#4A9BAD]" />
            <span className="font-medium">Tunnistaa huonetta...</span>
          </div>
        </div>
      )}
      
      {/* Instructions */}
      {!isProcessing && !detected && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[102] pointer-events-none">
          <div className="bg-[#4A9BAD] text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            <span>Klikkaa huoneen sisälle tunnistaaksesi sen</span>
          </div>
        </div>
      )}
      
      {/* Error */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[102]">
          <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:bg-red-600 rounded p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default RoomDetector;
