import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { KoontitarjousDialog } from '@/components/KoontitarjousDialog';
import { KoontiMaaralaskentaDialog } from '@/components/KoontiMaaralaskentaDialog';
import { WorkScheduleDialog } from '@/components/WorkScheduleDialog';
import { KoontiWorkScheduleDialog } from '@/components/KoontiWorkScheduleDialog';
import { CustomWorkScheduleDialog } from '@/components/CustomWorkScheduleDialog';
import { PDFExportDialog } from '@/components/PDFExportDialog';
import { ToolPresetSelector } from '@/components/ToolPresetSelector';
import { MaksuerataulukkoPage } from '@/components/MaksuerataulukkoPage';
import { QAPanel, useQAMode } from '@/components/QAPanel';
import { SettingsDialog } from '@/components/SettingsDialog';
import OfferTermsEditor from '@/components/OfferTermsEditor';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { 
  saveAutosave, 
  loadAutosave,
  getSettings, 
  saveSettings, 
  exportProjectToJSON, 
  importProjectFromJSON,
  createProjectData,
  parseProjectData,
  base64ToBlob,
  validateProjectData,
  saveTarjousSnapshot
} from '@/utils/storage';
import { exportToPDF, exportToPDFQuantitiesOnly, exportTarjousPDF, exportKoontitarjousPDF, exportKoontiMaaralaskentaPDF } from '@/utils/export';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(null);
  const [currentTool, setCurrentTool] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [settings, setSettings] = useState({ vatPercentage: 25.5, defaultWallHeight: 2.6 });
  const [activeTab, setActiveTab] = useState('takeoff');
  const [calibrateDialogOpen, setCalibrateDialogOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
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
  const [koontitarjousDialogOpen, setKoontitarjousDialogOpen] = useState(false);
  const [koontiMaaralaskentaDialogOpen, setKoontiMaaralaskentaDialogOpen] = useState(false);
  const [pdfExportDialogOpen, setPdfExportDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [offerTermsDialogOpen, setOfferTermsDialogOpen] = useState(false);
  const [workScheduleDialogOpen, setWorkScheduleDialogOpen] = useState(false);
  const [koontiWorkScheduleDialogOpen, setKoontiWorkScheduleDialogOpen] = useState(false);
  const [customWorkScheduleDialogOpen, setCustomWorkScheduleDialogOpen] = useState(false);
  const [customToolPresets, setCustomToolPresets] = useState(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [pendingMeasurements, setPendingMeasurements] = useState(null);
  const [currentView, setCurrentView] = useState('main'); // 'main' or 'maksuerataulukko'
  const pdfCanvasRef = useRef(null);
  const [project, setProject] = useState({
    id: `project-${Date.now()}`,
    name: 'Uusi projekti',
    createdAt: new Date().toISOString()
  });
  
  // QA Mode (hidden developer feature)
  const { isQAMode, isQAPanelOpen, setIsQAPanelOpen } = useQAMode();
  const fileInputRef = useRef(null);
  const projectInputRef = useRef(null);

  useEffect(() => {
    const loadedSettings = getSettings();
    setSettings(loadedSettings);

    const handleViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleViewport();
    window.addEventListener('resize', handleViewport);

    // Load tool presets from MongoDB API
    fetch(`${API_URL}/api/presets/tools`)
      .then(res => res.json())
      .then(data => {
        if (data?.presets) setCustomToolPresets(data.presets);
      })
      .catch(err => console.error('Failed to load tool presets:', err));

    const savedPanelState = localStorage.getItem('rakenna_right_panel_open');
    if (savedPanelState !== null) {
      setRightPanelOpen(savedPanelState === 'true');
    }

    const savedLeftSidebarState = localStorage.getItem('rakenna_left_sidebar_open');
    if (savedLeftSidebarState !== null) {
      setLeftSidebarOpen(savedLeftSidebarState === 'true');
    }

    return () => window.removeEventListener('resize', handleViewport);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setLeftSidebarOpen(false);
      setRightPanelOpen(false);
    }
  }, [isMobile]);

  // Save to undo stack before making changes
  const saveToUndoStack = useCallback(() => {
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(measurements))]);
    setRedoStack([]);
  }, [measurements]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    const previousState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(measurements))]);
    setMeasurements(previousState);
    setUndoStack(prev => prev.slice(0, -1));
    toast.success('Peruutettu');
  }, [undoStack, measurements]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(measurements))]);
    setMeasurements(nextState);
    setRedoStack(prev => prev.slice(0, -1));
    toast.success('Tehty uudelleen');
  }, [redoStack, measurements]);

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
    // Save current state to undo stack before adding
    saveToUndoStack();
    
    // Check special measurement types from preset
    const isPystykotelot = pendingPreset?.isPystykotelot || false;
    const constructionType = pendingPreset?.constructionType || null;
    const constructionOptions = pendingPreset?.constructionOptions || null;
    
    // Check if needs height (Pystykotelot types or wall type)
    const needsHeight = isPystykotelot || 
      constructionType?.includes('Pystykotelo') ||
      constructionType === 'kuivatilaPystykotelo' ||
      constructionType === 'prhPystykotelo' ||
      measurement.type === 'wall';
    
    const newMeasurement = {
      ...measurement,
      id: `measurement-${Date.now()}`,
      label: pendingPreset?.label || '',
      pricePerUnit: pendingPreset?.pricePerUnit || 0,
      unit: pendingPreset?.unit || measurement.unit,
      // Height for wall and pystykotelo types
      wallHeight: needsHeight ? (settings?.defaultWallHeight || 2.6) : null,
      // Unified construction options (replaces old individual flags)
      constructionType,
      constructionOptions,
      // Legacy flags for backward compatibility
      isPystykotelot,
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
    // Save current state to undo stack before updating
    saveToUndoStack();
    
    setMeasurements(prev =>
      prev.map(m => (m.id === id ? { ...m, ...updatedData } : m))
    );
    toast.success('Mittaus päivitetty');
  };

  const handleDeleteMeasurement = useCallback((id) => {
    // Save current state to undo stack before deleting
    saveToUndoStack();
    
    setMeasurements(prev => prev.filter(m => m.id !== id));
    setSelectedMeasurementId(null);
    toast.success('Mittaus poistettu');
  }, [saveToUndoStack]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedMeasurementId) {
        e.preventDefault();
        handleDeleteMeasurement(selectedMeasurementId);
      }

      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      if ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
          (e.key === 'y' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMeasurementId, handleDeleteMeasurement, handleRedo, handleUndo]);

  const handleCopyMeasurement = (measurement) => {
    // Save current state to undo stack before copying
    saveToUndoStack();
    
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
    // Save current state to undo stack before adding
    saveToUndoStack();
    
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

  // Add jalkalistat to ALL wall measurements that don't have one yet
  const handleAddJalkalistaAll = () => {
    const wallMeasurements = measurements.filter(m => m.type === 'wall');
    if (wallMeasurements.length === 0) {
      toast.error('Ei seinämittauksia');
      return;
    }
    // Check which walls already have jalkalistat (match by points/page)
    const existingJalkalistat = measurements.filter(m => m.label === 'Jalkalista maalaus');
    const wallsWithoutJalkalistat = wallMeasurements.filter(wall => {
      return !existingJalkalistat.some(j => 
        j.page === wall.page && j.quantity === wall.quantity
      );
    });
    
    if (wallsWithoutJalkalistat.length === 0) {
      toast.info('Kaikilla seinillä on jo jalkalistat');
      return;
    }
    
    saveToUndoStack();
    const newJalkalistat = wallsWithoutJalkalistat.map((wall, i) => ({
      id: `measurement-${Date.now()}-jl-${i}`,
      type: 'line',
      label: 'Jalkalista maalaus',
      quantity: wall.quantity,
      unit: 'jm',
      pricePerUnit: 5,
      page: wall.page,
      points: wall.points || []
    }));
    setMeasurements(prev => [...prev, ...newJalkalistat]);
    toast.success(`Jalkalistat lisätty ${wallsWithoutJalkalistat.length} seinälle`);
  };

  // Update all measurements with a given label (bulk edit from summary)
  const handleUpdateByLabel = (label, updates) => {
    saveToUndoStack();
    setMeasurements(prev => prev.map(m => {
      if (m.label === label) {
        const newData = { ...m };
        if (updates.label !== undefined && updates.label !== label) {
          newData.label = updates.label;
        }
        if (updates.pricePerUnit !== undefined) {
          newData.pricePerUnit = updates.pricePerUnit;
        }
        return newData;
      }
      return m;
    }));
    toast.success(`Päivitetty kaikki "${label}" mittaukset`);
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
      toast.error('Ei mittauksia vietäväksi', { duration: 5000 });
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
    // Allow opening dialog even without measurements for testing/preview
    if (measurements.length === 0) {
      toast.info('Tarjous on tühi - lisää mittauksia projektiin', { duration: 3000 });
    }
    setTarjousDialogOpen(true);
  };

  const handleGenerateTarjous = async (tarjousData, returnResult = false) => {
    try {
      // Dismiss any existing tarjous toast
      toast.dismiss('tarjous-export');
      
      // Load custom offer terms from API
      let customTerms = null;
      try {
        const API_URL = process.env.REACT_APP_BACKEND_URL || '';
        const res = await fetch(`${API_URL}/api/presets/offer-terms`);
        if (res.ok) {
          const data = await res.json();
          customTerms = data.terms;
        }
      } catch (e) {
        console.warn('Failed to load custom offer terms, using defaults:', e);
      }
      
      // Generate the PDF with custom terms
      const tarjousResult = exportTarjousPDF(project, measurements, settings, tarjousData, customTerms);
      
      // Save snapshot for koontitarjous if generation was successful
      if (tarjousResult) {
        saveTarjousSnapshot({
          projectName: project.name,
          title: tarjousData.title || project.name,
          customerName: tarjousData.customerName || '',
          customerAddress: tarjousData.customerAddress || '',
          operations: tarjousResult.operations || [],
          totals: tarjousResult.totals || {},
        });
      }
      
      // If returnResult is true (for email sending), return the result instead of showing toast
      if (returnResult) {
        return tarjousResult;
      }
      
      toast.success('Tarjous PDF luotu ja tallennettu!', { 
        id: 'tarjous-export',
        duration: 3000 
      });
    } catch (error) {
      console.error('Tarjous generation error:', error);
      toast.error('Tarjouksen luominen epäonnistui', { duration: 8000 });
      return null;
    }
  };

  const handleGenerateKoontitarjous = async (koontitarjousData, returnResult = false) => {
    try {
      toast.dismiss('koontitarjous-export');
      
      // Load custom offer terms from API
      let customTerms = null;
      try {
        const API_URL = process.env.REACT_APP_BACKEND_URL || '';
        const res = await fetch(`${API_URL}/api/presets/offer-terms`);
        if (res.ok) {
          const data = await res.json();
          customTerms = data.terms;
        }
      } catch (e) {
        console.warn('Failed to load custom offer terms, using defaults:', e);
      }
      
      const result = exportKoontitarjousPDF(koontitarjousData, customTerms);
      
      // If returnResult is true (for email sending), return the result
      if (returnResult) {
        return result;
      }
      
      toast.success('Koontitarjous PDF luotu!', { 
        id: 'koontitarjous-export',
        duration: 3000 
      });
    } catch (error) {
      console.error('Koontitarjous generation error:', error);
      toast.error('Koontitarjouksen luominen epäonnistui', { duration: 8000 });
      return null;
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

  // Show Maksuerätaulukko page
  if (currentView === 'maksuerataulukko') {
    return (
      <div className="flex flex-col h-screen bg-[#F9FAFB]">
        <MaksuerataulukkoPage onBack={() => setCurrentView('main')} />
        <Toaster 
          position="top-right" 
          closeButton
          toastOptions={{
            duration: 4000,
            className: 'toast-notification',
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#F9FAFB]">
      <Toolbar
        onOpenPdf={handleOpenPdf}
        onCalibrate={() => setCalibrateDialogOpen(true)}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        onExportPDF={handleOpenPDFExportDialog}
        onCreateTarjous={handleCreateTarjous}
        onCreateKoontitarjous={() => setKoontitarjousDialogOpen(true)}
        onCreateKoontiMaaralaskenta={() => setKoontiMaaralaskentaDialogOpen(true)}
        onOpenMaksuerataulukko={() => setCurrentView('maksuerataulukko')}
        onOpenWorkSchedule={() => setWorkScheduleDialogOpen(true)}
        onOpenKoontiWorkSchedule={() => setKoontiWorkScheduleDialogOpen(true)}
        onOpenCustomWorkSchedule={() => setCustomWorkScheduleDialogOpen(true)}
        onOpenOfferTerms={() => setOfferTermsDialogOpen(true)}
        onOpenSettings={() => setSettingsDialogOpen(true)}
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
        customPresets={customToolPresets}
      />

      <div className="flex flex-1 relative" style={{ overflow: 'hidden' }}>
        {/* Left Sidebar with Thumbnails */}
        {!isMobile && (
          <LeftSidebar
            pdfDocument={pdfDocument}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            isOpen={leftSidebarOpen}
            onToggle={toggleLeftSidebar}
            projectName={project.name}
            onProjectNameChange={(name) => setProject(prev => ({ ...prev, name }))}
          />
        )}

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
            externalCanvasRef={pdfCanvasRef}
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

        {/* Mobile backdrop */}
        {isMobile && rightPanelOpen && (
          <div
            className="absolute inset-0 z-20 bg-black/35"
            onClick={toggleRightPanel}
          />
        )}

        {/* Toggle button for right panel */}
        <Button
          data-testid="toggle-right-panel"
          onClick={toggleRightPanel}
          className={isMobile
            ? "absolute bottom-4 right-4 z-30 h-11 rounded-full bg-[#0052CC] hover:bg-[#0043A8] px-4 shadow-xl"
            : "absolute top-1/2 -translate-y-1/2 z-30 h-20 w-6 rounded-l-lg rounded-r-none bg-[#0052CC] hover:bg-[#0043A8] p-0 shadow-lg"}
          style={isMobile
            ? { transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)' }
            : {
                right: rightPanelOpen ? '384px' : '0px',
                transition: 'right 300ms cubic-bezier(0.16, 1, 0.3, 1)'
              }}
        >
          {isMobile ? (
            <span className="text-xs font-medium">{rightPanelOpen ? 'Sulje' : 'Paneeli'}</span>
          ) : rightPanelOpen ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>

        {/* Right panel - fixed position to avoid layout issues */}
        <div 
          data-testid="right-panel"
          className={isMobile
            ? "bg-white border-t border-gray-200 absolute bottom-0 left-0 right-0 z-30"
            : "bg-white border-l border-gray-200 absolute top-0 right-0 z-20 h-full"}
          style={isMobile
            ? {
                height: '60vh',
                transform: rightPanelOpen ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)'
              }
            : {
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
                  onUpdateByLabel={handleUpdateByLabel}
                  onDelete={handleDeleteMeasurement}
                  onCopy={handleCopyMeasurement}
                  onAddJalkalista={handleAddJalkalista}
                  onAddJalkalistaAll={handleAddJalkalistaAll}
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

      <KoontitarjousDialog
        open={koontitarjousDialogOpen}
        onClose={() => setKoontitarjousDialogOpen(false)}
        onGenerate={handleGenerateKoontitarjous}
        vatPercentage={settings?.vatPercentage || 25.5}
      />

      <KoontiMaaralaskentaDialog
        open={koontiMaaralaskentaDialogOpen}
        onClose={() => setKoontiMaaralaskentaDialogOpen(false)}
        onGenerate={(data) => exportKoontiMaaralaskentaPDF(data)}
        vatPercentage={settings?.vatPercentage || 25.5}
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

      <Toaster 
        position="top-right" 
        closeButton
        toastOptions={{
          duration: 4000,
          className: 'toast-notification',
        }}
      />

      {/* Hidden QA Panel for developers */}
      {isQAMode && (
        <QAPanel
          isOpen={isQAPanelOpen}
          onClose={() => setIsQAPanelOpen(false)}
          measurements={measurements}
          addMeasurement={(m) => setMeasurements(prev => [...prev, m])}
          updateMeasurement={(id, data) => setMeasurements(prev => prev.map(m => m.id === id ? { ...m, ...data } : m))}
          deleteMeasurement={(id) => setMeasurements(prev => prev.filter(m => m.id !== id))}
          getMeasurements={() => measurements}
          undo={handleUndo}
          redo={handleRedo}
        />
      )}

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        onPresetsChange={(newToolPresets) => {
          setCustomToolPresets(newToolPresets);
        }}
      />

      {/* Offer Terms Editor Dialog */}
      <OfferTermsEditor
        open={offerTermsDialogOpen}
        onClose={() => setOfferTermsDialogOpen(false)}
      />

      {/* Work Schedule Dialog */}
      <WorkScheduleDialog
        open={workScheduleDialogOpen}
        onClose={() => setWorkScheduleDialogOpen(false)}
        measurements={measurements}
        projectName={project.name}
      />

      {/* Koonti Work Schedule Dialog */}
      <KoontiWorkScheduleDialog
        open={koontiWorkScheduleDialogOpen}
        onClose={() => setKoontiWorkScheduleDialogOpen(false)}
      />

      {/* Custom Work Schedule Dialog */}
      <CustomWorkScheduleDialog
        open={customWorkScheduleDialogOpen}
        onClose={() => setCustomWorkScheduleDialogOpen(false)}
      />
    </div>
  );
}

export default App;
