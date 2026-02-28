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
  Redo
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
  selectedMeasurementId,
  onDeleteSelected,
  onDeleteCurrentPage,
  onDeleteAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}) => {
  const tools = [
    { id: 'line', icon: Minus, label: 'Viiva (jm)', testId: 'tool-line' },
    { id: 'wall', icon: Home, label: 'Seinä (jm → m²)', testId: 'tool-wall' },
    { id: 'rectangle', icon: Square, label: 'Suorakulmio (m²)', testId: 'tool-rectangle' },
    { id: 'polygon', icon: Pentagon, label: 'Monikulmio (m²)', testId: 'tool-polygon' },
    { id: 'count', icon: Hash, label: 'Kappalemäärä (kpl)', testId: 'tool-count' }
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
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
          </TooltipProvider>

          <div className="mx-2 h-6 w-px bg-gray-300"></div>

          <TooltipProvider>
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

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="delete-page-button"
                  variant="outline"
                  size="sm"
                  onClick={onDeleteCurrentPage}
                  className="text-orange-600 hover:text-orange-700"
                >
                  Tyhjennä sivu
                </Button>
              </TooltipTrigger>
              <TooltipContent>Poista kaikki mittaukset tältä sivulta</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="delete-all-button"
                  variant="outline"
                  size="sm"
                  onClick={onDeleteAll}
                  className="text-red-600 hover:text-red-700"
                >
                  Tyhjennä projekti
                </Button>
              </TooltipTrigger>
              <TooltipContent>Poista KAIKKI mittaukset</TooltipContent>
            </Tooltip>

            <div className="mx-2 h-6 w-px bg-gray-300"></div>
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