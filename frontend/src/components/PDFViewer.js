import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { MeasurementOverlay } from '@/components/MeasurementOverlay';

// Set worker source - use unpkg CDN for better compatibility with custom domains
// unpkg serves all npm versions directly
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs`;

export const PDFViewer = ({ 
  pdfFile, 
  currentPage, 
  onPageChange, 
  scale, 
  onScaleChange,
  onPdfLoad,
  currentTool,
  onMeasurementComplete,
  measurements = [],
  selectedMeasurementId,
  onMeasurementSelect,
  zoom = 1,
  onZoomChange,
  calibrationMode = false,
  calibrationDistance,
  onCalibrationComplete,
  onRenderInfoChange
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const overlayContainerRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [canvasSize, setCanvasSize] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!pdfFile) {
      setPdfDocument(null);
      setNumPages(0);
      return;
    }

    let cancelled = false;

    const loadPdf = async () => {
      try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        if (cancelled) return;
        
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;
        
        setPdfDocument(pdf);
        setNumPages(pdf.numPages);
        if (onPdfLoad) {
          onPdfLoad(pdf);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading PDF:', error);
        }
      }
    };

    loadPdf();
    
    return () => {
      cancelled = true;
    };
  }, [pdfFile, onPdfLoad]);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;

    let cancelled = false;
    let renderTask = null;

    const renderPage = async () => {
      setRendering(true);
      try {
        const page = await pdfDocument.getPage(currentPage);
        if (cancelled) return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        
        // Use zoom for viewport scaling (NOT CSS transform)
        const viewport = page.getViewport({ scale: zoom });
        
        // Critical: Set canvas dimensions properly
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Calculate actual DPI and store for scale calculations
        // PDF points are 72 per inch by default
        // viewport.scale tells us pixels per point
        const baseViewport = page.getViewport({ scale: 1 });
        const actualDPI = (viewport.width / baseViewport.width) * 72;
        
        // Update canvas size for overlay with DPI info
        setCanvasSize({
          width: viewport.width,
          height: viewport.height,
          actualDPI: actualDPI,
          zoom: zoom
        });

        // Notify parent about render info for scale calculations
        if (onRenderInfoChange) {
          onRenderInfoChange({
            actualDPI: actualDPI,
            zoom: zoom,
            width: viewport.width,
            height: viewport.height
          });
        }

        if (cancelled) return;

        renderTask = page.render({
          canvasContext: context,
          viewport: viewport
        });
        
        await renderTask.promise;
        
      } catch (error) {
        if (!cancelled) {
          console.error('Error rendering page:', error);
        }
      } finally {
        if (!cancelled) {
          setRendering(false);
        }
      }
    };

    renderPage();
    
    return () => {
      cancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDocument, currentPage, zoom, onRenderInfoChange]);

  const handleMouseDown = (e) => {
    // Pan with: middle mouse, right mouse, OR left mouse when no tool is selected
    const canPan = e.button === 1 || e.button === 2 || (e.button === 0 && !currentTool);
    if (canPan) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Handle wheel zoom
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      if (onZoomChange) {
        onZoomChange(prev => Math.max(0.5, Math.min(3, prev + delta)));
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#E5E5E5]">
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: isPanning ? 'grabbing' : (currentTool ? 'crosshair' : 'grab') }}
      >
        <div className="flex items-center justify-center min-h-full p-4">
          {!pdfFile ? (
            <div className="text-gray-500 text-sm">Avaa PDF-tiedosto aloittaaksesi</div>
          ) : (
            <div
              ref={overlayContainerRef}
              className="relative"
              style={{
                width: canvasSize ? `${canvasSize.width}px` : 'auto',
                height: canvasSize ? `${canvasSize.height}px` : 'auto',
                transform: `translate(${pan.x}px, ${pan.y}px)`
              }}
            >
              {/* PDF Canvas - z-index: 1 */}
              <canvas 
                ref={canvasRef} 
                className="shadow-lg bg-white"
                style={{
                  display: 'block',
                  position: 'relative',
                  zIndex: 1
                }}
              />

              {/* Measurement Overlay - z-index: 10, pointer-events: auto */}
              {canvasSize && (
                <MeasurementOverlay
                  canvasSize={canvasSize}
                  currentTool={currentTool}
                  scale={scale}
                  onMeasurementComplete={onMeasurementComplete}
                  measurements={measurements}
                  selectedMeasurementId={selectedMeasurementId}
                  onMeasurementSelect={onMeasurementSelect}
                  calibrationMode={calibrationMode}
                  onCalibrationComplete={onCalibrationComplete}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};