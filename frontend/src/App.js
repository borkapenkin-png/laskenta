import React, { useState, useEffect, useRef } from 'react';
import '@/App.css';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Toolbar } from '@/components/Toolbar';
import { PDFViewer } from '@/components/PDFViewer';
import { TakeoffPanel } from '@/components/TakeoffPanel';
import { PresetPanel } from '@/components/PresetPanel';
import { CalculatorPanel } from '@/components/CalculatorPanel';
import { CalibrateDialog } from '@/components/CalibrateDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { saveProject, getSettings, saveSettings, getPresets, savePresets, exportProjectToJSON, importProjectFromJSON } from '@/utils/storage';
import { exportToCSV, exportToPDF } from '@/utils/export';

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(null);
  const [currentTool, setCurrentTool] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [presets, setPresets] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('takeoff');
  const [calibrateDialogOpen, setCalibrateDialogOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
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

    const savedToolbarSize = localStorage.getItem('rakenna_toolbar_size');
    if (savedToolbarSize) {
      setToolbarSize(parseFloat(savedToolbarSize));
    }

    const savedPanelState = localStorage.getItem('rakenna_right_panel_open');
    if (savedPanelState !== null) {
      setRightPanelOpen(savedPanelState === 'true');
    }

    const demoMeasurements = [
      {
        id: 'demo-1',
        type: 'wall',
        category: 'Maalaus',
        subcategory: 'Seinät',
        unit: 'jm',
        quantity: 12.5,
        wallHeight: 2.6,
        bothSides: false,
        openings: 2.1,
        waste: 5,
        layers: 2,
        productivity: 8,
        materialCostPerUnit: 2.5,
        notes: 'Olohuoneen seinät',
        points: []
      },
      {
        id: 'demo-2',
        type: 'rectangle',
        category: 'Maalaus',
        subcategory: 'Katot',
        unit: 'm²',
        quantity: 25.5,
        waste: 5,
        layers: 2,
        productivity: 6,
        materialCostPerUnit: 3.0,
        notes: 'Olohuoneen katto',
        points: []
      },
      {
        id: 'demo-3',
        type: 'polygon',
        category: 'Tasoitus',
        subcategory: 'Seinät',
        unit: 'm²',
        quantity: 18.3,
        waste: 10,
        layers: 1,
        productivity: 5,
        materialCostPerUnit: 4.0,
        notes: 'Keittiön tasoitus',
        points: []
      }
    ];
    setMeasurements(demoMeasurements);
  }, []);

  useEffect(() => {
    const saveData = () => {
      if (project && measurements.length > 0) {
        saveProject({
          ...project,
          measurements,
          scale,
          updatedAt: new Date().toISOString()
        });
      }
    };

    const timeoutId = setTimeout(saveData, 1000);
    return () => clearTimeout(timeoutId);
  }, [measurements, project, scale]);

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
  };

  const handleMeasurementComplete = (measurement) => {
    const newMeasurement = {
      ...measurement,
      id: `measurement-${Date.now()}`,
      category: 'Määrittelemätön',
      subcategory: 'Määrittelemätön',
      waste: 5,
      layers: 1,
      productivity: 8,
      materialCostPerUnit: 2.5,
      wallHeight: measurement.type === 'wall' ? (settings?.defaultWallHeight || 2.6) : null,
      bothSides: false,
      openings: 0,
      page: currentPage
    };

    setMeasurements(prev => [...prev, newMeasurement]);
    toast.success(`Mittaus lisätty: ${measurement.quantity.toFixed(2)} ${measurement.unit}`);
  };

  const handleUpdateMeasurement = (id, updatedData) => {
    setMeasurements(prev =>
      prev.map(m => (m.id === id ? { ...m, ...updatedData } : m))
    );
    toast.success('Mittaus päivitetty');
  };

  const handleDeleteMeasurement = (id) => {
    setMeasurements(prev => prev.filter(m => m.id !== id));
    toast.success('Mittaus poistettu');
  };

  const handleSaveProject = () => {
    const projectData = {
      ...project,
      measurements,
      scale,
      updatedAt: new Date().toISOString()
    };
    exportProjectToJSON(projectData);
    toast.success('Projekti tallennettu');
  };

  const handleLoadProject = () => {
    projectInputRef.current?.click();
  };

  const handleProjectFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const loadedProject = await importProjectFromJSON(file);
        setProject(loadedProject);
        setMeasurements(loadedProject.measurements || []);
        setScale(loadedProject.scale || null);
        toast.success('Projekti ladattu onnistuneesti');
      } catch (error) {
        toast.error('Projektin lataaminen epäonnistui');
      }
    }
  };

  const handleExportCSV = () => {
    if (measurements.length === 0) {
      toast.error('Ei mittauksia vietäväksi');
      return;
    }

    const summary = calculateSummary();
    exportToCSV(measurements, summary, settings);
    toast.success('CSV viety onnistuneesti');
  };

  const handleExportPDF = () => {
    if (measurements.length === 0) {
      toast.error('Ei mittauksia vietäväksi');
      return;
    }

    const summary = calculateSummary();
    exportToPDF(project, measurements, summary, settings);
    toast.success('PDF-raportti luotu');
  };

  const calculateSummary = () => {
    let totalLaborHours = 0;
    let totalLaborCost = 0;
    let totalMaterialCost = 0;

    measurements.forEach(m => {
      const waste = (m.waste || 0) / 100;
      const layers = m.layers || 1;
      const productivity = m.productivity || 1;
      const materialCost = m.materialCostPerUnit || 0;
      const hourlyRate = settings?.hourlyRate || 45;

      let effectiveQuantity = m.quantity || 0;

      if (m.type === 'wall' && m.wallHeight) {
        const bruttoM2 = effectiveQuantity * m.wallHeight * (m.bothSides ? 2 : 1);
        const openings = m.openings || 0;
        effectiveQuantity = bruttoM2 - openings;
      }

      const quantityWithWaste = effectiveQuantity * (1 + waste) * layers;
      const laborHours = quantityWithWaste / productivity;
      const laborCost = laborHours * hourlyRate;
      const matCost = quantityWithWaste * materialCost;

      totalLaborHours += laborHours;
      totalLaborCost += laborCost;
      totalMaterialCost += matCost;
    });

    const totalPrice = totalLaborCost + totalMaterialCost;
    const vatPercentage = settings?.vatPercentage || 25.5;
    const totalPriceWithVat = totalPrice * (1 + vatPercentage / 100);

    return {
      totalLaborHours,
      totalLaborCost,
      totalMaterialCost,
      totalPrice,
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
    toast.info(`Sovellettava presetti: ${preset.name}. Tämä toiminto lisätään tuleville mittauksille.`);
  };

  const handleToolbarSizeChange = (newSize) => {
    setToolbarSize(newSize);
    localStorage.setItem('rakenna_toolbar_size', newSize.toString());
  };

  const toggleRightPanel = () => {
    const newState = !rightPanelOpen;
    setRightPanelOpen(newState);
    localStorage.setItem('rakenna_right_panel_open', newState.toString());
  };

  return (
    <div className="flex flex-col h-screen bg-[#F9FAFB]">
      <Toolbar
        onOpenPdf={handleOpenPdf}
        onCalibrate={() => setCalibrateDialogOpen(true)}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
        currentTool={currentTool}
        onToolSelect={setCurrentTool}
        toolbarSize={toolbarSize}
        onToolbarSizeChange={handleToolbarSizeChange}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 relative">
          <PDFViewer
            pdfFile={pdfFile}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            scale={scale}
            onScaleChange={setScale}
          />
        </div>

        {/* Toggle button */}
        <Button
          data-testid="toggle-right-panel"
          onClick={toggleRightPanel}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-20 w-6 rounded-l-lg rounded-r-none bg-[#0052CC] hover:bg-[#0043A8] p-0 shadow-lg"
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

        {/* Right panel */}
        <div 
          className="bg-white border-l border-gray-200 transition-all duration-300"
          style={{
            width: rightPanelOpen ? '384px' : '0px',
            overflow: 'hidden'
          }}
        >
          <div className="w-96">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3 rounded-none border-b border-gray-200">
                <TabsTrigger value="takeoff" data-testid="tab-takeoff">Määrälaskenta</TabsTrigger>
                <TabsTrigger value="presets" data-testid="tab-presets">Presetit</TabsTrigger>
                <TabsTrigger value="calculator" data-testid="tab-calculator">Laskenta</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="takeoff" className="h-full m-0">
                  <TakeoffPanel
                    measurements={measurements}
                    onUpdate={handleUpdateMeasurement}
                    onDelete={handleDeleteMeasurement}
                    settings={settings}
                  />
                </TabsContent>

                <TabsContent value="presets" className="h-full m-0">
                  <PresetPanel
                    presets={presets}
                    onSave={handleSavePreset}
                    onDelete={handleDeletePreset}
                    onApply={handleApplyPreset}
                  />
                </TabsContent>

                <TabsContent value="calculator" className="h-full m-0">
                  <CalculatorPanel
                    measurements={measurements}
                    settings={settings}
                    onSettingsChange={setSettings}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      <CalibrateDialog
        open={calibrateDialogOpen}
        onClose={() => setCalibrateDialogOpen(false)}
        onCalibrate={(distance) => {
          toast.success(`Mittakaava kalibroitu: ${distance}m`);
        }}
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
