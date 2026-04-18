import React, { useState, useEffect } from 'react';
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
  ChevronDown,
  Settings,
  Calendar,
  MoreHorizontal,
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
  onOpenKoontiWorkSchedule,
  onOpenCustomWorkSchedule,
  onOpenOfferTerms,
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
}) => {
  const [isCompact, setIsCompact] = useState(false);
  const [isVeryCompact, setIsVeryCompact] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsCompact(width < 1200);
      setIsVeryCompact(width < 950);
      setIsMobile(width < 768);
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

  const renderToolButtons = () => (
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
                className={`h-9 min-w-9 px-2 ${isActive ? 'bg-[#0052CC] text-white' : ''}`}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{tool.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </TooltipProvider>
  );

  const renderActionsMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid="mobile-actions-menu"
          variant="outline"
          size="sm"
          className="h-10 w-full px-0"
        >
          <MoreHorizontal className="h-4 w-4" />
          {!isMobile && <span className="ml-1.5">Toiminnot</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onCreateTarjous} data-testid="menu-tarjous" className="cursor-pointer">
          <FileText className="h-4 w-4 mr-2 text-[#4A9BAD]" />
          Tee tarjous
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCreateKoontitarjous} data-testid="menu-koontitarjous" className="cursor-pointer">
          <Layers className="h-4 w-4 mr-2 text-[#4A9BAD]" />
          Koontitarjous
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportPDF} data-testid="menu-export-pdf" className="cursor-pointer">
          <FileDown className="h-4 w-4 mr-2 text-[#4A9BAD]" />
          Määrälaskenta PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCreateKoontiMaaralaskenta} data-testid="menu-koonti-maaralaskenta" className="cursor-pointer">
          <Layers className="h-4 w-4 mr-2 text-[#4A9BAD]" />
          Koonti määrälaskenta
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenMaksuerataulukko} data-testid="menu-maksuerataulukko" className="cursor-pointer">
          <Calculator className="h-4 w-4 mr-2 text-[#4A9BAD]" />
          Maksuerätaulukko
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenWorkSchedule} data-testid="menu-work-schedule" className="cursor-pointer">
          <Calendar className="h-4 w-4 mr-2 text-[#4A9BAD]" />
          Työaikataulu
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenKoontiWorkSchedule} data-testid="menu-koonti-work-schedule" className="cursor-pointer">
          <Layers className="h-4 w-4 mr-2 text-[#4A9BAD]" />
          Koonti työaikataulu
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenCustomWorkSchedule} data-testid="menu-custom-work-schedule" className="cursor-pointer">
          <Calendar className="h-4 w-4 mr-2 text-[#4A9BAD]" />
          Oma työaikataulu
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenOfferTerms} data-testid="menu-offer-terms" className="cursor-pointer">
          <Settings className="h-4 w-4 mr-2 text-gray-500" />
          Tarjouksen ehdot
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenSettings} data-testid="settings-button" className="cursor-pointer">
          <Settings className="h-4 w-4 mr-2 text-gray-500" />
          Asetukset
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isMobile) {
    return (
      <div className="bg-white border-b border-gray-200 px-2 py-2 space-y-2" data-testid="main-toolbar">
        <div className="grid grid-cols-4 gap-2">
          <Button data-testid="open-pdf-button" variant="outline" size="sm" onClick={onOpenPdf} className="h-10 w-full px-0">
            <FileUp className="h-4 w-4" />
          </Button>
          <Button data-testid="save-project-button" variant="outline" size="sm" onClick={onSaveProject} className="h-10 w-full px-0">
            <Save className="h-4 w-4" />
          </Button>
          <Button data-testid="load-project-button" variant="outline" size="sm" onClick={onLoadProject} className="h-10 w-full px-0">
            <FolderOpen className="h-4 w-4" />
          </Button>
          {renderActionsMenu()}
        </div>

        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center rounded-lg bg-gray-50 p-2">
          <Button data-testid="scale-button" variant="outline" size="sm" onClick={onCalibrate} className="h-10 w-full justify-start whitespace-nowrap px-3 text-xs font-mono overflow-hidden">
            <Ruler className="h-4 w-4 mr-1.5 shrink-0" />
            <span className="truncate">{currentScaleDisplay}</span>
          </Button>
          <Button data-testid="undo-button" variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo} className="h-10 w-10 px-0">
            <Undo className="h-4 w-4" />
          </Button>
          <Button data-testid="redo-button" variant="ghost" size="sm" onClick={onRedo} disabled={!canRedo} className="h-10 w-10 px-0">
            <Redo className="h-4 w-4" />
          </Button>
          <Button data-testid="delete-selected-button" variant="ghost" size="sm" onClick={onDeleteSelected} disabled={!selectedMeasurementId} className="h-10 w-10 px-0 text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-2">
          <Button data-testid="zoom-out-button" variant="ghost" size="sm" onClick={onZoomOut} disabled={zoom <= 0.5} className="h-10 w-10 px-0">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-12 text-center text-xs text-gray-600 font-mono">{Math.round((zoom || 1) * 100)}%</span>
          <Button data-testid="zoom-in-button" variant="ghost" size="sm" onClick={onZoomIn} disabled={zoom >= 3} className="h-10 w-10 px-0">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide rounded-lg bg-gray-50 p-1">
          {renderToolButtons()}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-gray-200 px-3 py-2" data-testid="main-toolbar">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1 flex-shrink-0">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button data-testid="open-pdf-button" variant="outline" size="sm" onClick={onOpenPdf} className="whitespace-nowrap">
                  <FileUp className="h-4 w-4" />
                  {!isVeryCompact && <span className="ml-1.5">Avaa PDF</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Avaa PDF-pohjakuva</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button data-testid="save-project-button" variant="outline" size="sm" onClick={onSaveProject} className="whitespace-nowrap">
                  <Save className="h-4 w-4" />
                  {!isVeryCompact && <span className="ml-1.5">Tallenna</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tallenna projekti</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button data-testid="load-project-button" variant="outline" size="sm" onClick={onLoadProject} className="whitespace-nowrap">
                  <FolderOpen className="h-4 w-4" />
                  {!isVeryCompact && <span className="ml-1.5">Lataa</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Lataa projekti</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="h-5 w-px bg-gray-300 flex-shrink-0"></div>

        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {renderToolButtons()}
          </div>

          <div className="h-5 w-px bg-gray-300 flex-shrink-0 mx-1"></div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button data-testid="zoom-out-button" variant="ghost" size="sm" onClick={onZoomOut} disabled={zoom <= 0.5} className="px-2">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Loitonna</TooltipContent>
              </Tooltip>

              <span className="text-xs text-gray-600 font-mono w-10 text-center flex-shrink-0">{Math.round((zoom || 1) * 100)}%</span>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button data-testid="zoom-in-button" variant="ghost" size="sm" onClick={onZoomIn} disabled={zoom >= 3} className="px-2">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Lähennä</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="h-5 w-px bg-gray-300 flex-shrink-0 mx-1"></div>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button data-testid="scale-button" variant="outline" size="sm" className="font-mono text-xs whitespace-nowrap px-2" onClick={onCalibrate}>
                  <Ruler className="h-4 w-4" />
                  {!isVeryCompact && <span className="ml-1">{currentScaleDisplay}</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mittakaava - klikkaa kalibroidaksesi</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="h-5 w-px bg-gray-300 flex-shrink-0 mx-1"></div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button data-testid="undo-button" variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo} className="px-2">
                    <Undo className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Peruuta (Ctrl+Z)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button data-testid="redo-button" variant="ghost" size="sm" onClick={onRedo} disabled={!canRedo} className="px-2">
                    <Redo className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Tee uudelleen (Ctrl+Shift+Z)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button data-testid="delete-selected-button" variant="ghost" size="sm" onClick={onDeleteSelected} disabled={!selectedMeasurementId} className="px-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Poista valittu (Delete)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <TooltipProvider delayDuration={300}>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button data-testid="tarjous-dropdown" size="sm" className="bg-[#4A9BAD] hover:bg-[#3d8699] text-white whitespace-nowrap">
                      <FileText className="h-4 w-4" />
                      {!isVeryCompact && <><span className="ml-1.5">Tarjous</span><ChevronDown className="h-3 w-3 ml-1" /></>}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Tarjous-toiminnot</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={onCreateTarjous} data-testid="menu-tarjous" className="cursor-pointer"><FileText className="h-4 w-4 mr-2 text-[#4A9BAD]" />Tee tarjous</DropdownMenuItem>
                <DropdownMenuItem onClick={onCreateKoontitarjous} data-testid="menu-koontitarjous" className="cursor-pointer"><Layers className="h-4 w-4 mr-2 text-[#4A9BAD]" />Koontitarjous</DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenOfferTerms} data-testid="menu-offer-terms" className="cursor-pointer"><Settings className="h-4 w-4 mr-2 text-gray-500" />Tarjouksen ehdot</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button data-testid="pdf-dropdown" variant="outline" size="sm" className="whitespace-nowrap">
                      <FileDown className="h-4 w-4" />
                      {!isVeryCompact && <><span className="ml-1.5">PDF</span><ChevronDown className="h-3 w-3 ml-1" /></>}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>PDF-toiminnot</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={onExportPDF} data-testid="menu-export-pdf" className="cursor-pointer"><FileDown className="h-4 w-4 mr-2 text-[#4A9BAD]" />Määrälaskenta PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={onCreateKoontiMaaralaskenta} data-testid="menu-koonti-maaralaskenta" className="cursor-pointer"><Layers className="h-4 w-4 mr-2 text-[#4A9BAD]" />Koonti määrälaskenta</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button data-testid="laskelmat-dropdown" variant="outline" size="sm" className="border-[#4A9BAD] text-[#4A9BAD] hover:bg-[#4A9BAD]/10 whitespace-nowrap">
                      <Calculator className="h-4 w-4" />
                      {!isVeryCompact && <><span className="ml-1.5">Laskelmat</span><ChevronDown className="h-3 w-3 ml-1" /></>}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Laskelmat ja aikataulut</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={onOpenMaksuerataulukko} data-testid="menu-maksuerataulukko" className="cursor-pointer"><Calculator className="h-4 w-4 mr-2 text-[#4A9BAD]" />Maksuerätaulukko</DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenWorkSchedule} data-testid="menu-work-schedule" className="cursor-pointer"><Calendar className="h-4 w-4 mr-2 text-[#4A9BAD]" />Työaikataulu</DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenKoontiWorkSchedule} data-testid="menu-koonti-work-schedule" className="cursor-pointer"><Layers className="h-4 w-4 mr-2 text-[#4A9BAD]" />Koonti työaikataulu</DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenCustomWorkSchedule} data-testid="menu-custom-work-schedule" className="cursor-pointer"><Calendar className="h-4 w-4 mr-2 text-[#4A9BAD]" />Oma työaikataulu</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button data-testid="settings-button" variant="outline" size="sm" onClick={onOpenSettings} className="whitespace-nowrap">
                  <Settings className="h-4 w-4" />
                  {!isCompact && <span className="ml-1.5">Asetukset</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Avaa asetukset</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};
