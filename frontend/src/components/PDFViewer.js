import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { MeasurementOverlay } from '@/components/MeasurementOverlay';

// Set worker source - use unpkg CDN for better compatibility with custom domains
// unpkg serves all npm versions directly
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

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
  onRenderInfoChange,
  externalCanvasRef,  // Optional external ref for canvas
}) => {
  const internalCanvasRef = useRef(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const containerRef = useRef(null);
  const overlayContainerRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [canvasSize, setCanvasSize] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [mobilePdfUrl, setMobilePdfUrl] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    if (!pdfFile) {
      setMobilePdfUrl(null);
      return undefined;
    }

    if (!isMobileViewport) {
      setMobilePdfUrl(null);
      return undefined;
    }

    const url = URL.createObjectURL(pdfFile);
    setMobilePdfUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [pdfFile, isMobileViewport]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      const nextWidth = containerRef.current?.clientWidth || 0;
      setContainerWidth(nextWidth);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(() => updateWidth());
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!pdfFile) {
      setPdfDocument(null);
      setNumPages(0);
      setLoadError(null);
      return;
    }

    let cancelled = false;

    const loadPdf = async () => {
      try {
        setLoadError(null);
        const arrayBuffer = await pdfFile.arrayBuffer();
        if (cancelled) return;

        let pdf;
        try {
          pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        } catch (workerError) {
          console.warn('PDF worker load failed, retrying without worker:', workerError);
          pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true }).promise;
        }

        if (cancelled) return;

        setPdfDocument(pdf);
        setNumPages(pdf.numPages);
        if (onPdfLoad) {
          onPdfLoad(pdf);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading PDF:', error);
          setLoadError('PDF-tiedoston avaaminen ep?onnistui t?ll? laitteella.');
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
        if (!context) throw new Error('Canvas context unavailable');

        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max((containerWidth || containerRef.current?.clientWidth || 0) - 16, 0);
        const mobileFitScale = isMobileViewport && availableWidth > 0
          ? Math.min(1, availableWidth / baseViewport.width)
          : 1;

        let renderScale = zoom * mobileFitScale;
        if (isMobileViewport) {
          const estimatedPixels = baseViewport.width * baseViewport.height * renderScale * renderScale;
          const maxMobilePixels = 1600000;
          if (estimatedPixels > maxMobilePixels) {
            renderScale *= Math.sqrt(maxMobilePixels / estimatedPixels);
          }
        }

        // Use zoom for viewport scaling (NOT CSS transform)
        const viewport = page.getViewport({ scale: renderScale });
        
        // Critical: Set canvas dimensions properly
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Calculate actual DPI and store for scale calculations
        // PDF points are 72 per inch by default
        // viewport.scale tells us pixels per point
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
          setLoadError('PDF-sivun render?inti ep?onnistui t?ll? laitteella.');
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
  }, [pdfDocument, currentPage, zoom, onRenderInfoChange, canvasRef, containerWidth, isMobileViewport]);

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
        onMouseDown={isMobileViewport ? undefined : handleMouseDown}
        onMouseMove={isMobileViewport ? undefined : handleMouseMove}
        onMouseUp={isMobileViewport ? undefined : handleMouseUp}
        onMouseLeave={isMobileViewport ? undefined : handleMouseUp}
        onWheel={isMobileViewport ? undefined : handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: isMobileViewport ? 'default' : (isPanning ? 'grabbing' : (currentTool ? 'crosshair' : 'grab')) }}
      >
        <div className="flex items-start sm:items-center justify-center min-h-full p-2 sm:p-4">
          {!pdfFile ? (
            <div className="text-gray-500 text-sm">Avaa PDF-tiedosto aloittaaksesi</div>
          ) : isMobileViewport && mobilePdfUrl ? (
            <div className="flex h-full min-h-[60vh] w-full flex-col gap-2">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Mobiilissa PDF n?ytet??n kevyess? katselutilassa. Desktopin mittaustila pysyy ennallaan.
              </div>
              <iframe
                title="PDF preview"
                src={mobilePdfUrl}
                className="h-[70vh] w-full rounded-lg border border-gray-200 bg-white"
              />
            </div>
          ) : loadError ? (
            <div className="max-w-sm rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
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