import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const LeftSidebar = ({ pdfDocument, currentPage, onPageChange, isOpen, onToggle, projectName, onProjectNameChange }) => {
  const containerRef = useRef(null);
  const [thumbnails, setThumbnails] = useState([]);
  const [containerWidth, setContainerWidth] = useState(0);

  // ResizeObserver to track sidebar width changes
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        setContainerWidth(width);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Render thumbnails when PDF loads or container width changes
  useEffect(() => {
    if (!pdfDocument || containerWidth === 0) return;

    const renderThumbnails = async () => {
      const thumbs = [];
      const thumbnailWidth = Math.max(containerWidth - 32, 80); // padding consideration

      for (let pageNum = 1; pageNum <= Math.min(pdfDocument.numPages, 50); pageNum++) {
        try {
          const page = await pdfDocument.getPage(pageNum);
          const viewport = page.getViewport({ scale: thumbnailWidth / page.getViewport({ scale: 1 }).width });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          // Critical: Set canvas dimensions BEFORE rendering
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;

          thumbs.push({
            pageNum,
            dataUrl: canvas.toDataURL(),
            width: viewport.width,
            height: viewport.height
          });
        } catch (error) {
          console.error(`Error rendering thumbnail for page ${pageNum}:`, error);
        }
      }

      setThumbnails(thumbs);
    };

    renderThumbnails();
  }, [pdfDocument, containerWidth]);

  return (
    <>
      {/* Sidebar container - uses transform instead of display:none */}
      <div
        ref={containerRef}
        className="relative bg-gray-100 border-r border-gray-300 transition-all duration-300 overflow-y-auto"
        style={{
          width: isOpen ? '200px' : '0px',
          minWidth: isOpen ? '200px' : '0px',
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden'
        }}
      >
        <div className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Sivut</h3>
          {thumbnails.map((thumb) => (
            <div
              key={thumb.pageNum}
              onClick={() => onPageChange(thumb.pageNum)}
              className={`cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                currentPage === thumb.pageNum
                  ? 'border-[#0052CC] shadow-lg'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              data-testid={`thumbnail-page-${thumb.pageNum}`}
            >
              <img
                src={thumb.dataUrl}
                alt={`Page ${thumb.pageNum}`}
                className="w-full h-auto"
                style={{ display: 'block' }}
              />
              <div className="bg-white p-1 text-center text-xs text-gray-600">
                {thumb.pageNum}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toggle button */}
      <Button
        data-testid="toggle-left-sidebar"
        onClick={onToggle}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-30 h-20 w-6 rounded-r-lg rounded-l-none bg-gray-700 hover:bg-gray-800 p-0 shadow-lg"
        style={{
          left: isOpen ? '200px' : '0px',
          transition: 'left 300ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {isOpen ? (
          <ChevronLeft className="h-4 w-4 text-white" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white" />
        )}
      </Button>
    </>
  );
};
