import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Wand2, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// ==================== ROOM DETECTOR COMPONENT ====================
// This component handles AI-based room detection using SAM (Segment Anything Model)
// User clicks on a room, SAM detects the region, then user selects what to measure

export const RoomDetector = ({
  isActive,
  pdfCanvasRef,
  scale,
  zoom,
  currentPage,
  onRoomDetected,  // Callback when room is detected: (roomData) => void
  onCancel,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedMask, setDetectedMask] = useState(null);
  const [maskImageUrl, setMaskImageUrl] = useState(null);
  const [error, setError] = useState(null);
  const overlayRef = useRef(null);

  // Reset state when not active
  useEffect(() => {
    if (!isActive) {
      setDetectedMask(null);
      setMaskImageUrl(null);
      setError(null);
      setIsProcessing(false);
    }
  }, [isActive]);

  // Get canvas as base64 image
  const getCanvasAsBase64 = useCallback(() => {
    if (!pdfCanvasRef?.current) {
      console.log('No canvas ref available');
      return null;
    }
    
    const canvas = pdfCanvasRef.current;
    console.log('Canvas size:', canvas.width, 'x', canvas.height);
    // Convert canvas to base64 data URL
    return canvas.toDataURL('image/png');
  }, [pdfCanvasRef]);

  // Handle click on overlay to detect room at point
  const handleOverlayClick = useCallback(async (e) => {
    if (!isActive || isProcessing) return;
    
    const canvas = pdfCanvasRef?.current;
    if (!canvas) {
      toast.error('PDF canvas not found');
      return;
    }

    // Get click position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Normalize to 0-1 range
    const normalizedX = x / rect.width;
    const normalizedY = y / rect.height;
    
    console.log(`Click at screen (${x}, ${y}), normalized (${normalizedX.toFixed(3)}, ${normalizedY.toFixed(3)})`);
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Get canvas as image
      const imageData = getCanvasAsBase64();
      if (!imageData) {
        throw new Error('Could not capture PDF image');
      }
      
      console.log('Image data length:', imageData.length);
      toast.info('AI analysoi huonetta...', { duration: 2000 });
      
      // Call SAM API with point
      const response = await fetch(`${API_URL}/api/sam/segment-point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_data: imageData,
          point_x: normalizedX,
          point_y: normalizedY,
        }),
      });
      
      const result = await response.json();
      console.log('SAM API result:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Segmentation failed');
      }
      
      if (!result.masks || result.masks.length === 0) {
        toast.warning('Ei löytynyt huonetta tästä kohdasta. Klikkaa huoneen sisälle.');
        setIsProcessing(false);
        return;
      }
      
      // Get the first (best) mask
      const mask = result.masks[0];
      console.log('Detected mask:', mask);
      
      setDetectedMask(mask);
      if (mask.mask_url) {
        setMaskImageUrl(mask.mask_url);
      }
      
      // Calculate area from bbox if available
      let areaM2 = 0;
      if (mask.bbox && scale?.pixelsPerMeter) {
        const [bx, by, bw, bh] = mask.bbox;
        // bbox is normalized (0-1), convert to actual pixels then to meters
        const widthPx = bw * canvas.width;
        const heightPx = bh * canvas.height;
        const widthM = widthPx / scale.pixelsPerMeter / zoom;
        const heightM = heightPx / scale.pixelsPerMeter / zoom;
        areaM2 = widthM * heightM;
        console.log(`Area calc: ${widthPx}x${heightPx}px = ${widthM.toFixed(2)}x${heightM.toFixed(2)}m = ${areaM2.toFixed(2)}m²`);
      } else if (mask.area) {
        // area might be pixel count or normalized, try to calculate
        const pixelArea = mask.area;
        if (scale?.pixelsPerMeter) {
          areaM2 = pixelArea / (scale.pixelsPerMeter * scale.pixelsPerMeter) / (zoom * zoom);
        }
      }
      
      toast.success(`Huone tunnistettu! ~${areaM2.toFixed(1)} m²`);
      
      // Trigger callback with room data
      onRoomDetected({
        mask,
        maskImageUrl: mask.mask_url,
        bbox: mask.bbox,
        estimatedArea: areaM2,
        clickPoint: { x: normalizedX, y: normalizedY },
        page: currentPage,
      });
      
    } catch (err) {
      console.error('Room detection error:', err);
      setError(err.message);
      toast.error(`Virhe: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [isActive, isProcessing, pdfCanvasRef, getCanvasAsBase64, scale, zoom, currentPage, onRoomDetected]);

  // Don't render anything if not active
  if (!isActive) return null;

  // Get canvas position for proper overlay positioning
  const canvas = pdfCanvasRef?.current;
  const canvasRect = canvas?.getBoundingClientRect();

  return (
    <>
      {/* Clickable overlay that covers the PDF area */}
      <div 
        ref={overlayRef}
        onClick={handleOverlayClick}
        className="fixed z-[100]"
        style={{ 
          cursor: isProcessing ? 'wait' : 'crosshair',
          backgroundColor: 'rgba(74, 155, 173, 0.1)',
          top: canvasRect?.top || 0,
          left: canvasRect?.left || 0,
          width: canvasRect?.width || '100%',
          height: canvasRect?.height || '100%',
        }}
      />
      
      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-lg shadow-xl p-4 flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#4A9BAD]" />
            <span className="font-medium">AI tunnistaa huonetta...</span>
          </div>
        </div>
      )}
      
      {/* Instructions overlay */}
      {!isProcessing && !detectedMask && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="bg-[#4A9BAD] text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            <span>Klikkaa huoneen sisälle tunnistaaksesi sen</span>
          </div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:bg-red-600 rounded p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      
      {/* Detected mask overlay */}
      {maskImageUrl && (
        <div 
          className="absolute inset-0 pointer-events-none z-30"
          style={{
            backgroundImage: `url(${maskImageUrl})`,
            backgroundSize: 'cover',
            opacity: 0.4,
            mixBlendMode: 'multiply',
          }}
        />
      )}
    </>
  );
};

export default RoomDetector;
