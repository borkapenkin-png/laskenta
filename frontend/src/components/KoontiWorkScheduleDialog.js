import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Upload,
  Trash2,
  FileText,
  Send,
  X,
  Plus,
  Mail
} from 'lucide-react';
import { toast } from 'sonner';
import { exportKoontiWorkSchedulePDF } from '@/utils/export';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '0,00';
  return Number(value).toLocaleString('fi-FI', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

// Match productivity rate to measurement
const findMatchingRate = (measurement, rates) => {
  const exactMatch = rates.find(r => 
    r.name.toLowerCase() === measurement.label?.toLowerCase()
  );
  if (exactMatch) return exactMatch;
  
  const partialMatch = rates.find(r => 
    measurement.label?.toLowerCase().includes(r.name.toLowerCase()) ||
    r.name.toLowerCase().includes(measurement.label?.toLowerCase() || '')
  );
  if (partialMatch) return partialMatch;
  
  const unit = measurement.unit || 'm²';
  if (unit === 'm²') return { rate: 8, unit: 'm²/h', name: 'Muu m² työ' };
  if (unit === 'jm') return { rate: 4, unit: 'jm/h', name: 'Muu jm työ' };
  if (unit === 'kpl') return { rate: 2, unit: 'kpl/h', name: 'Muu kpl työ' };
  
  return { rate: 5, unit: 'm²/h', name: 'Tuntematon' };
};

// Group measurements by label
const groupMeasurements = (measurements) => {
  const groups = {};
  
  measurements.forEach(m => {
    let effectiveQuantity = m.quantity || 0;
    
    if (m.type === 'wall' && m.wallHeight) {
      const bruttoM2 = effectiveQuantity * m.wallHeight * (m.bothSides ? 2 : 1);
      const openings = m.openings || 0;
      effectiveQuantity = bruttoM2 - openings;
    }
    
    if ((m.isPystykotelot || m.isKuivatilaPystykotelo || m.isPRHPystykotelo) && m.wallHeight) {
      effectiveQuantity = m.quantity * m.wallHeight;
    }
    
    const label = m.label || 'Muu';
    const unit = m.unit || 'm²';
    const key = `${label}__${unit}`;
    
    if (!groups[key]) {
      groups[key] = { label, unit, totalQuantity: 0, measurementCount: 0 };
    }
    
    groups[key].totalQuantity += effectiveQuantity;
    groups[key].measurementCount += 1;
  });
  
  return Object.values(groups).sort((a, b) => b.totalQuantity - a.totalQuantity);
};

// Process a single project
const processProject = (project, rates) => {
  // Support both old (measurements) and new (objects) format
  const measurements = project.measurements || project.objects || [];
  const grouped = groupMeasurements(measurements);
  const rows = grouped.map(group => {
    const matchedRate = findMatchingRate(group, rates);
    const hours = group.totalQuantity / matchedRate.rate;
    return {
      ...group,
      productivityRate: matchedRate.rate,
      productivityUnit: matchedRate.unit,
      hoursTotal: hours
    };
  });
  
  const totalHours = rows.reduce((sum, r) => sum + r.hoursTotal, 0);
  
  // Support both old (project.name) and new (meta.name) format
  const projectName = project.project?.name || project.meta?.name || 'Tuntematon projekti';
  
  return {
    name: projectName,
    rows,
    totalHours
  };
};

export const KoontiWorkScheduleDialog = ({ open, onClose }) => {
  const [productivityRates, setProductivityRates] = useState([]);
  const [loadedProjects, setLoadedProjects] = useState([]);
  const [workerCount, setWorkerCount] = useState(2);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  
  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState([{ name: '', email: '' }]);
  const [kohdeOsoite, setKohdeOsoite] = useState('');
  const [tyonjohtaja, setTyonjohtaja] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  
  // Load productivity rates
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
  
  // Handle file upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          
          // Support both old format (project/measurements) and new format (meta/objects)
          const normalizedData = {
            project: data.project || data.meta || { name: file.name.replace('.json', '') },
            measurements: data.measurements || data.objects || [],
            scale: data.scale
          };
          
          setLoadedProjects(prev => [...prev, normalizedData]);
          toast.success(`Ladattu: ${normalizedData.project?.name || file.name}`);
        } catch (err) {
          toast.error(`Virhe tiedostossa: ${file.name}`);
        }
      };
      reader.readAsText(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  // Remove project
  const handleRemoveProject = (index) => {
    setLoadedProjects(prev => prev.filter((_, i) => i !== index));
  };
  
  // Process all loaded projects and extract custom labels
  const processedProjects = useMemo(() => {
    // First, extract all unique labels from loaded projects
    const existingNames = new Set(productivityRates.map(r => r.name.toLowerCase()));
    const customRates = [];
    
    loadedProjects.forEach(project => {
      // Support both old (measurements) and new (objects) format
      const measurements = project.measurements || project.objects || [];
      measurements.forEach(m => {
        const label = m.label || '';
        if (label && !existingNames.has(label.toLowerCase())) {
          const unit = m.unit || 'm²';
          const unitRate = unit === 'm²' ? 'm²/h' : (unit === 'jm' ? 'jm/h' : 'kpl/h');
          const defaultRate = unit === 'm²' ? 8.0 : (unit === 'jm' ? 4.0 : 2.0);
          
          customRates.push({
            id: `project-custom-${customRates.length + 1}`,
            name: label,
            rate: defaultRate,
            unit: unitRate,
            category: 'Custom'
          });
          existingNames.add(label.toLowerCase());
        }
      });
    });
    
    // Merge custom rates with existing rates for processing
    const allRates = [...productivityRates, ...customRates];
    
    return loadedProjects.map(p => processProject(p, allRates));
  }, [loadedProjects, productivityRates]);
  
  // Calculate grand totals
  const grandTotals = useMemo(() => {
    const totalHours = processedProjects.reduce((sum, p) => sum + p.totalHours, 0);
    return {
      totalHours,
      totalHoursPerWorker: totalHours / workerCount,
      totalDays: totalHours / (workerCount * hoursPerDay),
      totalWeeks: totalHours / (workerCount * hoursPerDay * 5)
    };
  }, [processedProjects, workerCount, hoursPerDay]);
  
  // Export PDF
  const handleExportPDF = () => {
    try {
      exportKoontiWorkSchedulePDF({
        projects: processedProjects,
        totals: grandTotals,
        workerCount,
        hoursPerDay
      });
      toast.success('Koonti työaikataulu PDF luotu');
    } catch (e) {
      console.error('PDF export failed:', e);
      toast.error('PDF:n luominen epäonnistui');
    }
  };
  
  // Email helpers
  const handleAddRecipient = () => {
    setEmailRecipients([...emailRecipients, { name: '', email: '' }]);
  };
  
  const handleRemoveRecipient = (index) => {
    if (emailRecipients.length > 1) {
      setEmailRecipients(emailRecipients.filter((_, i) => i !== index));
    }
  };
  
  const handleRecipientChange = (index, field, value) => {
    const newRecipients = [...emailRecipients];
    newRecipients[index] = { ...newRecipients[index], [field]: value };
    setEmailRecipients(newRecipients);
  };
  
  // Send urakkamääräys email
  const handleSendUrakkatyomaarays = async () => {
    if (processedProjects.length === 0) {
      toast.error('Lataa vähintään yksi projekti');
      return;
    }
    
    const validRecipients = emailRecipients.filter(r => r.email.trim() && r.email.includes('@') && r.name.trim());
    if (validRecipients.length === 0) {
      toast.error('Lisää vähintään yksi työntekijä (nimi ja sähköposti)');
      return;
    }
    if (!kohdeOsoite.trim()) {
      toast.error('Kohteen osoite on pakollinen');
      return;
    }
    if (!tyonjohtaja.trim()) {
      toast.error('Työnjohtajan nimi on pakollinen');
      return;
    }
    
    setIsSendingEmail(true);
    
    try {
      const projectNames = processedProjects.map(p => p.name).join(', ');
      
      const result = exportKoontiWorkSchedulePDF({
        projects: processedProjects,
        totals: grandTotals,
        workerCount,
        hoursPerDay
      }, true);
      
      if (!result || !result.pdfBase64) {
        throw new Error('PDF generation failed');
      }
      
      const validEmails = validRecipients.map(r => r.email);
      const validNames = validRecipients.map(r => r.name);
      
      const response = await fetch(`${API_URL}/api/send-urakkatyomaarays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_emails: validEmails,
          recipient_names: validNames,
          kohde_nimi: projectNames || 'Koonti projekti',
          kohde_osoite: kohdeOsoite,
          tyonjohtaja: tyonjohtaja,
          tyonjohtaja_puh: '+358 40 054 7270',
          pdf_base64: result.pdfBase64,
          pdf_filename: result.fileName || 'Tyomaaraerittely_koonti.pdf'
        })
      });
      
      if (response.ok) {
        toast.success(`Urakkamääräys lähetetty: ${validNames.join(', ')}`);
        setShowEmailModal(false);
        setEmailRecipients([{ name: '', email: '' }]);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Lähetys epäonnistui');
      }
    } catch (e) {
      console.error('Send failed:', e);
      toast.error('Lähetys epäonnistui: ' + e.message);
    } finally {
      setIsSendingEmail(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-teal-600" />
            Koonti työaikataulu
          </DialogTitle>
          <DialogDescription>
            Yhdistä useita projekteja yhteen työaikatauluun
          </DialogDescription>
        </DialogHeader>
        
        {/* File Upload */}
        <div className="py-4 border-b">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-dashed border-2"
            data-testid="upload-projects-btn"
          >
            <Upload className="h-4 w-4 mr-2" />
            Lataa projektitiedostoja (.json)
          </Button>
        </div>
        
        {/* Loaded Projects */}
        {loadedProjects.length > 0 && (
          <div className="py-2 border-b">
            <Label className="text-sm text-gray-500 mb-2 block">
              Ladatut projektit ({loadedProjects.length})
            </Label>
            <div className="flex flex-wrap gap-2">
              {loadedProjects.map((p, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full text-sm"
                >
                  <FileText className="h-3 w-3 text-teal-600" />
                  <span>{p.project?.name || `Projekti ${idx + 1}`}</span>
                  <button
                    onClick={() => handleRemoveProject(idx)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Settings Row */}
        {loadedProjects.length > 0 && (
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
              />
            </div>
          </div>
        )}
        
        {/* Projects Summary Table */}
        {processedProjects.length > 0 && (
          <ScrollArea className="flex-1 min-h-[200px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projekti</TableHead>
                  <TableHead className="text-right">Työvaiheita</TableHead>
                  <TableHead className="text-right">Tunnit yht.</TableHead>
                  <TableHead className="text-right">Päivät ({workerCount} hlö)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedProjects.map((project, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell className="text-right">{project.rows.length}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(project.totalHours, 1)} h
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(project.totalHours / (workerCount * hoursPerDay), 1)} pv
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
        
        {/* Empty State */}
        {loadedProjects.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p>Lataa projektitiedostoja aloittaaksesi</p>
          </div>
        )}
        
        {/* Totals */}
        {processedProjects.length > 0 && (
          <div className="pt-4 border-t bg-teal-50 -mx-6 px-6 py-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-teal-700">
                  {formatNumber(grandTotals.totalHours, 0)}
                </div>
                <div className="text-sm text-gray-600">tuntia yhteensä</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-teal-700">
                  {formatNumber(grandTotals.totalHoursPerWorker, 0)}
                </div>
                <div className="text-sm text-gray-600">tuntia / työntekijä</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-teal-700">
                  {formatNumber(grandTotals.totalDays, 1)}
                </div>
                <div className="text-sm text-gray-600">työpäivää ({workerCount} hlö)</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-teal-700">
                  {formatNumber(grandTotals.totalWeeks, 1)}
                </div>
                <div className="text-sm text-gray-600">viikkoa</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Sulje
          </Button>
          <Button 
            onClick={handleExportPDF}
            disabled={processedProjects.length === 0}
            className="bg-teal-600 hover:bg-teal-700"
            data-testid="export-koonti-schedule-pdf"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Lataa PDF
          </Button>
          <Button 
            onClick={() => setShowEmailModal(true)}
            disabled={processedProjects.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="send-koonti-urakkatyomaarays-btn"
          >
            <Send className="h-4 w-4 mr-2" />
            Lähetä urakkamääräys
          </Button>
        </div>
      </DialogContent>
      
      {/* Email Modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Lähetä urakkamääräys
            </DialogTitle>
            <DialogDescription>
              Lähetä koonti työmääräerittely työntekijöille
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="kohde-osoite">Kohteen osoite *</Label>
              <Input
                id="kohde-osoite"
                value={kohdeOsoite}
                onChange={(e) => setKohdeOsoite(e.target.value)}
                placeholder="Esim. Mannerheimintie 1, Helsinki"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tyonjohtaja">Työnjohtaja *</Label>
              <Input
                id="tyonjohtaja"
                value={tyonjohtaja}
                onChange={(e) => setTyonjohtaja(e.target.value)}
                placeholder="Esim. Matti Meikäläinen"
              />
            </div>
            
            <div className="space-y-3">
              <Label>Työntekijät *</Label>
              {emailRecipients.map((recipient, index) => (
                <div key={index} className="p-3 border rounded-lg bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Työntekijä {index + 1}</span>
                    {emailRecipients.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRecipient(index)}
                        className="h-6 px-2 text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Input
                    type="text"
                    value={recipient.name}
                    onChange={(e) => handleRecipientChange(index, 'name', e.target.value)}
                    placeholder="Nimi (esim. Matti Meikäläinen)"
                  />
                  <Input
                    type="email"
                    value={recipient.email}
                    onChange={(e) => handleRecipientChange(index, 'email', e.target.value)}
                    placeholder="Sähköposti (esim. matti@email.fi)"
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddRecipient}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Lisää työntekijä
              </Button>
            </div>
            
            <p className="text-xs text-gray-500">
              {emailRecipients.length > 1 
                ? 'Kaikki työntekijät näkevät toisensa ja vastaavat yhteisvastuullisesti urakan suorittamisesta.'
                : 'Sähköposti sisältää virallisen urakkamääräyksen ehtoineen ja työmääräerittelyn PDF-liitteenä.'
              }
            </p>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEmailModal(false)}>
              Peruuta
            </Button>
            <Button
              onClick={handleSendUrakkatyomaarays}
              disabled={isSendingEmail}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSendingEmail ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Lähetetään...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Lähetä
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
