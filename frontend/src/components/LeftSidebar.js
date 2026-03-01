import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Plus, Trash2, Building2, Edit2, Check } from 'lucide-react';

export const LeftSidebar = ({ 
  pdfDocument, 
  currentPage, 
  onPageChange, 
  isOpen, 
  onToggle, 
  projectName, 
  onProjectNameChange,
  floors = [],
  activeFloorId,
  onFloorSelect,
  onFloorAdd,
  onFloorUpdate,
  onFloorDelete
}) => {
  const containerRef = useRef(null);
  const [thumbnails, setThumbnails] = useState([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [editingFloorId, setEditingFloorId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);

  // Debounced floor selection to prevent rapid switching
  const handleFloorClick = (floorId) => {
    if (isNavigating || floorId === activeFloorId) return;
    setIsNavigating(true);
    onFloorSelect(floorId);
    // Reset after a short delay
    setTimeout(() => setIsNavigating(false), 300);
  };

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
      const thumbnailWidth = Math.max(containerWidth - 32, 80);

      for (let pageNum = 1; pageNum <= Math.min(pdfDocument.numPages, 50); pageNum++) {
        try {
          const page = await pdfDocument.getPage(pageNum);
          const viewport = page.getViewport({ scale: thumbnailWidth / page.getViewport({ scale: 1 }).width });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

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

  const handleStartEditing = (floor) => {
    setEditingFloorId(floor.id);
    setEditingName(floor.name);
  };

  const handleSaveFloorName = () => {
    if (editingFloorId && editingName.trim()) {
      onFloorUpdate(editingFloorId, { name: editingName.trim() });
    }
    setEditingFloorId(null);
    setEditingName('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveFloorName();
    } else if (e.key === 'Escape') {
      setEditingFloorId(null);
      setEditingName('');
    }
  };

  return (
    <>
      {/* Sidebar container */}
      <div
        ref={containerRef}
        className="relative bg-gray-100 border-r border-gray-300 transition-all duration-300 overflow-y-auto"
        style={{
          width: isOpen ? '220px' : '0px',
          minWidth: isOpen ? '220px' : '0px',
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden'
        }}
      >
        <div className="p-3 space-y-3">
          {/* Project name input */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Projekti nimi</label>
            <Input
              value={projectName || ''}
              onChange={(e) => onProjectNameChange && onProjectNameChange(e.target.value)}
              placeholder="Anna projektille nimi..."
              className="h-8 text-sm"
              data-testid="project-name-input"
            />
          </div>

          {/* Floors section */}
          <div className="border-t border-gray-300 pt-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                Kerrokset
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={onFloorAdd}
                className="h-6 w-6 p-0"
                data-testid="add-floor-button"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Floor navigation arrows */}
            {floors.length > 1 && (
              <div className="flex items-center justify-between mb-2 bg-gray-200 rounded-lg p-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const currentIndex = floors.findIndex(f => f.id === activeFloorId);
                    if (currentIndex > 0) {
                      onFloorSelect(floors[currentIndex - 1].id);
                    }
                  }}
                  disabled={floors.findIndex(f => f.id === activeFloorId) === 0}
                  className="h-7 px-2"
                  data-testid="prev-floor-button"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="text-xs">Edellinen</span>
                </Button>
                <span className="text-xs text-gray-600 font-medium">
                  {floors.findIndex(f => f.id === activeFloorId) + 1} / {floors.length}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const currentIndex = floors.findIndex(f => f.id === activeFloorId);
                    if (currentIndex < floors.length - 1) {
                      onFloorSelect(floors[currentIndex + 1].id);
                    }
                  }}
                  disabled={floors.findIndex(f => f.id === activeFloorId) === floors.length - 1}
                  className="h-7 px-2"
                  data-testid="next-floor-button"
                >
                  <span className="text-xs">Seuraava</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="space-y-1">
              {floors.map((floor) => (
                <div
                  key={floor.id}
                  className={`flex items-center gap-1 p-2 rounded-lg cursor-pointer transition-colors ${
                    activeFloorId === floor.id
                      ? 'bg-[#0052CC] text-white'
                      : floor.pdfDataUrl 
                        ? 'bg-white hover:bg-gray-200 text-gray-700'
                        : 'bg-gray-50 hover:bg-gray-200 text-gray-500 border border-dashed border-gray-300'
                  }`}
                  onClick={() => !editingFloorId && onFloorSelect(floor.id)}
                  data-testid={`floor-${floor.id}`}
                >
                  {editingFloorId === floor.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-6 text-xs flex-1 text-black"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveFloorName();
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* PDF indicator */}
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        floor.pdfDataUrl 
                          ? 'bg-green-500' 
                          : activeFloorId === floor.id 
                            ? 'bg-gray-300' 
                            : 'bg-gray-300'
                      }`} title={floor.pdfDataUrl ? 'PDF ladattu' : 'Ei PDF:ää'} />
                      <span className="text-xs flex-1 truncate">{floor.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditing(floor);
                        }}
                        className={`h-5 w-5 p-0 ${activeFloorId === floor.id ? 'text-white hover:bg-[#0043A8]' : 'text-gray-500 hover:bg-gray-300'}`}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      {floors.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFloorDelete(floor.id);
                          }}
                          className={`h-5 w-5 p-0 ${activeFloorId === floor.id ? 'text-white hover:bg-red-500' : 'text-gray-500 hover:bg-red-100 hover:text-red-600'}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Page thumbnails */}
          <div className="border-t border-gray-300 pt-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Sivut</h3>
            <div className="space-y-2">
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
        </div>
      </div>

      {/* Toggle button */}
      <Button
        data-testid="toggle-left-sidebar"
        onClick={onToggle}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-30 h-20 w-6 rounded-r-lg rounded-l-none bg-gray-700 hover:bg-gray-800 p-0 shadow-lg"
        style={{
          left: isOpen ? '220px' : '0px',
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
