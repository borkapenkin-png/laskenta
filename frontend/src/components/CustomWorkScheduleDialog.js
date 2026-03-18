import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Settings2,
  Euro
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
  const [hourlyTarget, setHourlyTarget] = useState(20);
  const [tesPrices, setTesPrices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showRatesEditor, setShowRatesEditor] = useState(false);
  const [workPhases, setWorkPhases] = useState([
    { id: 1, priceId: '', quantity: 0 }
  ]);
  
  // Load TES prices from API
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      fetch(`${API_URL}/api/presets/tes-prices`)
        .then(res => res.json())
        .then(data => {
          if (data?.prices) setTesPrices(data.prices);
          if (data?.hourlyTarget) setHourlyTarget(data.hourlyTarget);
        })
        .catch(err => console.error('Failed to load TES prices:', err))
        .finally(() => setIsLoading(false));
    }
  }, [open]);
  
  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setProjectName('');
      setWorkPhases([{ id: 1, priceId: '', quantity: 0 }]);
    }
  }, [open]);
  
  // Get price by ID
  const getPriceById = (priceId) => {
    return tesPrices.find(p => p.id === priceId);
  };
  
  // Calculate productivity rate from price
  const calculateRate = (price) => {
    if (!price || price <= 0) return 1;
    return hourlyTarget / price;
  };
  
  // Add new phase
  const handleAddPhase = () => {
    const newId = Math.max(...workPhases.map(p => p.id), 0) + 1;
    setWorkPhases([...workPhases, { id: newId, priceId: '', quantity: 0 }]);
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
  
  // Update a single TES price
  const handlePriceChange = (priceId, newPrice) => {
    const updated = tesPrices.map(p => 
      p.id === priceId ? { ...p, price: parseFloat(newPrice) || 1 } : p
    );
    setTesPrices(updated);
  };
  
  // Save TES prices to API
  const handleSavePrices = async () => {
    try {
      await fetch(`${API_URL}/api/presets/tes-prices`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices: tesPrices, hourlyTarget }),
      });
      toast.success('TES hinnat tallennettu');
    } catch (e) {
      toast.error('Virhe tallennuksessa');
    }
  };
  
  // Calculate schedule rows with hours
  const scheduleRows = useMemo(() => {
    return workPhases
      .filter(p => p.priceId && p.quantity > 0)
      .map(phase => {
        const priceData = getPriceById(phase.priceId);
        if (!priceData) return null;
        
        const rate = calculateRate(priceData.price);
        const hours = phase.quantity / rate;
        
        return {
          id: phase.id,
          name: priceData.name,
          quantity: phase.quantity,
          unit: priceData.unit,
          price: priceData.price,
          productivityRate: rate,
          hoursTotal: hours,
          daysPerWorker: hours / (workerCount * hoursPerDay)
        };
      })
      .filter(Boolean);
  }, [workPhases, tesPrices, hourlyTarget, workerCount, hoursPerDay]);
  
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
        hoursPerDay,
        hourlyTarget
      });
      toast.success('Oma työaikataulu PDF luotu');
    } catch (e) {
      console.error('PDF export failed:', e);
      toast.error('PDF:n luominen epäonnistui');
    }
  };
  
  // Group prices by category
  const pricesByCategory = useMemo(() => {
    const grouped = {};
    tesPrices.forEach(price => {
      const cat = price.category || 'Muut';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(price);
    });
    return grouped;
  }, [tesPrices]);
  
  // Add custom TES price
  const handleAddCustomPrice = () => {
    const name = prompt('Työvaihe nimi:');
    if (!name) return;
    
    const unitChoice = prompt('Yksikkö (1 = m², 2 = jm, 3 = kpl):', '1');
    const unit = unitChoice === '2' ? 'jm' : (unitChoice === '3' ? 'kpl' : 'm²');
    
    const priceValue = prompt(`TES hinta (€/${unit}):`, '10');
    const price = parseFloat(priceValue) || 10;
    
    const newPrice = {
      id: `custom-new-${Date.now()}`,
      name,
      price,
      unit,
      category: 'Custom'
    };
    
    setTesPrices(prev => [...prev, newPrice]);
    toast.success(`Lisätty: ${name}`);
  };
  
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
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-teal-600" />
            Oma työaikataulu
          </DialogTitle>
          <DialogDescription>
            Valitse työvaiheet ja syötä määrät - tunnit lasketaan TES hinnoista
          </DialogDescription>
        </DialogHeader>
        
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Project Name */}
          <div className="py-3 border-b">
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
          <div className="flex items-end gap-4 py-3 border-b flex-wrap">
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
                className="w-20 mt-1"
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
                className="w-20 mt-1"
                data-testid="custom-hours-per-day"
              />
            </div>
            <div>
              <Label className="text-sm text-gray-500 flex items-center gap-1">
                <Euro className="h-4 w-4" />
                Tuntipalkka €/h
              </Label>
              <Input
                type="number"
                min="1"
                step="0.5"
                value={hourlyTarget}
                onChange={(e) => setHourlyTarget(Math.max(1, parseFloat(e.target.value) || 20))}
                className="w-20 mt-1"
                data-testid="custom-hourly-target"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowRatesEditor(!showRatesEditor)}
              className="flex items-center gap-2"
              data-testid="toggle-rates-editor"
            >
              <Settings2 className="h-4 w-4" />
              {showRatesEditor ? 'Piilota' : 'TES hinnat'}
            </Button>
          </div>
          
          {/* TES Prices Editor */}
          {showRatesEditor && (
            <div className="py-3 border-b bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">TES hinnat (€/yksikkö) → Tuottavuus = {hourlyTarget}€ / hinta</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleAddCustomPrice}>
                    <Plus className="h-3 w-3 mr-1" />
                    Lisa oma
                  </Button>
                  <Button size="sm" onClick={handleSavePrices} className="bg-teal-600 hover:bg-teal-700">
                    Tallenna muutokset
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto">
                {tesPrices.map(price => {
                  const rate = calculateRate(price.price);
                  return (
                    <div key={price.id} className="flex items-center gap-2 bg-white p-2 rounded border">
                      <span className="flex-1 text-sm truncate" title={price.name}>{price.name}</span>
                      <Input
                        type="number"
                        step="0.5"
                        min="0.1"
                        value={price.price}
                        onChange={(e) => handlePriceChange(price.id, e.target.value)}
                        className="w-16 h-7 text-right text-sm"
                      />
                      <span className="text-xs text-gray-500 w-12">€/{price.unit}</span>
                      <span className="text-xs text-teal-600 w-16">={formatNumber(rate, 1)}/h</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Work Phases Table */}
          <div className="py-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Työvaihe</TableHead>
                  <TableHead className="w-[15%]">Määrä</TableHead>
                  <TableHead className="text-right w-[12%]">Hinta</TableHead>
                  <TableHead className="text-right w-[12%]">Tuottavuus</TableHead>
                  <TableHead className="text-right w-[12%]">Tunnit</TableHead>
                  <TableHead className="text-right w-[10%]">Päivät</TableHead>
                  <TableHead className="w-[4%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {workPhases.map((phase, idx) => {
                const selectedPrice = getPriceById(phase.priceId);
                const rate = selectedPrice ? calculateRate(selectedPrice.price) : 0;
                const hours = selectedPrice && phase.quantity > 0 
                  ? phase.quantity / rate 
                  : 0;
                const days = hours / (workerCount * hoursPerDay);
                
                return (
                  <TableRow key={phase.id}>
                    <TableCell>
                      <Select
                        value={phase.priceId}
                        onValueChange={(value) => handleUpdatePhase(phase.id, 'priceId', value)}
                      >
                        <SelectTrigger data-testid={`phase-select-${idx}`}>
                          <SelectValue placeholder="Valitse työvaihe..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(pricesByCategory).map(([category, prices]) => (
                            <div key={category}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                                {category}
                              </div>
                              {prices.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  <span className="flex items-center justify-between w-full gap-4">
                                    <span>{p.name}</span>
                                    <span className="text-xs text-gray-400">
                                      {p.price}€/{p.unit}
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
                          {selectedPrice?.unit || ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {selectedPrice ? `${formatNumber(selectedPrice.price)}€` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm text-teal-600">
                      {rate > 0 ? `${formatNumber(rate, 1)}/h` : '-'}
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
          </div>
        </div>
        
        {/* Totals - Fixed at bottom */}
        <div className="flex-shrink-0 pt-3 border-t bg-teal-50 -mx-6 px-6 py-3">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xl font-bold text-teal-700">
                {formatNumber(totals.totalHours, 0)}
              </div>
              <div className="text-xs text-gray-600">tuntia yhteensä</div>
            </div>
            <div>
              <div className="text-xl font-bold text-teal-700">
                {formatNumber(totals.totalHoursPerWorker, 0)}
              </div>
              <div className="text-xs text-gray-600">tuntia / työntekijä</div>
            </div>
            <div>
              <div className="text-xl font-bold text-teal-700">
                {formatNumber(totals.totalDays, 1)}
              </div>
              <div className="text-xs text-gray-600">työpäivää ({workerCount} hlö)</div>
            </div>
            <div>
              <div className="text-xl font-bold text-teal-700">
                {formatNumber(totals.totalWeeks, 1)}
              </div>
              <div className="text-xs text-gray-600">viikkoa</div>
            </div>
          </div>
        </div>
        
        {/* Actions - Fixed at bottom */}
        <div className="flex-shrink-0 flex justify-end gap-2 pt-3 border-t">
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
