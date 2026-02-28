import React from 'react';
import { 
  FileUp, 
  Ruler, 
  Settings, 
  Save, 
  FolderOpen, 
  FileDown,
  Minus,
  Square,
  Pentagon,
  Hash,
  Home,
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
  currentTool,
  onToolSelect,
  toolbarSize = 1,
  onToolbarSizeChange
}) => {
  const tools = [
    { id: 'line', icon: Minus, label: 'Viiva (jm)', testId: 'tool-line' },
    { id: 'wall', icon: Home, label: 'Seinä (jm → m²)', testId: 'tool-wall' },
    { id: 'rectangle', icon: Square, label: 'Suorakulmio (m²)', testId: 'tool-rectangle' },
    { id: 'polygon', icon: Pentagon, label: 'Monikulmio (m²)', testId: 'tool-polygon' },
    { id: 'count', icon: Hash, label: 'Kappalemäärä (kpl)', testId: 'tool-count' }
  ];

  const handleZoomIn = () => {
    const newSize = Math.min(toolbarSize + 0.1, 1.5);
    onToolbarSizeChange(newSize);
  };

  const handleZoomOut = () => {
    const newSize = Math.max(toolbarSize - 0.1, 0.7);
    onToolbarSizeChange(newSize);
  };

  return (
    <div 
      className="bg-white border-b border-gray-200 px-4 py-3 transition-all duration-200"
      style={{ 
        transform: `scale(${toolbarSize})`,
        transformOrigin: 'top center',
        marginBottom: `${(toolbarSize - 1) * -30}px`
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TooltipProvider>
            {tools.map(tool => {
              const Icon = tool.icon;
              const isActive = currentTool === tool.id;
              return (
                <Tooltip key={tool.id}>
                  <TooltipTrigger asChild>
                    <Button
                      data-testid={tool.testId}
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => onToolSelect(tool.id)}
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
          
          <div className="mx-2 h-6 w-px bg-gray-300"></div>
          
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
                  data-testid="calibrate-button"
                  variant="outline"
                  size="sm"
                  onClick={onCalibrate}
                >
                  <Ruler className="h-4 w-4 mr-2" />
                  Kalibroi
                </Button>
              </TooltipTrigger>
              <TooltipContent>Kalibroi mittakaava</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="toolbar-zoom-out"
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={toolbarSize <= 0.7}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pienennä työkalupalkki</TooltipContent>
            </Tooltip>

            <span className="text-xs text-gray-500 font-mono w-12 text-center">
              {Math.round(toolbarSize * 100)}%
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="toolbar-zoom-in"
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={toolbarSize >= 1.5}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Suurenna työkalupalkki</TooltipContent>
            </Tooltip>

            <div className="mx-2 h-6 w-px bg-gray-300"></div>

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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="export-csv-button"
                  variant="outline"
                  size="sm"
                  onClick={onExportCSV}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent>Vie CSV</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="export-pdf-button"
                  variant="outline"
                  size="sm"
                  onClick={onExportPDF}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </TooltipTrigger>
              <TooltipContent>Luo PDF-raportti</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};