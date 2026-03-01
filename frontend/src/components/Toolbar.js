import React from 'react';
import { 
  FileUp, 
  Ruler, 
  Save, 
  FolderOpen, 
  FileDown,
  Minus,
  Square,
  Pentagon,
  Hash,
  Home,
  Trash2,
  Undo,
  Redo,
  Hand,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const Toolbar = ({ 
  onOpenPdf, 
  onCalibrate,
  onSaveProject,
  onLoadProject,
  onExportCSV,
  onExportPDF,
  onExportPDFQuantitiesOnly,
  currentTool,
  onToolSelect,
  selectedMeasurementId,
  onDeleteSelected,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  scale,
  onScaleChange
}) => {
  const tools = [
    { id: null, icon: Hand, label: 'Käsityökalu (liiku PDF:ssä)', testId: 'tool-hand' },
    { id: 'line', icon: Minus, label: 'Viiva (jm) - 1x klõps alusta, 2x klõps lõpeta', testId: 'tool-line' },
    { id: 'wall', icon: Home, label: 'Seinä (jm → m²) - 1x klõps alusta, 2x klõps lõpeta', testId: 'tool-wall' },
    { id: 'rectangle', icon: Square, label: 'Suorakulmio (m²) - 2 klõpsu', testId: 'tool-rectangle' },
    { id: 'polygon', icon: Pentagon, label: 'Monikulmio (m²) - mitu klõpsu, 2x lõpeta', testId: 'tool-polygon' },
    { id: 'count', icon: Hash, label: 'Kappalemäärä (kpl) - 1 klõps', testId: 'tool-count' }
  ];

  const currentScaleDisplay = scale ? 
    (scale.ratio || `1:${scale.scaleValue || '?'}`) : 
    'Ei asetettu';

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center gap-4">
        {/* Left side - File operations */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="open-pdf-button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenPdf}
                >
                  <FileUp className="h-4 w-4 mr-2" />
                  Avaa PDF
                </Button>
              </TooltipTrigger>
              <TooltipContent>Avaa PDF-pohjakuva</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="save-project-button"
                  variant="outline"
                  size="sm"
                  onClick={onSaveProject}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Tallenna
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tallenna projekti</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="load-project-button"
                  variant="outline"
                  size="sm"
                  onClick={onLoadProject}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Lataa
                </Button>
              </TooltipTrigger>
              <TooltipContent>Lataa projekti</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="h-6 w-px bg-gray-300"></div>

        {/* Tools */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            {tools.map(tool => {
              const Icon = tool.icon;
              const isActive = currentTool === tool.id;
              return (
                <Tooltip key={tool.testId}>
                  <TooltipTrigger asChild>
                    <Button
                      data-testid={tool.testId}
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      onClick={(e) => onToolSelect(tool.id, e)}
                      className={isActive ? 'bg-[#0052CC] text-white' : ''}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{tool.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>

        <div className="h-6 w-px bg-gray-300"></div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="zoom-out-button"
                  variant="ghost"
                  size="sm"
                  onClick={onZoomOut}
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Loitonna</TooltipContent>
            </Tooltip>

            <span className="text-sm text-gray-600 font-mono w-14 text-center">
              {Math.round((zoom || 1) * 100)}%
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="zoom-in-button"
                  variant="ghost"
                  size="sm"
                  onClick={onZoomIn}
                  disabled={zoom >= 3}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Lähennä</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="h-6 w-px bg-gray-300"></div>

        {/* Scale display - clicking opens calibration dialog */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="scale-button"
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs"
                  onClick={onCalibrate}
                >
                  <Ruler className="h-4 w-4 mr-2" />
                  {currentScaleDisplay}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mittakaava - klikkaa kalibroidaksesi</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="h-6 w-px bg-gray-300"></div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="undo-button"
                  variant="ghost"
                  size="sm"
                  onClick={onUndo}
                  disabled={!canUndo}
                >
                  <Undo className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Peruuta (Ctrl+Z)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="redo-button"
                  variant="ghost"
                  size="sm"
                  onClick={onRedo}
                  disabled={!canRedo}
                >
                  <Redo className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tee uudelleen (Ctrl+Shift+Z)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="delete-selected-button"
                  variant="ghost"
                  size="sm"
                  onClick={onDeleteSelected}
                  disabled={!selectedMeasurementId}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Poista valittu (Delete)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Right side - spacer */}
        <div className="flex-1"></div>

        {/* Right side - Export */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="export-pdf-button"
                  variant="outline"
                  size="sm"
                  onClick={onExportPDF}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  PDF €
                </Button>
              </TooltipTrigger>
              <TooltipContent>PDF hinnoilla</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="export-pdf-quantities-button"
                  variant="outline"
                  size="sm"
                  onClick={onExportPDFQuantitiesOnly}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </TooltipTrigger>
              <TooltipContent>PDF vain määrillä (aliurakoitsijoille)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};
