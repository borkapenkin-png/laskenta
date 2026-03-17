import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Wand2, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// ==================== FLOOD FILL ROOM DETECTOR ====================
// Detects enclosed rooms in floor plans using flood fill algorithm.
// 1) Dilate walls to close door gaps → flood fill → find room
// 2) Expand result back to original walls → no gap between detection and wall

const WALL_THRESHOLD = 160; // Pixels darker than this are walls
const MAX_FILL_RATIO = 0.35; // If fill > 35% of image, it leaked out
const GAP_CLOSE_RADIUS = 10; // Dilate walls by this to close door gaps

// Build original wall map from pixel data
function buildOriginalWallMap(imageData, width, height) {
  const data = imageData.data;
  const wallMap = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      if (brightness < WALL_THRESHOLD) {
        wallMap[y * width + x] = 1;
      }
    }
  }
  return wallMap;
}

// Dilate a binary map using fast running-window (separable box filter)
function dilateBinaryMap(input, width, height, radius) {
  const output = new Uint8Array(width * height);
  const temp = new Uint8Array(width * height);
  
  // Horizontal pass
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let dx = 0; dx <= radius && dx < width; dx++) {
      if (input[y * width + dx]) count++;
    }
    if (count > 0) temp[y * width] = 1;
    for (let x = 1; x < width; x++) {
      const addX = x + radius;
      if (addX < width && input[y * width + addX]) count++;
      const remX = x - radius - 1;
      if (remX >= 0 && input[y * width + remX]) count--;
      if (count > 0) temp[y * width + x] = 1;
    }
  }
  
  // Vertical pass
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let dy = 0; dy <= radius && dy < height; dy++) {
      if (temp[dy * width + x]) count++;
    }
    if (count > 0) output[x] = 1;
    for (let y = 1; y < height; y++) {
      const addY = y + radius;
      if (addY < height && temp[addY * width + x]) count++;
      const remY = y - radius - 1;
      if (remY >= 0 && temp[remY * width + x]) count--;
      if (count > 0) output[y * width + x] = 1;
    }
  }
  return output;
}

// Flood fill on wall map, returns visited bitmap
function floodFill(wallMap, width, height, startX, startY) {
  const visited = new Uint8Array(width * height);
  if (wallMap[startY * width + startX]) return null;
  
  const maxPixels = width * height * MAX_FILL_RATIO;
  const stack = [[startX, startY]];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  let pixelCount = 0;
  
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const idx = y * width + x;
    if (visited[idx] || wallMap[idx]) continue;
    
    visited[idx] = 1;
    pixelCount++;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (pixelCount > maxPixels) return null; // Leaked
    
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  
  if (pixelCount < 100) return null;
  return { visited, pixelCount, bbox: { minX, minY, maxX, maxY } };
}

// Main detection: dilate walls → flood fill → expand back to original walls
function detectRoom(imageData, width, height, startX, startY) {
  // Step 1: Original wall map
  const origWall = buildOriginalWallMap(imageData, width, height);
  
  // Step 2: Dilated wall map (closes door gaps)
  const dilatedWall = dilateBinaryMap(origWall, width, height, GAP_CLOSE_RADIUS);
  
  // Step 3: Flood fill on dilated walls
  const fillResult = floodFill(dilatedWall, width, height, startX, startY);
  if (!fillResult) return null;
  
  // Step 4: Expand filled area back to original walls
  // Dilate the filled region by the same radius, then mask out original walls
  const expanded = dilateBinaryMap(fillResult.visited, width, height, GAP_CLOSE_RADIUS);
  
  // Remove original wall pixels from expanded area
  let pixelCount = 0;
  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (let i = 0; i < width * height; i++) {
    if (expanded[i] && !origWall[i]) {
      expanded[i] = 1;
      pixelCount++;
      const x = i % width, y = Math.floor(i / width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else {
      expanded[i] = 0;
    }
  }
  
  return {
    pixelCount,
    bbox: { minX, minY, maxX, maxY },
    width: maxX - minX,
    height: maxY - minY,
    visited: expanded,
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
        
        // Build wall maps and detect room (dilate → fill → expand back)
        console.time('detectRoom');
        const result = detectRoom(imageData, canvas.width, canvas.height, canvasX, canvasY);
        console.timeEnd('detectRoom');
        
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
