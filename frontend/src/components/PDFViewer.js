import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MeasurementOverlay } from '@/components/MeasurementOverlay';

// Set worker source to use local file
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.mjs`;

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
  onZoomChange
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
    if (!pdfFile) return;

    const loadPdf = async () => {
      try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPdfDocument(pdf);
        setNumPages(pdf.numPages);
        if (onPdfLoad) {
          onPdfLoad(pdf);
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    };

    loadPdf();
  }, [pdfFile, onPdfLoad]);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;

    const renderPage = async () => {
      setRendering(true);
      try {
        const page = await pdfDocument.getPage(currentPage);
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        // Use zoom for viewport scaling (NOT CSS transform)
        const viewport = page.getViewport({ scale: zoom });
        
        // Critical: Set canvas dimensions properly
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Update canvas size for overlay
        setCanvasSize({
          width: viewport.width,
          height: viewport.height
        });

        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        if (onScaleChange && !scale) {
          const baseScale = viewport.width / page.getViewport({ scale: 1 }).width;
          onScaleChange({ pixelsPerMeter: baseScale * 100, detected: false });
        }
      } catch (error) {
        console.error('Error rendering page:', error);
      } finally {
        setRendering(false);
      }
    };

    renderPage();
  }, [pdfDocument, currentPage, zoom, scale, onScaleChange]);

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
      <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Button
            data-testid="pdf-previous-page"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || !pdfDocument}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600 font-mono">
            {currentPage} / {numPages}
          </span>
          <Button
            data-testid="pdf-next-page"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
            disabled={currentPage === numPages || !pdfDocument}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            data-testid="pdf-zoom-out"
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600 font-mono w-16 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            data-testid="pdf-zoom-in"
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};