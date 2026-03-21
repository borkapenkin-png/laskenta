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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Upload, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react';
import { VALIDITY_OPTIONS, PAYMENT_TERM_OPTIONS } from '@/constants/company';

// ==================== PROJECT JSON PARSER ====================
const parseProjectJSON = (jsonData, fileName) => {
  try {
    // Handle both old and new format
    const projectName = jsonData.project?.name || jsonData.name || fileName.replace('.json', '');
    const measurements = jsonData.measurements || jsonData.objects || [];
    const settings = jsonData.settings || {};
    
    if (!measurements || measurements.length === 0) {
      return {
        success: false,
        error: 'Projektissa ei ole mittauksia',
        fileName
      };
    }
    
    // Extract operations from measurements
    const operations = [];
    
    measurements.forEach(m => {
      // Get label and price info
      const label = m.label || m.preset?.name || 'Tuntematon';
      const unit = m.unit || m.preset?.unit || 'm²';
      const pricePerUnit = m.pricePerUnit ?? m.preset?.price ?? 0;
      
      // Calculate quantity based on measurement type
      // Support both old format (calculatedValue, area, length, count, value) 
      // and new format (quantity)
      let quantity = 0;
      if (m.quantity !== undefined && m.quantity > 0) {
        // New format - use quantity directly
        quantity = m.quantity;
        
        // For wall type with wallHeight, calculate effective area
        if (m.type === 'wall' && m.wallHeight) {
          const bothSidesFactor = m.bothSides ? 2 : 1;
          const bruttoM2 = quantity * m.wallHeight * bothSidesFactor;
          const openings = m.openings || 0;
          quantity = bruttoM2 - openings;
        }
        // For pystykotelo types, calculate total jm
        else if ((m.isPystykotelot || m.constructionType?.includes('Pystykotelo')) && m.wallHeight) {
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
      
      // Skip if no valid quantity or price
      if (quantity <= 0) return;
      
      operations.push({
        label,
        quantity,
        unit,
        pricePerUnit,
        totalCost: quantity * pricePerUnit
      });
    });
    
    if (operations.length === 0) {
      return {
        success: false,
        error: 'Ei löytynyt laskutettavia rivejä',
        fileName
      };
    }
    
    // Calculate totals
    const totalCost = operations.reduce((sum, op) => sum + op.totalCost, 0);
    
    return {
      success: true,
      fileName,
      projectName,
      operations,
      totalCost,
      createdAt: jsonData.savedAt || jsonData.createdAt || new Date().toISOString(),
      settings
    };
  } catch (error) {
    return {
      success: false,
      error: `Virhe tiedoston käsittelyssä: ${error.message}`,
      fileName
    };
  }
};

// ==================== MERGE OPERATIONS ====================
const mergeOperations = (projects) => {
  const mergedMap = new Map();
  
  projects.forEach(project => {
    if (!project.success) return;
    
    project.operations.forEach(op => {
      // Merge key: label + unit + pricePerUnit
      const key = `${op.label}|${op.unit}|${op.pricePerUnit}`;
      
      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key);
        existing.quantity += op.quantity;
        existing.totalCost = existing.quantity * existing.pricePerUnit;
      } else {
        mergedMap.set(key, {
          label: op.label,
          quantity: op.quantity,
          unit: op.unit,
          pricePerUnit: op.pricePerUnit,
          totalCost: op.quantity * op.pricePerUnit
        });
      }
    });
  });
  
  return Array.from(mergedMap.values());
};

// ==================== FORMAT HELPERS ====================
const formatCurrency = (value) => {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
};

