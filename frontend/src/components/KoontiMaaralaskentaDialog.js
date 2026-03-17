import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Trash2, Upload, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react';

// Reuse parser from KoontitarjousDialog logic
const parseProjectJSON = (jsonData, fileName) => {
  try {
    const projectName = jsonData.project?.name || jsonData.name || fileName.replace('.json', '');
    const measurements = jsonData.measurements || jsonData.objects || [];
    const settings = jsonData.settings || {};
    
    if (!measurements || measurements.length === 0) {
      return { success: false, error: 'Projektissa ei ole mittauksia', fileName };
    }
    
    const operations = [];
    measurements.forEach(m => {
      const label = m.label || m.preset?.name || 'Tuntematon';
      const unit = m.unit || m.preset?.unit || 'm²';
      const pricePerUnit = m.pricePerUnit ?? m.preset?.price ?? 0;
      
      let quantity = 0;
      if (m.quantity !== undefined && m.quantity > 0) {
        quantity = m.quantity;
        if (m.type === 'wall' && m.wallHeight) {
          const bothSidesFactor = m.bothSides ? 2 : 1;
          quantity = quantity * m.wallHeight * bothSidesFactor - (m.openings || 0);
        } else if ((m.isPystykotelot || m.constructionType?.includes('Pystykotelo')) && m.wallHeight) {
          quantity = m.quantity * m.wallHeight;
        }
      } else if (m.calculatedValue !== undefined) {
        quantity = m.calculatedValue;
      } else if (m.area !== undefined) {
        quantity = m.area;
      } else if (m.length !== undefined) {
        quantity = m.length;
      } else if (m.count !== undefined) {
        quantity = m.count;
      } else if (m.value !== undefined) {
        quantity = m.value;
      }
      
      if (quantity <= 0) return;
      
      operations.push({ label, quantity, unit, pricePerUnit, totalCost: quantity * pricePerUnit });
    });
    
    if (operations.length === 0) {
      return { success: false, error: 'Ei löytynyt laskettavia rivejä', fileName };
    }
    
    const totalCost = operations.reduce((sum, op) => sum + op.totalCost, 0);
    return { success: true, fileName, projectName, operations, totalCost, settings };
  } catch (error) {
    return { success: false, error: `Virhe: ${error.message}`, fileName };
  }
};

const mergeOperations = (projects) => {
  const mergedMap = new Map();
  projects.forEach(project => {
    if (!project.success) return;
    project.operations.forEach(op => {
      const key = `${op.label}|${op.unit}|${op.pricePerUnit}`;
      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key);
        existing.quantity += op.quantity;
        existing.totalCost = existing.quantity * existing.pricePerUnit;
      } else {
        mergedMap.set(key, { ...op });
      }
    });
  });
  return Array.from(mergedMap.values());
};

