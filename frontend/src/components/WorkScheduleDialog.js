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
  AlertCircle
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

// Match productivity rate to measurement
const findMatchingRate = (measurement, rates) => {
  // Try exact match by label
  const exactMatch = rates.find(r => 
    r.name.toLowerCase() === measurement.label?.toLowerCase()
  );
  if (exactMatch) return exactMatch;
  
  // Try partial match
  const partialMatch = rates.find(r => 
    measurement.label?.toLowerCase().includes(r.name.toLowerCase()) ||
    r.name.toLowerCase().includes(measurement.label?.toLowerCase() || '')
  );
  if (partialMatch) return partialMatch;
  
  // Default rates based on unit
  const unit = measurement.unit || 'm²';
  if (unit === 'm²') return { rate: 8, unit: 'm²/h', name: 'Muu m² työ' };
  if (unit === 'jm') return { rate: 4, unit: 'jm/h', name: 'Muu jm työ' };
  if (unit === 'kpl') return { rate: 2, unit: 'kpl/h', name: 'Muu kpl työ' };
  
  return { rate: 5, unit: 'm²/h', name: 'Tuntematon' };
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
        measurementCount: 0
      };
    }
    
    groups[key].totalQuantity += effectiveQuantity;
    groups[key].measurementCount += 1;
  });
  
  return Object.values(groups).sort((a, b) => b.totalQuantity - a.totalQuantity);
};

export const WorkScheduleDialog = ({ open, onClose, measurements, projectName }) => {
  const [productivityRates, setProductivityRates] = useState([]);
  const [workerCount, setWorkerCount] = useState(2);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [isLoading, setIsLoading] = useState(false);
  const [showRatesEditor, setShowRatesEditor] = useState(false);
  
  // Load productivity rates from API
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      fetch(`${API_URL}/api/presets/productivity`)
        .then(res => res.json())
        .then(data => {
          if (data?.rates) {
            setProductivityRates(data.rates);
          }
        })
        .catch(err => {
          console.error('Failed to load productivity rates:', err);
          toast.error('Virhe ladattaessa tuottavuusmääriä');
        })
        .finally(() => setIsLoading(false));
    }
  }, [open]);
  
  // Group measurements
  const groupedMeasurements = useMemo(() => {
    return groupMeasurements(measurements);
  }, [measurements]);
  
  // Calculate schedule rows
  const scheduleRows = useMemo(() => {
    return groupedMeasurements.map(group => {
      const matchedRate = findMatchingRate(group, productivityRates);
      const hours = group.totalQuantity / matchedRate.rate;
      
      return {
        ...group,
        productivityRate: matchedRate.rate,
        productivityUnit: matchedRate.unit,
        matchedRateName: matchedRate.name,
        hoursTotal: hours,
        hoursPerWorker: hours / workerCount,
        daysPerWorker: hours / (workerCount * hoursPerDay)
      };
    });
  }, [groupedMeasurements, productivityRates, workerCount, hoursPerDay]);
  
  // Calculate totals
  const totals = useMemo(() => {
    const totalHours = scheduleRows.reduce((sum, row) => sum + row.hoursTotal, 0);
    const totalHoursPerWorker = totalHours / workerCount;
    const totalDays = totalHours / (workerCount * hoursPerDay);
    const totalWeeks = totalDays / 5; // 5 workdays per week
    
    return {
      totalHours,
      totalHoursPerWorker,
      totalDays,
      totalWeeks
    };
  }, [scheduleRows, workerCount, hoursPerDay]);
  
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
  
  // Export PDF
  const handleExportPDF = () => {
    try {
      exportWorkSchedulePDF({
        projectName: projectName || 'Projekti',
        scheduleRows,
        totals,
        workerCount,
        hoursPerDay
      });
      toast.success('Töögraafik PDF luotu');
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
            Töögraafik
          </DialogTitle>
          <DialogDescription>
            Arvioitu tööaeg perustuu mittauksiin ja tuottavuusmääriin
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
            <div className="flex items-end gap-4 py-4 border-b">
              <div className="flex-1">
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
                  data-testid="worker-count-input"
                />
              </div>
              <div className="flex-1">
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
                  data-testid="hours-per-day-input"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowRatesEditor(!showRatesEditor)}
                className="flex items-center gap-2"
                data-testid="toggle-rates-editor"
              >
                <Settings2 className="h-4 w-4" />
                {showRatesEditor ? 'Piilota määrät' : 'Muokkaa tuottavuutta'}
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
                <ScrollArea className="h-[200px]">
                  <div className="grid grid-cols-2 gap-3">
                    {productivityRates.map(rate => (
                      <div key={rate.id} className="flex items-center gap-2 bg-white p-2 rounded border">
                        <span className="flex-1 text-sm truncate" title={rate.name}>{rate.name}</span>
                        <Input
                          type="number"
                          step="0.5"
                          min="0.1"
                          value={rate.rate}
                          onChange={(e) => handleRateChange(rate.id, e.target.value)}
                          className="w-20 h-8 text-right"
                        />
                        <span className="text-xs text-gray-500 w-12">{rate.unit}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            
            {/* Schedule Table */}
            <ScrollArea className="flex-1 min-h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[35%]">Työvaihe</TableHead>
                    <TableHead className="text-right">Määrä</TableHead>
                    <TableHead className="text-right">Tuottavuus</TableHead>
                    <TableHead className="text-right">Tunnit yht.</TableHead>
                    <TableHead className="text-right">Päivät ({workerCount} hlö)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduleRows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        <div>{row.label}</div>
                        {row.label !== row.matchedRateName && (
                          <div className="text-xs text-gray-400">→ {row.matchedRateName}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.totalQuantity)} {row.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.productivityRate, 1)} {row.productivityUnit}
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
