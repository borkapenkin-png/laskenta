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
  Calendar, 
  Clock, 
  Users, 
  FileDown,
  Settings2,
  AlertCircle,
  Euro,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { exportWorkSchedulePDF } from '@/utils/export';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helper to format numbers Finnish style
const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '0,00';
  return Number(value).toLocaleString('fi-FI', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

// Find matching TES price for measurement
const findMatchingPrice = (measurement, tesPrices, hourlyTarget) => {
  const label = measurement.label?.toLowerCase() || '';
  
  // Try exact match by label
  const exactMatch = tesPrices.find(p => p.name.toLowerCase() === label);
  if (exactMatch) {
    const rate = hourlyTarget / exactMatch.price;
    return { ...exactMatch, rate };
  }
  
  // Try partial match
  const partialMatch = tesPrices.find(p => 
    label.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(label)
  );
  if (partialMatch) {
    const rate = hourlyTarget / partialMatch.price;
    return { ...partialMatch, rate };
  }
  
  // Default based on unit - assume 10€/unit price
  const unit = measurement.unit || 'm²';
  const defaultPrice = unit === 'm²' ? 10 : (unit === 'jm' ? 15 : 40);
  const rate = hourlyTarget / defaultPrice;
  
  return { 
    name: 'Muu työ', 
    price: defaultPrice, 
    unit, 
    rate,
    category: 'Muu'
  };
};

// Group measurements by label and calculate effective quantities
const groupMeasurements = (measurements) => {
  const groups = {};
  
  measurements.forEach(m => {
    let effectiveQuantity = m.quantity || 0;
    
    // Calculate effective quantity for walls
    if (m.type === 'wall' && m.wallHeight) {
      const bruttoM2 = effectiveQuantity * m.wallHeight * (m.bothSides ? 2 : 1);
      const openings = m.openings || 0;
      effectiveQuantity = bruttoM2 - openings;
    }
    
    // For Pystykotelot: kpl × height = jm
    if ((m.isPystykotelot || m.isKuivatilaPystykotelo || m.isPRHPystykotelo) && m.wallHeight) {
      effectiveQuantity = m.quantity * m.wallHeight;
    }
    
    const label = m.label || 'Muu';
    const unit = m.unit || 'm²';
    const key = `${label}__${unit}`;
    
    if (!groups[key]) {
      groups[key] = {
        label,
        unit,
        totalQuantity: 0,
        measurementCount: 0,
        pricePerUnit: m.pricePerUnit || 0
      };
    }
    
    groups[key].totalQuantity += effectiveQuantity;
    groups[key].measurementCount += 1;
    // Use the price from measurement if available
    if (m.pricePerUnit) {
      groups[key].pricePerUnit = m.pricePerUnit;
    }
  });
  
  return Object.values(groups).sort((a, b) => b.totalQuantity - a.totalQuantity);
};

export const WorkScheduleDialog = ({ open, onClose, measurements, projectName }) => {
  const [tesPrices, setTesPrices] = useState([]);
  const [hourlyTarget, setHourlyTarget] = useState(20);
  const [workerCount, setWorkerCount] = useState(2);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [isLoading, setIsLoading] = useState(false);
  const [showRatesEditor, setShowRatesEditor] = useState(false);
  
  // Load TES prices from API
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      fetch(`${API_URL}/api/presets/tes-prices`)
        .then(res => res.json())
        .then(data => {
          let prices = data?.prices || [];
          const target = data?.hourlyTarget || 20;
          setHourlyTarget(target);
          
          // Add custom labels from measurements that aren't in TES prices
          const existingNames = new Set(prices.map(p => p.name.toLowerCase()));
          
          measurements.forEach(m => {
            const label = m.label || '';
            if (label && !existingNames.has(label.toLowerCase())) {
              const unit = m.unit || 'm²';
              // Use measurement price or default
              const price = m.pricePerUnit || (unit === 'm²' ? 10 : (unit === 'jm' ? 15 : 40));
              
              prices.push({
                id: `measurement-${prices.length + 1}`,
                name: label,
                price: price,
                unit: unit,
                category: 'Custom'
              });
              existingNames.add(label.toLowerCase());
            }
          });
          
          setTesPrices(prices);
        })
        .catch(err => {
          console.error('Failed to load TES prices:', err);
          toast.error('Virhe ladattaessa TES hintoja');
        })
        .finally(() => setIsLoading(false));
    }
  }, [open, measurements]);
  
  // Group measurements
  const groupedMeasurements = useMemo(() => {
    return groupMeasurements(measurements);
  }, [measurements]);
  
  // Calculate schedule rows
  const scheduleRows = useMemo(() => {
    return groupedMeasurements.map(group => {
      const matched = findMatchingPrice(group, tesPrices, hourlyTarget);
      const hours = group.totalQuantity / matched.rate;
      
      return {
        ...group,
        price: matched.price,
        productivityRate: matched.rate,
        matchedName: matched.name,
        hoursTotal: hours,
        hoursPerWorker: hours / workerCount,
        daysPerWorker: hours / (workerCount * hoursPerDay)
      };
    });
  }, [groupedMeasurements, tesPrices, hourlyTarget, workerCount, hoursPerDay]);
  
  // Calculate totals
  const totals = useMemo(() => {
    const totalHours = scheduleRows.reduce((sum, row) => sum + row.hoursTotal, 0);
    const totalHoursPerWorker = totalHours / workerCount;
    const totalDays = totalHours / (workerCount * hoursPerDay);
    const totalWeeks = totalDays / 5;
    
    return { totalHours, totalHoursPerWorker, totalDays, totalWeeks };
  }, [scheduleRows, workerCount, hoursPerDay]);
  
  // Update a single TES price
  const handlePriceChange = (priceId, newPrice) => {
    setTesPrices(prev => prev.map(p => 
      p.id === priceId ? { ...p, price: parseFloat(newPrice) || 1 } : p
    ));
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
  
  // Add custom TES price
  const handleAddCustomPrice = () => {
    const name = prompt('Työvaihe nimi:');
    if (!name) return;
    
    const unitChoice = prompt('Yksikkö (1 = m², 2 = jm, 3 = kpl):', '1');
    const unit = unitChoice === '2' ? 'jm' : (unitChoice === '3' ? 'kpl' : 'm²');
    
    const priceValue = prompt(`TES hinta (€/${unit}):`, '10');
    const price = parseFloat(priceValue) || 10;
    
    setTesPrices(prev => [...prev, {
      id: `custom-new-${Date.now()}`,
      name,
      price,
      unit,
      category: 'Custom'
    }]);
    toast.success(`Lisätty: ${name}`);
  };
  
  // Export PDF
  const handleExportPDF = () => {
    try {
      exportWorkSchedulePDF({
        projectName: projectName || 'Projekti',
        scheduleRows,
        totals,
        workerCount,
        hoursPerDay,
        hourlyTarget
      });
      toast.success('Työaikataulu PDF luotu');
    } catch (e) {
      console.error('PDF export failed:', e);
      toast.error('PDF:n luominen epäonnistui');
    }
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-teal-600" />
            Työaikataulu
          </DialogTitle>
          <DialogDescription>
            Arvioitu työaika perustuu mittauksiin ja TES hintoihin (tuottavuus = {hourlyTarget}€ / hinta)
          </DialogDescription>
        </DialogHeader>
        
        {measurements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <AlertCircle className="h-12 w-12 mb-4" />
            <p>Ei mittauksia. Lisää mittauksia projektiin ensin.</p>
          </div>
        ) : (
          <>
            {/* Settings Row */}
            <div className="flex items-end gap-4 py-4 border-b flex-wrap">
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
                  data-testid="worker-count-input"
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
                  data-testid="hours-per-day-input"
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
                  data-testid="hourly-target-input"
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
              <div className="py-4 border-b bg-gray-50 -mx-6 px-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-sm">TES hinnat (€/yksikkö)</h3>
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
                <ScrollArea className="h-[200px]">
                  <div className="grid grid-cols-2 gap-2">
                    {tesPrices.map(price => {
                      const rate = hourlyTarget / (price.price || 1);
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
                </ScrollArea>
              </div>
            )}
            
            {/* Schedule Table */}
            <ScrollArea className="flex-1 min-h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Työvaihe</TableHead>
                    <TableHead className="text-right">Määrä</TableHead>
                    <TableHead className="text-right">Hinta</TableHead>
                    <TableHead className="text-right">Tuottavuus</TableHead>
                    <TableHead className="text-right">Tunnit</TableHead>
                    <TableHead className="text-right">Päivät ({workerCount} hlö)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduleRows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        <div>{row.label}</div>
                        {row.label !== row.matchedName && row.matchedName !== 'Muu työ' && (
                          <div className="text-xs text-gray-400">→ {row.matchedName}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.totalQuantity)} {row.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.price)}€/{row.unit}
                      </TableCell>
                      <TableCell className="text-right text-teal-600">
                        {formatNumber(row.productivityRate, 1)} {row.unit}/h
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(row.hoursTotal, 1)} h
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.daysPerWorker, 1)} pv
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                className="bg-teal-600 hover:bg-teal-700"
                data-testid="export-schedule-pdf"
              >
                <FileDown className="h-4 w-4 mr-2" />
                Lataa PDF
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