const formatNumber = (value) => {
  return new Intl.NumberFormat('fi-FI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
};

// ==================== MAIN COMPONENT ====================
export const KoontitarjousDialog = ({ open, onClose, onGenerate, vatPercentage = 25.5 }) => {
  const fileInputRef = useRef(null);
  const [loadedProjects, setLoadedProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state - same structure as TarjousDialog
  const [formData, setFormData] = useState({
    asiakas: '',
    kohde: '',
    yhteyshenkilo: '',
    email: '',
    puhelin: '',
    paivamaara: new Date().toISOString().split('T')[0],
    voimassa: 30,
    maksuehto: 14,
    offerAuthor: 'boris',
    vatMode: 'alv0',
    lisatyoHinta: '38',
    materialHandlingPercent: 10,
    lisatiedot: '',
    kaytaVakioehtoja: true,
    // Detail level for table display
    detailLevel: 'summary', // 'minimal', 'summary', or 'detailed'
    // Material and hour work options
    sisaltaaMateriaalit: true,
    tuntityotEnabled: false,
    tuntityotMaara: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // File upload handler
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
        } catch (error) {
          return {
            success: false,
            error: 'Virheellinen JSON-tiedosto',
            fileName: file.name
          };
        }
      })
    );
    
    // Add unique IDs and editable titles
    const projectsWithIds = results.map((result, index) => ({
      ...result,
      id: `project-${Date.now()}-${index}`,
      editableTitle: result.projectName || result.fileName
    }));
    
    setLoadedProjects(prev => [...prev, ...projectsWithIds]);
    setIsLoading(false);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveProject = (projectId) => {
    setLoadedProjects(prev => prev.filter(p => p.id !== projectId));
  };

  const handleTitleChange = (projectId, newTitle) => {
    setLoadedProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, editableTitle: newTitle } : p
    ));
  };

  const handleClearAll = () => {
    setLoadedProjects([]);
  };

  // Calculate merged data
  const successfulProjects = loadedProjects.filter(p => p.success);
  const mergedOperations = mergeOperations(successfulProjects);
  const totalCostAlv0 = mergedOperations.reduce((sum, op) => sum + op.totalCost, 0);
  const vatAmount = totalCostAlv0 * vatPercentage / 100;
  const totalWithVat = totalCostAlv0 + vatAmount;

  const handleGenerate = () => {
    if (successfulProjects.length === 0 || !formData.asiakas.trim()) return;
    
    onGenerate({
      ...formData,
      loadedProjects: successfulProjects.map(p => ({
        title: p.editableTitle,
        totalCost: p.totalCost
      })),
      mergedOperations,
      totalCostAlv0,
      vatAmount,
      totalWithVat,
      sisallaAlv: formData.vatMode === 'incl'
    });
    onClose();
  };

  // Handle send email - generates PDF and opens email client
  const handleSendEmail = async () => {
    if (successfulProjects.length === 0 || !formData.asiakas.trim() || !formData.email) return;
    
    const { toast } = await import('sonner');
    
    try {
      // Generate the PDF and get the result with base64
      const koontitarjousData = {
        ...formData,
        loadedProjects: successfulProjects.map(p => ({
          title: p.editableTitle,
          totalCost: p.totalCost
        })),
        mergedOperations,
        totalCostAlv0,
        vatAmount,
        totalWithVat,
        sisallaAlv: formData.vatMode === 'incl'
      };
      
      const result = await onGenerate(koontitarjousData, true); // Pass true to get result
      
      if (!result || !result.pdfBase64) {
        toast.error('PDF luominen epäonnistui');
        return;
      }
      
      // Build email content
      const projectNames = successfulProjects.map(p => p.editableTitle).join(', ');
      const bodyText = `Hei,

Tarjoamme kohteeseen ${formData.kohde || projectNames}.

Tarjous on liitetty PDF-tiedostona.

Vastaamme mielellämme mahdollisiin kysymyksiin.

Ystävällisin terveisin,
J&B Tasoitus ja Maalaus Oy
Puh: 040 848 8885`;
      
      // Send via backend
      const API_URL = process.env.REACT_APP_BACKEND_URL || '';
      const emailRes = await fetch(`${API_URL}/api/send-tarjous-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_email: formData.email,
          subject: `Tarjous: ${formData.kohde || projectNames}`,
          body_text: bodyText,
          pdf_base64: result.pdfBase64,
          pdf_filename: result.fileName,
          sender_name: formData.tarjouksenLaatija || ''
        })
      });
      
      if (emailRes.ok) {
        toast.success(`Tarjous lähetetty: ${formData.email}`);
        onClose();
      } else {
        const errData = await emailRes.json();
        toast.error(errData.detail || 'Sähköpostin lähetys epäonnistui');
      }
      
    } catch (err) {
      console.error('Email send error:', err);
      toast.error('Sähköpostin lähetys epäonnistui');
    }
  };

  const isValid = formData.asiakas.trim() && successfulProjects.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="koontitarjous-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#4A9BAD]">
            Koontitarjous
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* ==================== FILE UPLOAD SECTION ==================== */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Lataa projektit</Label>
            
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#4A9BAD] transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">
                Klikkaa tai vedä tänne projektin JSON-tiedostot
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Voit valita useita tiedostoja kerralla
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                data-testid="koontitarjous-file-input"
              />
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-full"
            >
              <FileJson className="w-4 h-4 mr-2" />
              {isLoading ? 'Ladataan...' : 'Lataa projektin JSON'}
            </Button>
          </div>

          {/* ==================== LOADED PROJECTS LIST ==================== */}
          {loadedProjects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  Ladatut projektit ({loadedProjects.length} kpl)
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-red-500 hover:text-red-700 h-7"
                >
                  Tyhjennä kaikki
                </Button>
              </div>
              
              <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
                {loadedProjects.map((project) => (
                  <div
                    key={project.id}
                    className={`flex items-center gap-3 p-3 ${
                      project.success ? 'bg-white' : 'bg-red-50'
                    }`}
                  >
                    {project.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      {project.success ? (
                        <Input
                          value={project.editableTitle}
                          onChange={(e) => handleTitleChange(project.id, e.target.value)}
                          className="h-8 text-sm font-medium"
                          placeholder="Projektin nimi"
                        />
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-red-700 truncate">
                            {project.fileName}
                          </p>
                          <p className="text-xs text-red-500">{project.error}</p>
                        </div>
                      )}
                    </div>
                    
                    {project.success && (
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-[#4A9BAD]">
                          {formatCurrency(project.totalCost)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {project.operations.length} riviä
                        </p>
                      </div>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveProject(project.id)}
                      className="text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              
              {/* Summary preview */}
              {successfulProjects.length > 0 && (
                <div className="p-3 bg-[#4A9BAD]/10 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Projekteja</p>
                      <p className="font-bold text-lg">{successfulProjects.length}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Yhdistettyjä rivejä</p>
                      <p className="font-bold text-lg">{mergedOperations.length}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Yhteensä (ALV 0%)</p>
                      <p className="font-bold text-lg text-[#4A9BAD]">{formatCurrency(totalCostAlv0)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== CUSTOMER INFO ==================== */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Tarjouksen näyttöasetukset</h3>
            
            <div className="space-y-3">
              <Label className="text-sm text-gray-600">Näytä tarjouksessa:</Label>
              <RadioGroup
                value={formData.detailLevel}
                onValueChange={(v) => handleChange('detailLevel', v)}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="minimal" id="koonto-detail-minimal" />
                  <Label htmlFor="koonto-detail-minimal" className="cursor-pointer font-normal text-sm">
                    Vain tehtävä
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="summary" id="koonto-detail-summary" />
                  <Label htmlFor="koonto-detail-summary" className="cursor-pointer font-normal text-sm">
                    Tehtävä ja määrä
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="detailed" id="koonto-detail-detailed" />
                  <Label htmlFor="koonto-detail-detailed" className="cursor-pointer font-normal text-sm">
                    Laskennan kanssa (määrä × hinta)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* ==================== CUSTOMER INFO ==================== */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Asiakastiedot</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="koonto-asiakas">Asiakas <span className="text-red-500">*</span></Label>
                <Input
                  id="koonto-asiakas"
                  value={formData.asiakas}
                  onChange={(e) => handleChange('asiakas', e.target.value)}
                  placeholder="Asiakkaan nimi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="koonto-kohde">Kohde <span className="text-red-500">*</span></Label>
                <Input
                  id="koonto-kohde"
                  value={formData.kohde}
                  onChange={(e) => handleChange('kohde', e.target.value)}
                  placeholder="Kohteen nimi"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Yhteyshenkilö</Label>
                <Input
                  value={formData.yhteyshenkilo}
                  onChange={(e) => handleChange('yhteyshenkilo', e.target.value)}
                  placeholder="Nimi"
                />
              </div>
              <div className="space-y-2">
                <Label>Sähköposti</Label>
                <Input
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Puhelin</Label>
                <Input
                  value={formData.puhelin}
                  onChange={(e) => handleChange('puhelin', e.target.value)}
                  placeholder="+358..."
                />
              </div>
            </div>
          </div>

          {/* ==================== OFFER DETAILS ==================== */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Tarjouksen tiedot</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Päivämäärä</Label>
                <Input
                  type="date"
                  value={formData.paivamaara}
                  onChange={(e) => handleChange('paivamaara', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Voimassa</Label>
                <Select
                  value={String(formData.voimassa)}
                  onValueChange={(v) => handleChange('voimassa', parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALIDITY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Maksuehto</Label>
                <Select
                  value={String(formData.maksuehto)}
                  onValueChange={(v) => handleChange('maksuehto', parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERM_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tarjouksen laatija</Label>
                <Select
                  value={formData.offerAuthor}
                  onValueChange={(v) => handleChange('offerAuthor', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boris">Boris Penkin</SelectItem>
                    <SelectItem value="joosep">Joosep Rohusaar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ==================== PRICING OPTIONS ==================== */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Lisätyöt – veloitusperiaatteet</h3>
            
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm">ALV-käsittely</Label>
                <RadioGroup
                  value={formData.vatMode}
                  onValueChange={(v) => handleChange('vatMode', v)}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="alv0" id="koonto-alv0" />
                    <Label htmlFor="koonto-alv0" className="cursor-pointer font-normal">
                      Hinnat ALV 0%
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="incl" id="koonto-incl" />
                    <Label htmlFor="koonto-incl" className="cursor-pointer font-normal">
                      Hinnat sis. ALV (25,5%)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Muutos- ja lisätyö tuntihinta (€/h)</Label>
                  <Input
                    type="number"
                    value={formData.lisatyoHinta}
                    onChange={(e) => handleChange('lisatyoHinta', e.target.value)}
                    className="w-32"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Materiaalihankinta ja yleiskulu</Label>
                  <Select
                    value={String(formData.materialHandlingPercent)}
                    onValueChange={(v) => handleChange('materialHandlingPercent', parseInt(v))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 6, 7, 8, 9, 10, 11, 12].map(pct => (
                        <SelectItem key={pct} value={String(pct)}>
                          {pct} %
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">Lisätään materiaalien hankintahintaan</p>
                </div>
              </div>
              
              {/* Sisältää materiaalit toggle */}
              <div className="flex items-center gap-3 py-2 border-t pt-4">
                <Switch
                  id="koonto-sisaltaaMateriaalit"
                  checked={formData.sisaltaaMateriaalit}
                  onCheckedChange={(v) => handleChange('sisaltaaMateriaalit', v)}
                />
                <Label htmlFor="koonto-sisaltaaMateriaalit" className="cursor-pointer text-sm">
                  Sisältää Teknos maalit ja tarvikkeet
                </Label>
              </div>
              
              {/* Tuntityöt toggle + input */}
              <div className="flex items-center gap-3 py-2">
                <Switch
                  id="koonto-tuntityotEnabled"
                  checked={formData.tuntityotEnabled}
                  onCheckedChange={(v) => handleChange('tuntityotEnabled', v)}
                />
                <Label htmlFor="koonto-tuntityotEnabled" className="cursor-pointer text-sm">
                  Urakkaan laskettu tuntityöt
                </Label>
                {formData.tuntityotEnabled && (
                  <div className="flex items-center gap-2 ml-4">
                    <Input
                      type="number"
                      value={formData.tuntityotMaara}
                      onChange={(e) => handleChange('tuntityotMaara', e.target.value)}
                      placeholder="0"
                      className="w-20"
                    />
                    <span className="text-sm text-gray-500">h</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ==================== ADDITIONAL INFO ==================== */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Lisätiedot</h3>
            
            <Textarea
              value={formData.lisatiedot}
              onChange={(e) => handleChange('lisatiedot', e.target.value)}
              placeholder="Lisätiedot tarjoukseen..."
              rows={3}
            />
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label htmlFor="koonto-vakioehdot" className="text-sm font-medium">
                  Käytä vakioehtoja
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Lisää yleiset sopimusehdot tarjoukseen
                </p>
              </div>
              <Switch
                id="koonto-vakioehdot"
                checked={formData.kaytaVakioehtoja}
                onCheckedChange={(v) => handleChange('kaytaVakioehtoja', v)}
              />
            </div>
          </div>

          {/* ==================== TOTALS PREVIEW ==================== */}
          {successfulProjects.length > 0 && (
            <div className="p-4 bg-[#4A9BAD] text-white rounded-lg">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Yhteensä (ALV 0%):</span>
                  <span className="font-bold">{formatCurrency(totalCostAlv0)}</span>
                </div>
                {formData.vatMode === 'incl' && (
                  <>
                    <div className="flex justify-between text-white/80">
                      <span>ALV {vatPercentage}%:</span>
                      <span>{formatCurrency(vatAmount)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t border-white/30 pt-2">
                      <span>Yhteensä (sis. ALV):</span>
                      <span>{formatCurrency(totalWithVat)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Peruuta
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!isValid}
            className="bg-[#4A9BAD] hover:bg-[#3d8494]"
          >
            Luo koontitarjous ({successfulProjects.length})
          </Button>
          <Button
            onClick={handleSendEmail}
            disabled={!isValid || !formData.email}
            variant="outline"
            className="border-[#4A9BAD] text-[#4A9BAD] hover:bg-[#4A9BAD] hover:text-white"
            data-testid="koontitarjous-send-email-btn"
            title={!formData.email ? "Täytä asiakkaan sähköposti ensin" : "Lähetä tarjous sähköpostilla"}
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Lähetä tarjous
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
