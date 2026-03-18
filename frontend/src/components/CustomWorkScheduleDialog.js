import React, { useState, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { exportCustomWorkSchedulePDF } from '@/utils/export';

const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '0,00';
  return Number(value).toLocaleString('fi-FI', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

// Default work phases that user can choose from
const DEFAULT_PHASES = [
  'Huoltomaalaus',
  'Kipsiseinä tasoitus ja maalaus',
  'Verkkotus, tasoitus ja maalaus',
  'Tapetointi',
  'Mikrotsementi',
  'Kipsikatto tasoitus ja maalaus',
  'AK huoltomaalaus',
  'Pölysidonta',
  'Lattiamaalaus/lakkaus',
  'Lattiapinnoitus',
  'Kipsiseinä rakennus',
  'Alakatto rakennus',
  'Kotelo rakennus',
  'Oven maalaus',
  'Ikkunan maalaus',
  'Muu työ'
];

export const CustomWorkScheduleDialog = ({ open, onClose }) => {
  const [projectName, setProjectName] = useState('');
  const [workerCount, setWorkerCount] = useState(2);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [workPhases, setWorkPhases] = useState([
    { id: 1, name: '', hours: 0 }
  ]);
  
  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setProjectName('');
      setWorkPhases([{ id: 1, name: '', hours: 0 }]);
    }
  }, [open]);
  
  // Add new phase
  const handleAddPhase = () => {
    const newId = Math.max(...workPhases.map(p => p.id), 0) + 1;
    setWorkPhases([...workPhases, { id: newId, name: '', hours: 0 }]);
  };
  
  // Remove phase
  const handleRemovePhase = (id) => {
    if (workPhases.length <= 1) return;
    setWorkPhases(workPhases.filter(p => p.id !== id));
  };
  
  // Update phase
  const handleUpdatePhase = (id, field, value) => {
    setWorkPhases(workPhases.map(p => 
      p.id === id ? { ...p, [field]: field === 'hours' ? parseFloat(value) || 0 : value } : p
    ));
  };
  
  // Calculate totals
  const totals = {
    totalHours: workPhases.reduce((sum, p) => sum + (p.hours || 0), 0),
    get totalHoursPerWorker() { return this.totalHours / workerCount; },
    get totalDays() { return this.totalHours / (workerCount * hoursPerDay); },
    get totalWeeks() { return this.totalDays / 5; }
  };
  
  // Valid phases (has name and hours > 0)
  const validPhases = workPhases.filter(p => p.name && p.hours > 0);
  
  // Export PDF
  const handleExportPDF = () => {
    if (validPhases.length === 0) {
      toast.error('Lisää vähintään yksi työvaihe');
      return;
    }
    
    try {
      exportCustomWorkSchedulePDF({
        projectName: projectName || 'Oma työaikataulu',
        workPhases: validPhases,
        totals: {
          totalHours: totals.totalHours,
          totalHoursPerWorker: totals.totalHoursPerWorker,
          totalDays: totals.totalDays,
          totalWeeks: totals.totalWeeks
        },
        workerCount,
        hoursPerDay
      });
      toast.success('Oma työaikataulu PDF luotu');
    } catch (e) {
      console.error('PDF export failed:', e);
      toast.error('PDF:n luominen epäonnistui');
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-teal-600" />
            Oma työaikataulu
          </DialogTitle>
          <DialogDescription>
            Luo työaikataulu syöttämällä työvaiheet ja tunnit käsin
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
        </div>
        
        {/* Work Phases Table */}
        <ScrollArea className="flex-1 min-h-[200px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50%]">Työvaihe</TableHead>
                <TableHead className="text-right w-[25%]">Tunnit</TableHead>
                <TableHead className="text-right w-[20%]">Päivät ({workerCount} hlö)</TableHead>
                <TableHead className="w-[5%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workPhases.map((phase, idx) => (
                <TableRow key={phase.id}>
                  <TableCell>
                    <Select
                      value={phase.name}
                      onValueChange={(value) => handleUpdatePhase(phase.id, 'name', value)}
                    >
                      <SelectTrigger data-testid={`phase-name-${idx}`}>
                        <SelectValue placeholder="Valitse työvaihe..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_PHASES.map(name => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={phase.hours || ''}
                      onChange={(e) => handleUpdatePhase(phase.id, 'hours', e.target.value)}
                      placeholder="0"
                      className="text-right"
                      data-testid={`phase-hours-${idx}`}
                    />
                  </TableCell>
                  <TableCell className="text-right text-gray-500">
                    {phase.hours > 0 
                      ? formatNumber(phase.hours / (workerCount * hoursPerDay), 1) + ' pv'
                      : '-'
                    }
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
              ))}
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
            disabled={validPhases.length === 0}
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