const formatNumber = (value) => {
  return new Intl.NumberFormat('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(value || 0);
};

export const KoontiMaaralaskentaDialog = ({ open, onClose, onGenerate, vatPercentage = 25.5 }) => {
  const fileInputRef = useRef(null);
  const [loadedProjects, setLoadedProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [includePrices, setIncludePrices] = useState('with-prices');
  const [projectTitle, setProjectTitle] = useState('');

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    setIsLoading(true);
    
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          const text = await file.text();
          const jsonData = JSON.parse(text);
          return parseProjectJSON(jsonData, file.name);
        } catch {
          return { success: false, error: 'Virheellinen JSON-tiedosto', fileName: file.name };
        }
      })
    );
    
    const projectsWithIds = results.map((result, index) => ({
      ...result,
      id: `project-${Date.now()}-${index}`,
      editableTitle: result.projectName || result.fileName
    }));
    
    setLoadedProjects(prev => [...prev, ...projectsWithIds]);
    setIsLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveProject = (projectId) => {
    setLoadedProjects(prev => prev.filter(p => p.id !== projectId));
  };

  const handleTitleChange = (projectId, newTitle) => {
    setLoadedProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, editableTitle: newTitle } : p
    ));
  };

  const successfulProjects = loadedProjects.filter(p => p.success);
  const mergedOperations = mergeOperations(successfulProjects);
  const totalCostAlv0 = mergedOperations.reduce((sum, op) => sum + op.totalCost, 0);
  const vatAmount = totalCostAlv0 * vatPercentage / 100;
  const totalWithVat = totalCostAlv0 + vatAmount;

  const handleGenerate = () => {
    if (successfulProjects.length === 0) return;
    onGenerate({
      title: projectTitle || 'Koonti määrälaskenta',
      loadedProjects: successfulProjects.map(p => ({
        title: p.editableTitle,
        operations: p.operations,
        totalCost: p.totalCost,
      })),
      mergedOperations,
      totalCostAlv0,
      vatAmount,
      totalWithVat,
      vatPercentage,
      includePrices: includePrices === 'with-prices',
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="koonti-maaralaskenta-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#4A9BAD]">
            Koonti määrälaskenta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <Label className="text-sm font-semibold">Otsikko</Label>
            <Input
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Koonti määrälaskenta"
              className="mt-1"
              data-testid="koonti-title-input"
            />
          </div>

          {/* File upload */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Lataa projektit</Label>
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#4A9BAD] transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              data-testid="koonti-file-upload"
            >
              <Upload className="w-10 h-10 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">Klikkaa ladataksesi projekti-JSON tiedostoja</p>
              <p className="text-xs text-gray-400 mt-1">Voit valita useita tiedostoja kerralla</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Loaded projects */}
          {loadedProjects.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold">Ladatut projektit ({successfulProjects.length})</Label>
                <Button variant="ghost" size="sm" onClick={() => setLoadedProjects([])} className="text-red-500 text-xs">
                  Poista kaikki
                </Button>
              </div>
              {loadedProjects.map(project => (
                <div key={project.id} className={`flex items-center gap-2 p-2 rounded-lg border ${project.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  {project.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  )}
                  <FileJson className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  {project.success ? (
                    <Input
                      value={project.editableTitle}
                      onChange={(e) => handleTitleChange(project.id, e.target.value)}
                      className="h-7 text-sm flex-1"
                    />
                  ) : (
                    <span className="text-sm text-red-600 flex-1">{project.fileName}: {project.error}</span>
                  )}
                  {project.success && (
                    <span className="text-xs text-gray-500 flex-shrink-0">{project.operations.length} rivi{project.operations.length !== 1 ? 'a' : ''}</span>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveProject(project.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Options */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Sisältö</Label>
            <RadioGroup value={includePrices} onValueChange={setIncludePrices}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="with-prices" id="with-prices" />
                <Label htmlFor="with-prices" className="text-sm">Määrät ja hinnat</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="quantities-only" id="quantities-only" />
                <Label htmlFor="quantities-only" className="text-sm">Vain määrät</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Preview */}
          {mergedOperations.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-[#4A9BAD] text-white px-3 py-2 text-sm font-semibold">
                Esikatselu - Yhdistetyt määrät
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium">Työ</th>
                      <th className="text-right px-3 py-1.5 font-medium">Määrä</th>
                      <th className="text-left px-3 py-1.5 font-medium">Yks.</th>
                      {includePrices === 'with-prices' && (
                        <>
                          <th className="text-right px-3 py-1.5 font-medium">€/yks</th>
                          <th className="text-right px-3 py-1.5 font-medium">Yhteensä</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {mergedOperations.map((op, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-1.5">{op.label}</td>
                        <td className="text-right px-3 py-1.5">{formatNumber(op.quantity)}</td>
                        <td className="px-3 py-1.5">{op.unit}</td>
                        {includePrices === 'with-prices' && (
                          <>
                            <td className="text-right px-3 py-1.5">{formatNumber(op.pricePerUnit)}</td>
                            <td className="text-right px-3 py-1.5">{formatCurrency(op.totalCost)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {includePrices === 'with-prices' && (
                <div className="border-t bg-gray-50 px-3 py-2 flex justify-between text-sm">
                  <span className="font-semibold">Yhteensä (ALV 0%)</span>
                  <span className="font-semibold">{formatCurrency(totalCostAlv0)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Peruuta</Button>
          <Button 
            onClick={handleGenerate}
            disabled={successfulProjects.length === 0}
            className="bg-[#4A9BAD] hover:bg-[#3d8a9c] text-white"
            data-testid="koonti-generate-btn"
          >
            Luo PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
