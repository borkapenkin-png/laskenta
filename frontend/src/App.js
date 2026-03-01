import React, { useState, useEffect, useRef } from 'react';
import '@/App.css';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Toolbar } from '@/components/Toolbar';
import { PDFViewer } from '@/components/PDFViewer';
import { LeftSidebar } from '@/components/LeftSidebar';
import { TakeoffPanel } from '@/components/TakeoffPanel';
import { CalculatorPanel } from '@/components/CalculatorPanel';
import { CalibrateDialog } from '@/components/CalibrateDialog';
import { TarjousDialog } from '@/components/TarjousDialog';
import { PDFExportDialog } from '@/components/PDFExportDialog';
import { ToolPresetSelector } from '@/components/ToolPresetSelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { 
  saveAutosave, 
  loadAutosave,
  getSettings, 
  saveSettings, 
  getPresets, 
  savePresets, 
  exportProjectToJSON, 
  importProjectFromJSON,
  createProjectData,
  parseProjectData,
  base64ToBlob,
  validateProjectData
} from '@/utils/storage';
import { exportToPDF, exportToPDFQuantitiesOnly, exportTarjousPDF } from '@/utils/export';

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(null);
  const [currentTool, setCurrentTool] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [presets, setPresets] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('takeoff');
  const [calibrateDialogOpen, setCalibrateDialogOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [calibrationDistance, setCalibrationDistance] = useState(null);
  const [pdfRenderInfo, setPdfRenderInfo] = useState(null);
  const [toolPresetOpen, setToolPresetOpen] = useState(false);
  const [pendingTool, setPendingTool] = useState(null);
  const [pendingPreset, setPendingPreset] = useState(null);
  const [toolPresetPosition, setToolPresetPosition] = useState({ x: 100, y: 100 });
  const [tarjousDialogOpen, setTarjousDialogOpen] = useState(false);
  const [pdfExportDialogOpen, setPdfExportDialogOpen] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [pendingMeasurements, setPendingMeasurements] = useState(null);
  const [project, setProject] = useState({
    id: `project-${Date.now()}`,
    name: 'Uusi projekti',
    createdAt: new Date().toISOString()
  });
  const fileInputRef = useRef(null);
  const projectInputRef = useRef(null);

  useEffect(() => {
    const loadedSettings = getSettings();
    setSettings(loadedSettings);
    const loadedPresets = getPresets();
    setPresets(loadedPresets);

    const savedPanelState = localStorage.getItem('rakenna_right_panel_open');
    if (savedPanelState !== null) {
      setRightPanelOpen(savedPanelState === 'true');
    }

    const savedLeftSidebarState = localStorage.getItem('rakenna_left_sidebar_open');
    if (savedLeftSidebarState !== null) {
      setLeftSidebarOpen(savedLeftSidebarState === 'true');
    }

    // Keyboard shortcuts for delete and undo/redo
    const handleKeyDown = (e) => {
      // Delete selected measurement
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedMeasurementId) {
        e.preventDefault();
        handleDeleteMeasurement(selectedMeasurementId);
      }
      
      // Undo: Ctrl/Cmd + Z
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      
      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
          (e.key === 'y' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedMeasurementId]);

  // Save to undo stack before making changes
  const saveToUndoStack = () => {
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(measurements))]);
    setRedoStack([]); // Clear redo stack on new action
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    
    const previousState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(measurements))]);
    setMeasurements(previousState);
    setUndoStack(prev => prev.slice(0, -1));
    toast.success('Peruutettu');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(measurements))]);
    setMeasurements(nextState);
    setRedoStack(prev => prev.slice(0, -1));
    toast.success('Tehty uudelleen');
  };

  // Clear undo/redo stacks on start - no demo measurements
  useEffect(() => {
    setUndoStack([]);
    setRedoStack([]);
    setMeasurements([]);
  }, []);

  // Autosave to localStorage (without PDF data to avoid quota issues)
  useEffect(() => {
    const saveData = () => {
      if (project && measurements.length > 0) {
        saveAutosave(project, measurements, scale, currentPage);
      }
    };

    const timeoutId = setTimeout(saveData, 2000);
    return () => clearTimeout(timeoutId);
  }, [measurements, project, scale, currentPage]);

  // When PDF document is ready and we have pending measurements, apply them
  useEffect(() => {
    if (pdfDocument && pendingMeasurements && !isLoadingProject) {
      console.log('PDF ready, applying pending measurements:', pendingMeasurements.length);
      setMeasurements(pendingMeasurements);
      setPendingMeasurements(null);
    }
  }, [pdfDocument, pendingMeasurements, isLoadingProject]);

  useEffect(() => {
    if (settings) {
      saveSettings(settings);
    }
  }, [settings]);

  useEffect(() => {
    if (presets.length > 0) {
      savePresets(presets);
    }
  }, [presets]);

  const handleOpenPdf = () => {
    fileInputRef.current?.click();
  };

  const handlePdfFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setCurrentPage(1);
      toast.success('PDF ladattu onnistuneesti');
    } else {
      toast.error('Valitse kelvollinen PDF-tiedosto');
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleMeasurementComplete = (measurement) => {
    // Check special measurement types
    const isPystykotelot = pendingPreset?.isPystykotelot || false;
    const isKuivatilaRakennus = pendingPreset?.isKuivatilaRakennus || false;
    const isPRHRakennus = pendingPreset?.isPRHRakennus || false;
    const isKuivatilaAK = pendingPreset?.isKuivatilaAK || false;
    const isMarkatilaAK = pendingPreset?.isMarkatilaAK || false;
    const isPRHAK = pendingPreset?.isPRHAK || false;
    const isKuivatilaPystykotelo = pendingPreset?.isKuivatilaPystykotelo || false;
    const isPRHPystykotelo = pendingPreset?.isPRHPystykotelo || false;
    
    // Check if this type needs Ranka/Kipsi options
    const hasRankaKipsi = isKuivatilaRakennus || isPRHRakennus || isKuivatilaAK || isMarkatilaAK || isPRHAK || isKuivatilaPystykotelo || isPRHPystykotelo;
    // Check if needs height (Pystykotelot types)
    const needsHeight = isPystykotelot || isKuivatilaPystykotelo || isPRHPystykotelo || measurement.type === 'wall';
    
    const newMeasurement = {
      ...measurement,
      id: `measurement-${Date.now()}`,
      label: pendingPreset?.label || '',
      pricePerUnit: pendingPreset?.pricePerUnit || 0,
      unit: pendingPreset?.unit || measurement.unit,
      // Height for wall and pystykotelo types
      wallHeight: needsHeight ? (settings?.defaultWallHeight || 2.6) : null,
      // Type flags
      isPystykotelot,
      isKuivatilaRakennus,
      isPRHRakennus,
      isKuivatilaAK,
      isMarkatilaAK,
      isPRHAK,
      isKuivatilaPystykotelo,
      isPRHPystykotelo,
      hasRankaKipsi,
      // Ranka/Kipsi defaults
      rankaType: hasRankaKipsi ? 'metall' : null,
      kipsiType: hasRankaKipsi ? '1-kertainen' : null,
      // Märkätila extra option
      lagiPaneeli: isMarkatilaAK ? false : null,
      bothSides: false,
      openings: 0,
      page: currentPage
    };

    setMeasurements(prev => [...prev, newMeasurement]);
    toast.success(`Mittaus lisätty: ${measurement.quantity.toFixed(2)} ${newMeasurement.unit}`);
  };

  // Handle tool selection - show preset menu first
  const handleToolSelect = (tool, event) => {
    if (!tool) {
      // Hand tool - no preset needed
      setCurrentTool(null);
      setPendingPreset(null);
      return;
    }

    // Get click position for preset menu
    const rect = event?.currentTarget?.getBoundingClientRect();
    setToolPresetPosition({
      x: rect ? rect.left : 100,
      y: rect ? rect.bottom + 5 : 100
    });

    setPendingTool(tool);
    setToolPresetOpen(true);
  };

  const handlePresetSelect = (preset) => {
    setPendingPreset(preset);
    setCurrentTool(pendingTool);
    setToolPresetOpen(false);
    setPendingTool(null);
  };

  const handlePresetClose = () => {
    setToolPresetOpen(false);
    setPendingTool(null);
  };

  const handleUpdateMeasurement = (id, updatedData) => {
    setMeasurements(prev =>
      prev.map(m => (m.id === id ? { ...m, ...updatedData } : m))
    );
    toast.success('Mittaus päivitetty');
  };

  const handleDeleteMeasurement = (id) => {
    if (undoStack.length > 0 || measurements.length > 0) {
      saveToUndoStack();
    }
    setMeasurements(prev => prev.filter(m => m.id !== id));
    setSelectedMeasurementId(null);
    toast.success('Mittaus poistettu');
  };

  const handleCopyMeasurement = (measurement) => {
    const copiedMeasurement = {
      ...measurement,
      id: `measurement-${Date.now()}`,
      label: measurement.label ? `${measurement.label} (kopio)` : ''
    };
    setMeasurements(prev => [...prev, copiedMeasurement]);
    toast.success('Mittaus kopioitu');
  };

  // Create jalkalista (baseboard) measurement from wall measurement
  const handleAddJalkalista = (wallMeasurement) => {
    // Use the original running meters (quantity) from the wall measurement
    const jalkalistaMeasurement = {
      id: `measurement-${Date.now()}`,
      type: 'line',
      label: 'Jalkalista maalaus',
      quantity: wallMeasurement.quantity, // Original jm value
      unit: 'jm',
      pricePerUnit: 5, // Default jalkalista price
      page: wallMeasurement.page,
      points: wallMeasurement.points || []
    };
    setMeasurements(prev => [...prev, jalkalistaMeasurement]);
    toast.success(`Jalkalista maalaus lisätty: ${wallMeasurement.quantity.toFixed(2)} jm`);
  };

  const handleDeleteCurrentPage = () => {
    if (measurements.filter(m => m.page === currentPage).length === 0) {
      toast.error('Ei mittauksia tällä sivulla');
      return;
    }
    
    if (window.confirm('Haluatko varmasti poistaa kaikki mittaukset tältä sivulta?')) {
      saveToUndoStack();
      setMeasurements(prev => prev.filter(m => m.page !== currentPage));
      setSelectedMeasurementId(null);
      toast.success('Sivun mittaukset poistettu');
    }
  };

  const handleDeleteAllMeasurements = () => {
    if (measurements.length === 0) {
      toast.error('Ei mittauksia poistettavaksi');
      return;
    }
    
    if (window.confirm('Haluatko varmasti poistaa KAIKKI mittaukset projektista? Tätä toimintoa ei voi perua.')) {
      saveToUndoStack();
      setMeasurements([]);
      setSelectedMeasurementId(null);
      toast.success('Kaikki mittaukset poistettu');
    }
  };

  const handleSaveProject = async () => {
    try {
      // Create complete project data with PDF included
      const projectData = await createProjectData(
        project,
        measurements,
        scale,
        pdfFile,
        currentPage,
        { zoom },
        settings
      );
      
      await exportProjectToJSON(projectData);
      toast.success('Projekti tallennettu tiedostoon');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Projektin tallennus epäonnistui');
    }
  };

  const handleLoadProject = () => {
    projectInputRef.current?.click();
  };

  const handleProjectFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset input so same file can be selected again
    e.target.value = '';
    
    setIsLoadingProject(true);
    
    try {
      // Parse the JSON file
      const rawData = await importProjectFromJSON(file);
      
      // Validate project data
      const validation = validateProjectData(rawData);
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(w => toast.warning(w));
      }
      
      // Parse into structured format
      const parsed = parseProjectData(rawData);
      
      console.log('Loaded project:', parsed);
      
      // Update project metadata
      setProject({
        id: parsed.project.id,
        name: parsed.project.name,
        createdAt: parsed.project.createdAt,
      });
      
      // Set scale
      if (parsed.scale) {
        setScale(parsed.scale);
      }
      
      // Set view state
      if (parsed.viewState?.zoom) {
        setZoom(parsed.viewState.zoom);
      }
      
      // Handle base file (PDF)
      if (parsed.baseFile?.data) {
        try {
          // Convert base64 back to blob/file
          const blob = base64ToBlob(parsed.baseFile.data);
          if (blob) {
            const pdfFileFromProject = new File(
              [blob], 
              parsed.baseFile.name || 'project.pdf',
              { type: parsed.baseFile.type || 'application/pdf' }
            );
            
            // Store measurements to apply after PDF loads
            setPendingMeasurements(parsed.measurements);
            
            // Set page first, then file (file change will trigger PDF load)
            setCurrentPage(parsed.baseFile.pageIndex || 1);
            setPdfFile(pdfFileFromProject);
            
            toast.success(`Projekti "${parsed.project.name}" ladattu - ${parsed.measurements.length} mittausta`);
          } else {
            throw new Error('PDF-tiedoston muunnos epäonnistui');
          }
        } catch (pdfError) {
          console.error('PDF restore error:', pdfError);
          // Load measurements anyway, user can load PDF manually
          setMeasurements(parsed.measurements);
          toast.warning('PDF-pohja puuttuu - lataa PDF erikseen. Mittaukset palautettu.');
        }
      } else if (parsed.isLegacy) {
        // Legacy project without PDF
        setMeasurements(parsed.measurements);
        toast.warning('Vanha projektiversio - lataa PDF erikseen mittausten näyttämiseksi');
      } else {
        // No PDF in project
        setMeasurements(parsed.measurements);
        toast.info('Projekti ladattu - lataa PDF nähdäksesi mittaukset');
      }
      
    } catch (error) {
      console.error('Load error:', error);
      toast.error(`Projektin lataaminen epäonnistui: ${error.message}`);
    } finally {
      setIsLoadingProject(false);
    }
  };

  const handleOpenPDFExportDialog = () => {
    if (measurements.length === 0) {
      toast.error('Ei mittauksia vietäväksi');
      return;
    }
    setPdfExportDialogOpen(true);
  };

  const handleExportPDF = (includePrices) => {
    // Dismiss any existing PDF toast first
    toast.dismiss('pdf-export');
    
    if (includePrices) {
      const summary = calculateSummary();
      exportToPDF(project, measurements, summary, settings);
      toast.success('PDF luotu (hinnoilla)', { 
        id: 'pdf-export',
        duration: 3000 
      });
    } else {
      exportToPDFQuantitiesOnly(project, measurements, settings);
      toast.success('PDF luotu (vain määrät)', { 
        id: 'pdf-export',
        duration: 3000 
      });
    }
  };

  const handleCreateTarjous = () => {
    if (measurements.length === 0) {
      toast.error('Ei mittauksia - lisää mittauksia ensin');
      return;
    }
    setTarjousDialogOpen(true);
  };

  const handleGenerateTarjous = (tarjousData) => {
    try {
      exportTarjousPDF(project, measurements, settings, tarjousData);
      toast.success('Tarjous PDF luotu!');
    } catch (error) {
      console.error('Tarjous generation error:', error);
      toast.error('Tarjouksen luominen epäonnistui');
    }
  };

  const calculateSummary = () => {
    let totalCost = 0;

    measurements.forEach(m => {
      let effectiveQuantity = m.quantity || 0;

      if (m.type === 'wall' && m.wallHeight) {
        const bruttoM2 = effectiveQuantity * m.wallHeight * (m.bothSides ? 2 : 1);
        const openings = m.openings || 0;
        effectiveQuantity = bruttoM2 - openings;
      }

      const pricePerUnit = m.pricePerUnit || 0;
      totalCost += effectiveQuantity * pricePerUnit;
    });

    const vatPercentage = settings?.vatPercentage || 25.5;
    const totalPriceWithVat = totalCost * (1 + vatPercentage / 100);

    return {
      totalPrice: totalCost,
      totalPriceWithVat
    };
  };

  const handleSavePreset = (preset) => {
    const existingIndex = presets.findIndex(p => p.id === preset.id);
    if (existingIndex >= 0) {
      const updated = [...presets];
      updated[existingIndex] = preset;
      setPresets(updated);
      toast.success('Presetti päivitetty');
    } else {
      setPresets(prev => [...prev, preset]);
      toast.success('Presetti lisätty');
    }
  };

  const handleDeletePreset = (id) => {
    setPresets(prev => prev.filter(p => p.id !== id));
    toast.success('Presetti poistettu');
  };

  const handleApplyPreset = (preset) => {
    // Apply preset to the most recent measurement or set as default for next
    if (selectedMeasurementId) {
      // Apply to selected measurement
      setMeasurements(prev =>
        prev.map(m => m.id === selectedMeasurementId ? { 
          ...m, 
          label: preset.name,
          pricePerUnit: preset.pricePerUnit,
          unit: preset.unit
        } : m)
      );
      toast.success(`Presetti "${preset.name}" sovellettu valittuun mittaukseen`);
    } else if (measurements.length > 0) {
      // Apply to the last measurement
      const lastId = measurements[measurements.length - 1].id;
      setMeasurements(prev =>
        prev.map(m => m.id === lastId ? { 
          ...m, 
          label: preset.name,
          pricePerUnit: preset.pricePerUnit,
          unit: preset.unit
        } : m)
      );
      toast.success(`Presetti "${preset.name}" sovellettu viimeiseen mittaukseen`);
    } else {
      toast.info(`Valitse tai luo mittaus ensin`);
    }
  };

  const toggleRightPanel = () => {
    const newState = !rightPanelOpen;
    setRightPanelOpen(newState);
    localStorage.setItem('rakenna_right_panel_open', newState.toString());
  };

  const toggleLeftSidebar = () => {
    const newState = !leftSidebarOpen;
    setLeftSidebarOpen(newState);
    localStorage.setItem('rakenna_left_sidebar_open', newState.toString());
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  // Global wall height change - updates all measurements with wall height
  const handleGlobalWallHeightChange = (newHeight) => {
    const updated = measurements.map(m => {
      // Update measurements that have wall height (wall type and pystykotelo types)
      if (m.type === 'wall' || m.isPystykotelot || m.isKuivatilaPystykotelo || m.isPRHPystykotelo) {
        return { ...m, wallHeight: newHeight };
      }
      return m;
    });
    setMeasurements(updated);
    toast.success(`Korkeus päivitetty kaikille seinille: ${newHeight}m`);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F9FAFB]">
      <Toolbar
        onOpenPdf={handleOpenPdf}
        onCalibrate={() => setCalibrateDialogOpen(true)}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        onExportPDF={handleOpenPDFExportDialog}
        onCreateTarjous={handleCreateTarjous}
        currentTool={currentTool}
        onToolSelect={handleToolSelect}
        selectedMeasurementId={selectedMeasurementId}
        onDeleteSelected={() => selectedMeasurementId && handleDeleteMeasurement(selectedMeasurementId)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        scale={scale}
        onScaleChange={setScale}
      />

      {/* Tool Preset Selector */}
      <ToolPresetSelector
        isOpen={toolPresetOpen}
        toolType={pendingTool}
        position={toolPresetPosition}
        onSelect={handlePresetSelect}
        onClose={handlePresetClose}
      />

      <div className="flex flex-1 relative" style={{ overflow: 'hidden' }}>
        {/* Left Sidebar with Thumbnails */}
        <LeftSidebar
          pdfDocument={pdfDocument}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          isOpen={leftSidebarOpen}
          onToggle={toggleLeftSidebar}
          projectName={project.name}
          onProjectNameChange={(name) => setProject(prev => ({ ...prev, name }))}
        />

        <div className="flex-1 relative">
          <PDFViewer
            pdfFile={pdfFile}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            scale={scale}
            onScaleChange={setScale}
            currentTool={currentTool}
            onPdfLoad={setPdfDocument}
            onMeasurementComplete={handleMeasurementComplete}
            measurements={measurements}
            selectedMeasurementId={selectedMeasurementId}
            onMeasurementSelect={setSelectedMeasurementId}
            zoom={zoom}
            onZoomChange={setZoom}
            calibrationMode={currentTool === 'calibrate'}
            calibrationDistance={calibrationDistance}
            onRenderInfoChange={setPdfRenderInfo}
            onCalibrationComplete={(pixelDistance) => {
              if (calibrationDistance && pixelDistance > 0) {
                // pixelDistance comes from screen coordinates, need to normalize it
                // Since calibration points are in screen coords, we divide by zoom
                const normalizedPixelDistance = pixelDistance / zoom;
                const pixelsPerMeter = normalizedPixelDistance / calibrationDistance;
                // Calculate estimated scale based on normalized DPI
                const actualDPI = pdfRenderInfo?.actualDPI || 72;
                const baseDPI = actualDPI / zoom;
                const pixelsPerCm = baseDPI / 2.54;
                const estimatedScale = Math.round((pixelsPerCm * 100) / pixelsPerMeter);
                setScale({
                  pixelsPerMeter: pixelsPerMeter,
                  ratio: `~1:${estimatedScale}`,
                  scaleValue: estimatedScale,
                  detected: true
                });
                toast.success(`Mittakaava kalibroitu: ~1:${estimatedScale}`);
              }
              setCalibrationDistance(null);
              setCurrentTool(null);
            }}
          />
        </div>

        {/* Toggle button for right panel */}
        <Button
          data-testid="toggle-right-panel"
          onClick={toggleRightPanel}
          className="absolute top-1/2 -translate-y-1/2 z-30 h-20 w-6 rounded-l-lg rounded-r-none bg-[#0052CC] hover:bg-[#0043A8] p-0 shadow-lg"
          style={{ 
            right: rightPanelOpen ? '384px' : '0px',
            transition: 'right 300ms cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {rightPanelOpen ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>

        {/* Right panel - fixed position to avoid layout issues */}
        <div 
          data-testid="right-panel"
          className="bg-white border-l border-gray-200 absolute top-0 right-0 z-20 h-full"
          style={{
            width: '384px',
            transform: rightPanelOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-gray-200">
              <TabsTrigger value="takeoff" data-testid="tab-takeoff">Määrälaskenta</TabsTrigger>
              <TabsTrigger value="calculator" data-testid="tab-calculator">Laskenta</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="takeoff" className="h-full m-0">
                <TakeoffPanel
                  measurements={measurements}
                  onUpdate={handleUpdateMeasurement}
                  onDelete={handleDeleteMeasurement}
                  onCopy={handleCopyMeasurement}
                  onAddJalkalista={handleAddJalkalista}
                  settings={settings}
                  selectedMeasurementId={selectedMeasurementId}
                  onMeasurementSelect={setSelectedMeasurementId}
                />
              </TabsContent>

              <TabsContent value="calculator" className="h-full m-0">
                <CalculatorPanel
                  measurements={measurements}
                  settings={settings}
                  onSettingsChange={setSettings}
                  onGlobalWallHeightChange={handleGlobalWallHeightChange}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      <CalibrateDialog
        open={calibrateDialogOpen}
        onClose={() => setCalibrateDialogOpen(false)}
        pdfRenderInfo={pdfRenderInfo}
        onCalibrate={(newScale) => {
          setScale(newScale);
          toast.success(`Mittakaava asetettu: ${newScale.ratio}`);
        }}
        onStartCalibration={(knownDistance) => {
          // Start two-point calibration mode
          setCalibrationDistance(knownDistance);
          setCurrentTool('calibrate');
          toast.info('Klikkaa kaksi pistettä PDF:stä');
        }}
      />

      <TarjousDialog
        open={tarjousDialogOpen}
        onClose={() => setTarjousDialogOpen(false)}
        onGenerate={handleGenerateTarjous}
        projectName={project.name}
      />

      <PDFExportDialog
        open={pdfExportDialogOpen}
        onClose={() => setPdfExportDialogOpen(false)}
        onExport={handleExportPDF}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handlePdfFileChange}
        className="hidden"
      />

      <input
        ref={projectInputRef}
        type="file"
        accept=".json"
        onChange={handleProjectFileChange}
        className="hidden"
      />

      <Toaster position="top-right" />
    </div>
  );
}

export default App;
