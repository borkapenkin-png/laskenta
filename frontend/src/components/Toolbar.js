import React, { useState, useEffect, useRef } from 'react';
import { 
  FileUp, 
  Ruler, 
  Save, 
  FolderOpen, 
  FileDown,
  FileText,
  Layers,
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
  ZoomOut,
  Calculator,
  MoreHorizontal,
  ChevronDown,
  Settings,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Toolbar = ({ 
  onOpenPdf, 
  onCalibrate,
  onSaveProject,
  onLoadProject,
  onExportPDF,
  onCreateTarjous,
  onCreateKoontitarjous,
  onCreateKoontiMaaralaskenta,
  onOpenMaksuerataulukko,
  onOpenWorkSchedule,
  onOpenSettings,
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
  const [isCompact, setIsCompact] = useState(false);
  const [isVeryCompact, setIsVeryCompact] = useState(false);
  const toolbarRef = useRef(null);

  // Breakpoint-based responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsCompact(width < 1200);
      setIsVeryCompact(width < 950);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const tools = [
    { id: null, icon: Hand, label: 'Käsityökalu (liiku PDF:ssä)', testId: 'tool-hand' },
    { id: 'line', icon: Minus, label: 'Viiva (jm)', testId: 'tool-line' },
    { id: 'wall', icon: Home, label: 'Seinä (jm → m²)', testId: 'tool-wall' },
    { id: 'rectangle', icon: Square, label: 'Suorakulmio (m²)', testId: 'tool-rectangle' },
    { id: 'polygon', icon: Pentagon, label: 'Monikulmio (m²)', testId: 'tool-polygon' },
    { id: 'count', icon: Hash, label: 'Kappalemäärä (kpl)', testId: 'tool-count' },
  ];

  const currentScaleDisplay = scale ? 
    (scale.ratio || `1:${scale.scaleValue || '?'}`) : 
    'Ei asetettu';

  // Secondary actions for overflow menu
  const secondaryActions = [
    { 
      label: 'Töögraafik', 
      icon: Calendar, 
      onClick: onOpenWorkSchedule,
      testId: 'menu-work-schedule'
    },
    { 
      label: 'Koontitarjous', 
      icon: Layers, 
      onClick: onCreateKoontitarjous,
      testId: 'menu-koontitarjous'
    },
    { 
      label: 'Koonti määrälaskenta', 
      icon: Layers, 
      onClick: onCreateKoontiMaaralaskenta,
      testId: 'menu-koonti-maaralaskenta'
    },
    { 
      label: 'Maksuerätaulukko', 
      icon: Calculator, 
      onClick: onOpenMaksuerataulukko,
      testId: 'menu-maksuerataulukko'
    },
    { 
      label: 'Vie PDF', 
      icon: FileDown, 
      onClick: onExportPDF,
      testId: 'menu-export-pdf'
    },
    { 
      label: 'Asetukset', 
      icon: Settings, 
      onClick: onOpenSettings,
      testId: 'menu-settings'
    }
  ];

  return (
    <div 
      ref={toolbarRef}
      className="bg-white border-b border-gray-200 px-3 py-2"
      data-testid="main-toolbar"
    >
      <div className="flex items-center gap-2 min-w-0">
        
        {/* ===== LEFT GROUP: File operations ===== */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="open-pdf-button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenPdf}
                  className="whitespace-nowrap"
                >
                  <FileUp className="h-4 w-4" />
                  {!isVeryCompact && <span className="ml-1.5">Avaa PDF</span>}
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
                  className="whitespace-nowrap"
                >
                  <Save className="h-4 w-4" />
                  {!isVeryCompact && <span className="ml-1.5">Tallenna</span>}
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
                  className="whitespace-nowrap"
                >
                  <FolderOpen className="h-4 w-4" />
                  {!isVeryCompact && <span className="ml-1.5">Lataa</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Lataa projekti</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="h-5 w-px bg-gray-300 flex-shrink-0"></div>

        {/* ===== MIDDLE GROUP: Tools (scrollable if needed) ===== */}
        <div 
          className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Drawing tools */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <TooltipProvider delayDuration={300}>
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
                        className={`px-2 ${isActive ? 'bg-[#0052CC] text-white' : ''}`}
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

          <div className="h-5 w-px bg-gray-300 flex-shrink-0 mx-1"></div>

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-testid="zoom-out-button"
                    variant="ghost"
                    size="sm"
                    onClick={onZoomOut}
                    disabled={zoom <= 0.5}
                    className="px-2"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Loitonna</TooltipContent>
              </Tooltip>

              <span className="text-xs text-gray-600 font-mono w-10 text-center flex-shrink-0">
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
                    className="px-2"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Lähennä</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="h-5 w-px bg-gray-300 flex-shrink-0 mx-1"></div>

          {/* Scale button */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="scale-button"
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs whitespace-nowrap px-2"
                  onClick={onCalibrate}
                >
                  <Ruler className="h-4 w-4" />
                  {!isVeryCompact && <span className="ml-1">{currentScaleDisplay}</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mittakaava - klikkaa kalibroidaksesi</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="h-5 w-px bg-gray-300 flex-shrink-0 mx-1"></div>

          {/* Undo/Redo/Delete */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-testid="undo-button"
                    variant="ghost"
                    size="sm"
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="px-2"
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
                    className="px-2"
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
                    className="px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Poista valittu (Delete)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* ===== RIGHT GROUP: Primary actions (flex-shrink-0) ===== */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <TooltipProvider delayDuration={300}>
            {/* Primary button: Tee tarjous - ALWAYS visible */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="create-tarjous-button"
                  size="sm"
                  onClick={onCreateTarjous}
                  className="bg-[#4A9BAD] hover:bg-[#3d8699] text-white whitespace-nowrap"
                >
                  <FileText className="h-4 w-4" />
                  {!isVeryCompact && <span className="ml-1.5">Tee tarjous</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Luo ammattimainen tarjous PDF</TooltipContent>
            </Tooltip>

            {/* When NOT compact: show all buttons */}
            {!isCompact && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      data-testid="create-koontitarjous-button"
                      size="sm"
                      variant="outline"
                      onClick={onCreateKoontitarjous}
                      className="border-[#4A9BAD] text-[#4A9BAD] hover:bg-[#4A9BAD]/10 whitespace-nowrap"
                    >
                      <Layers className="h-4 w-4 mr-1.5" />
                      Koontitarjous
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Yhdistä useita tarjouksia</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      data-testid="create-koonti-maaralaskenta-button"
                      size="sm"
                      variant="outline"
                      onClick={onCreateKoontiMaaralaskenta}
                      className="border-[#4A9BAD] text-[#4A9BAD] hover:bg-[#4A9BAD]/10 whitespace-nowrap"
                    >
                      <Layers className="h-4 w-4 mr-1.5" />
                      Koonti määrät
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Yhdistä useita projekteja määrälaskennaksi</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      data-testid="maksuerataulukko-button"
                      size="sm"
                      variant="outline"
                      onClick={onOpenMaksuerataulukko}
                      className="border-[#4A9BAD] text-[#4A9BAD] hover:bg-[#4A9BAD]/10 whitespace-nowrap"
                    >
                      <Calculator className="h-4 w-4 mr-1.5" />
                      Maksuerät
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Maksuerätaulukko</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      data-testid="export-pdf-button"
                      variant="outline"
                      size="sm"
                      onClick={onExportPDF}
                      className="whitespace-nowrap"
                    >
                      <FileDown className="h-4 w-4 mr-1.5" />
                      PDF
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vie PDF-tiedosto</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      data-testid="settings-button"
                      variant="outline"
                      size="sm"
                      onClick={onOpenSettings}
                      className="whitespace-nowrap"
                    >
                      <Settings className="h-4 w-4 mr-1.5" />
                      Asetukset
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Avaa asetukset</TooltipContent>
                </Tooltip>
              </>
            )}

            {/* When compact: show overflow menu */}
            {isCompact && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        data-testid="toolbar-overflow-menu"
                        variant="outline"
                        size="sm"
                        className="border-[#4A9BAD] text-[#4A9BAD] hover:bg-[#4A9BAD]/10"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        {!isVeryCompact && (
                          <>
                            <span className="ml-1">Lisää</span>
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Lisää toimintoja</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-48">
                  {secondaryActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <DropdownMenuItem
                        key={action.testId}
                        onClick={action.onClick}
                        data-testid={action.testId}
                        className="cursor-pointer"
                      >
                        <Icon className="h-4 w-4 mr-2 text-[#4A9BAD]" />
                        {action.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};
