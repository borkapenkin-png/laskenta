import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Calendar, 
  Clock, 
  Users, 
  FileDown,
  Plus,
  Trash2,
  Settings2
} from 'lucide-react';
import { toast } from 'sonner';
import { exportCustomWorkSchedulePDF } from '@/utils/export';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '0,00';
  return Number(value).toLocaleString('fi-FI', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

export const CustomWorkScheduleDialog = ({ open, onClose }) => {
  const [projectName, setProjectName] = useState('');
  const [workerCount, setWorkerCount] = useState(2);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [productivityRates, setProductivityRates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showRatesEditor, setShowRatesEditor] = useState(false);
  const [workPhases, setWorkPhases] = useState([
    { id: 1, rateId: '', quantity: 0 }
  ]);
  
  // Load productivity rates from API
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      fetch(`${API_URL}/api/presets/productivity`)
        .then(res => res.json())
        .then(data => {
          if (data?.rates) setProductivityRates(data.rates);
        })
        .catch(err => console.error('Failed to load rates:', err))
        .finally(() => setIsLoading(false));
    }
  }, [open]);
  
  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setProjectName('');
      setWorkPhases([{ id: 1, rateId: '', quantity: 0 }]);
    }
  }, [open]);
  
  // Get rate by ID
  const getRateById = (rateId) => {
    return productivityRates.find(r => r.id === rateId);
  };
  
  // Add new phase
  const handleAddPhase = () => {
    const newId = Math.max(...workPhases.map(p => p.id), 0) + 1;
    setWorkPhases([...workPhases, { id: newId, rateId: '', quantity: 0 }]);
  };
  
  // Remove phase
  const handleRemovePhase = (id) => {
    if (workPhases.length <= 1) return;
    setWorkPhases(workPhases.filter(p => p.id !== id));
  };
  
  // Update phase
  const handleUpdatePhase = (id, field, value) => {
    setWorkPhases(workPhases.map(p => 
      p.id === id ? { ...p, [field]: field === 'quantity' ? parseFloat(value) || 0 : value } : p
    ));
  };
  
  // Update a single rate
  const handleRateChange = (rateId, newRate) => {
    const updated = productivityRates.map(r => 
      r.id === rateId ? { ...r, rate: parseFloat(newRate) || 1 } : r
    );
    setProductivityRates(updated);
  };
  
  // Save rates to API
  const handleSaveRates = async () => {
    try {
      await fetch(`${API_URL}/api/presets/productivity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rates: productivityRates }),
      });
      toast.success('Tuottavuusmäärät tallennettu');
    } catch (e) {
      toast.error('Virhe tallennuksessa');
    }
  };
  
  // Calculate schedule rows with hours
  const scheduleRows = useMemo(() => {
    return workPhases
      .filter(p => p.rateId && p.quantity > 0)
      .map(phase => {
        const rate = getRateById(phase.rateId);
        if (!rate) return null;
        
        const hours = phase.quantity / rate.rate;
        return {
          id: phase.id,
          name: rate.name,
          quantity: phase.quantity,
          unit: rate.unit.replace('/h', ''),
          productivityRate: rate.rate,
          productivityUnit: rate.unit,
          hoursTotal: hours,
          daysPerWorker: hours / (workerCount * hoursPerDay)
        };
      })
      .filter(Boolean);
  }, [workPhases, productivityRates, workerCount, hoursPerDay]);
  
  // Calculate totals
  const totals = useMemo(() => {
    const totalHours = scheduleRows.reduce((sum, r) => sum + r.hoursTotal, 0);
    return {
      totalHours,
      totalHoursPerWorker: totalHours / workerCount,
      totalDays: totalHours / (workerCount * hoursPerDay),
      totalWeeks: totalHours / (workerCount * hoursPerDay * 5)
    };
  }, [scheduleRows, workerCount, hoursPerDay]);
  
  // Export PDF
  const handleExportPDF = () => {
    if (scheduleRows.length === 0) {
      toast.error('Lisää vähintään yksi työvaihe');
      return;
    }
    
    try {
      exportCustomWorkSchedulePDF({
        projectName: projectName || 'Oma työaikataulu',
        scheduleRows,
        totals,
        workerCount,
        hoursPerDay
      });
      toast.success('Oma työaikataulu PDF luotu');
    } catch (e) {
      console.error('PDF export failed:', e);
      toast.error('PDF:n luominen epäonnistui');
    }
  };
  
  // Group rates by category for better selection UX
  const ratesByCategory = useMemo(() => {
    const grouped = {};
    productivityRates.forEach(rate => {
      const cat = rate.category || 'Muut';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(rate);
    });
    return grouped;
  }, [productivityRates]);
  
  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-teal-600" />
            Oma työaikataulu
          </DialogTitle>
          <DialogDescription>
            Valitse työvaiheet ja syötä määrät - tunnit lasketaan automaattisesti
          </DialogDescription>
        </DialogHeader>
        
        {/* Project Name */}
        <div className="py-4 border-b">
          <Label className="text-sm text-gray-500">Projektin nimi</Label>
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Esim. Kerrostalo A, rappaus"
            className="mt-1"
            data-testid="custom-project-name"
          />
        </div>
        
        {/* Settings Row */}
        <div className="flex items-end gap-4 py-4 border-b">
          <div>
            <Label className="text-sm text-gray-500 flex items-center gap-1">
              <Users className="h-4 w-4" />
              Työntekijämäärä
            </Label>
            <Input
              type="number"
              min="1"
              max="20"
              value={workerCount}
              onChange={(e) => setWorkerCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 mt-1"
              data-testid="custom-worker-count"
            />
          </div>
          <div>
            <Label className="text-sm text-gray-500 flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Tuntia/päivä
            </Label>
            <Input
              type="number"
              min="1"
              max="12"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(Math.max(1, parseInt(e.target.value) || 8))}
              className="w-24 mt-1"
              data-testid="custom-hours-per-day"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowRatesEditor(!showRatesEditor)}
            className="flex items-center gap-2"
            data-testid="toggle-rates-editor"
          >
            <Settings2 className="h-4 w-4" />
            {showRatesEditor ? 'Piilota' : 'Tuottavuusmäärät'}
          </Button>
        </div>
        
        {/* Productivity Rates Editor */}
        {showRatesEditor && (
          <div className="py-4 border-b bg-gray-50 -mx-6 px-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Tuottavuusmäärät (maalaus TES)</h3>
              <Button size="sm" onClick={handleSaveRates} className="bg-teal-600 hover:bg-teal-700">
                Tallenna muutokset
              </Button>
            </div>
            <ScrollArea className="h-[180px]">
              <div className="grid grid-cols-2 gap-2">
                {productivityRates.map(rate => (
                  <div key={rate.id} className="flex items-center gap-2 bg-white p-2 rounded border">
                    <span className="flex-1 text-sm truncate" title={rate.name}>{rate.name}</span>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.1"
                      value={rate.rate}
                      onChange={(e) => handleRateChange(rate.id, e.target.value)}
                      className="w-16 h-7 text-right text-sm"
                    />
                    <span className="text-xs text-gray-500 w-10">{rate.unit}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        
        {/* Work Phases Input */}
        <ScrollArea className="flex-1 min-h-[200px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[45%]">Työvaihe</TableHead>
                <TableHead className="w-[20%]">Määrä</TableHead>
                <TableHead className="text-right w-[15%]">Tunnit</TableHead>
                <TableHead className="text-right w-[15%]">Päivät</TableHead>
                <TableHead className="w-[5%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workPhases.map((phase, idx) => {
                const selectedRate = getRateById(phase.rateId);
                const hours = selectedRate && phase.quantity > 0 
                  ? phase.quantity / selectedRate.rate 
                  : 0;
                const days = hours / (workerCount * hoursPerDay);
                
                return (
                  <TableRow key={phase.id}>
                    <TableCell>
                      <Select
                        value={phase.rateId}
                        onValueChange={(value) => handleUpdatePhase(phase.id, 'rateId', value)}
                      >
                        <SelectTrigger data-testid={`phase-select-${idx}`}>
                          <SelectValue placeholder="Valitse työvaihe..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ratesByCategory).map(([category, rates]) => (
                            <div key={category}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                                {category}
                              </div>
                              {rates.map(rate => (
                                <SelectItem key={rate.id} value={rate.id}>
                                  <span className="flex items-center justify-between w-full gap-4">
                                    <span>{rate.name}</span>
                                    <span className="text-xs text-gray-400">
                                      {rate.rate} {rate.unit}
                                    </span>
                                  </span>
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={phase.quantity || ''}
                          onChange={(e) => handleUpdatePhase(phase.id, 'quantity', e.target.value)}
                          placeholder="0"
                          className="w-20 text-right"
                          data-testid={`phase-quantity-${idx}`}
                        />
                        <span className="text-sm text-gray-500 w-8">
                          {selectedRate ? selectedRate.unit.replace('/h', '') : ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {hours > 0 ? `${formatNumber(hours, 1)} h` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-gray-500">
                      {days > 0 ? `${formatNumber(days, 1)} pv` : '-'}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleRemovePhase(phase.id)}
                        disabled={workPhases.length <= 1}
                        className="text-gray-400 hover:text-red-500 disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddPhase}
            className="mt-2 text-teal-600 hover:text-teal-700"
            data-testid="add-phase-btn"
          >
            <Plus className="h-4 w-4 mr-1" />
            Lisää työvaihe
          </Button>
        </ScrollArea>
        
        {/* Totals */}
        <div className="pt-4 border-t bg-teal-50 -mx-6 px-6 py-4 rounded-b-lg">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-teal-700">
                {formatNumber(totals.totalHours, 0)}
              </div>
              <div className="text-sm text-gray-600">tuntia yhteensä</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-teal-700">
                {formatNumber(totals.totalHoursPerWorker, 0)}
              </div>
              <div className="text-sm text-gray-600">tuntia / työntekijä</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-teal-700">
                {formatNumber(totals.totalDays, 1)}
              </div>
              <div className="text-sm text-gray-600">työpäivää ({workerCount} hlö)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-teal-700">
                {formatNumber(totals.totalWeeks, 1)}
              </div>
              <div className="text-sm text-gray-600">viikkoa</div>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Sulje
          </Button>
          <Button 
            onClick={handleExportPDF}
            disabled={scheduleRows.length === 0}
            className="bg-teal-600 hover:bg-teal-700"
            data-testid="export-custom-schedule-pdf"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Lataa PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
