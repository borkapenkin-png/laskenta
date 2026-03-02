import React, { useState, useEffect } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Eye, Loader2, Plus, Trash2, Calculator, Edit3 } from 'lucide-react';
import { VALIDITY_OPTIONS, PAYMENT_TERM_OPTIONS } from '@/constants/company';

export const TarjousDialog = ({ open, onClose, onGenerate, projectName }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    // Source mode
    sourceMode: 'auto', // 'auto' (laskennasta) or 'manual' (käsin)
    
    // Asiakastiedot (Customer info)
    asiakas: '',
    kohde: projectName || '',
    yhteyshenkilo: '',
    email: '',
    puhelin: '',
    
    // Tarjouksen tiedot (Offer details)
    paivamaara: new Date().toISOString().split('T')[0],
    voimassa: 30,
    maksuehto: 14,
    offerAuthor: 'boris', // 'boris' or 'joosep'
    
    // Hinnat (Prices)
    vatMode: 'alv0', // 'alv0' or 'incl'
    lisatyoHinta: '38', // Default 38 €/h
    materialHandlingPercent: 10, // 5-12% for material procurement overhead
    
    // Manual mode fields
    urakanSisalto: '', // Manual scope description
    useKokonaishinta: false, // Toggle for single price vs table
    kokonaishinta: '', // Single total price (ALV 0%)
    manualRows: [
      { id: 1, toimenpide: '', maara: '', yksikko: 'm²', yksikkohinta: '', yhteensa: 0 }
    ],
    
    // Lisätiedot (Additional info)
    lisatiedot: '',
    kaytaVakioehtoja: true,
  });

  // Update kohde when projectName changes
  useEffect(() => {
    if (projectName && !formData.kohde) {
      setFormData(prev => ({ ...prev, kohde: projectName }));
    }
  }, [projectName]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Manual row handlers
  const handleRowChange = (rowId, field, value) => {
    setFormData(prev => {
      const newRows = prev.manualRows.map(row => {
        if (row.id === rowId) {
          const updated = { ...row, [field]: value };
          // Auto-calc yhteensa
          if (field === 'maara' || field === 'yksikkohinta') {
            const maara = parseFloat(field === 'maara' ? value : row.maara) || 0;
            const hinta = parseFloat(field === 'yksikkohinta' ? value : row.yksikkohinta) || 0;
            updated.yhteensa = maara * hinta;
          }
          return updated;
        }
        return row;
      });
      return { ...prev, manualRows: newRows };
    });
  };

  const addRow = () => {
    setFormData(prev => ({
      ...prev,
      manualRows: [
        ...prev.manualRows,
        { id: Date.now(), toimenpide: '', maara: '', yksikko: 'm²', yksikkohinta: '', yhteensa: 0 }
      ]
    }));
  };

  const removeRow = (rowId) => {
    setFormData(prev => ({
      ...prev,
      manualRows: prev.manualRows.filter(r => r.id !== rowId)
    }));
  };

  const manualTotal = formData.manualRows.reduce((sum, r) => sum + (r.yhteensa || 0), 0);

  const handleGenerate = async (isPreview = false) => {
    if (!formData.asiakas.trim()) {
      return;
    }
    
    // Validate manual mode
    if (formData.sourceMode === 'manual') {
      if (!formData.urakanSisalto.trim()) {
        return; // Urakan sisältö required
      }
      if (!formData.useKokonaishinta && formData.manualRows.length === 0) {
        return; // Need rows or kokonaishinta
      }
    }
    
    setIsGenerating(true);
    try {
      await onGenerate({
        ...formData,
        isPreview,
        sisallaAlv: formData.vatMode === 'incl',
        manualTotal: formData.useKokonaishinta 
          ? parseFloat(formData.kokonaishinta) || 0 
          : manualTotal,
      });
      if (!isPreview) {
        onClose();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Validation
  const isManualValid = formData.sourceMode === 'manual' 
    ? (formData.urakanSisalto.trim() && (formData.useKokonaishinta ? formData.kokonaishinta : manualTotal > 0))
    : true;
  const isValid = formData.asiakas.trim() && formData.kohde.trim() && isManualValid;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="tarjous-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-[#4A9BAD]" />
            Luo tarjous
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* SOURCE MODE SELECTOR */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
            <h3 className="font-semibold text-sm text-gray-700">Tarjouksen sisältö ja hinnat</h3>
            <RadioGroup
              value={formData.sourceMode}
              onValueChange={(v) => handleChange('sourceMode', v)}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="auto" id="mode-auto" />
                <Label htmlFor="mode-auto" className="cursor-pointer font-normal flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-[#4A9BAD]" />
                  Laskennasta (automaattinen)
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="manual" id="mode-manual" />
                <Label htmlFor="mode-manual" className="cursor-pointer font-normal flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-[#4A9BAD]" />
                  Käsin (urakka sisältö + hinnat)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* A) Asiakastiedot */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Asiakastiedot</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="asiakas" className="text-sm">
                  Asiakas <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="asiakas"
                  value={formData.asiakas}
                  onChange={(e) => handleChange('asiakas', e.target.value)}
                  placeholder="Yritys tai henkilö"
                  data-testid="tarjous-asiakas"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="kohde" className="text-sm">
                  Kohde / Projekti <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="kohde"
                  value={formData.kohde}
                  onChange={(e) => handleChange('kohde', e.target.value)}
                  placeholder="Kohteen nimi tai osoite"
                  data-testid="tarjous-kohde"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="yhteyshenkilo" className="text-sm">Yhteyshenkilö</Label>
                <Input
                  id="yhteyshenkilo"
                  value={formData.yhteyshenkilo}
                  onChange={(e) => handleChange('yhteyshenkilo', e.target.value)}
                  placeholder="Nimi"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Sähköposti</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="puhelin" className="text-sm">Puhelin</Label>
                <Input
                  id="puhelin"
                  value={formData.puhelin}
                  onChange={(e) => handleChange('puhelin', e.target.value)}
                  placeholder="+358 40 123 4567"
                  className="md:w-1/2"
                />
              </div>
            </div>
          </div>

          {/* B) Tarjouksen tiedot */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Tarjouksen tiedot</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paivamaara" className="text-sm">Päivämäärä</Label>
                <Input
                  id="paivamaara"
                  type="date"
                  value={formData.paivamaara}
                  onChange={(e) => handleChange('paivamaara', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Voimassa</Label>
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
                <Label className="text-sm">Maksuehto</Label>
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
                <Label className="text-sm">Tarjouksen laatija</Label>
                <Select
                  value={formData.offerAuthor}
                  onValueChange={(v) => handleChange('offerAuthor', v)}
                >
                  <SelectTrigger data-testid="tarjous-author">
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

          {/* MANUAL MODE FIELDS */}
          {formData.sourceMode === 'manual' && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-sm text-gray-700 border-b border-blue-200 pb-2">
                Urakan sisältö ja hinnat (käsin)
              </h3>
              
              {/* Urakan sisältö textarea */}
              <div className="space-y-2">
                <Label htmlFor="urakanSisalto" className="text-sm">
                  Urakan sisältö <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="urakanSisalto"
                  value={formData.urakanSisalto}
                  onChange={(e) => handleChange('urakanSisalto', e.target.value)}
                  placeholder="Kuvaa urakan laajuus, rajaukset ja huomiot..."
                  rows={4}
                  className="bg-white"
                  data-testid="tarjous-urakan-sisalto"
                />
              </div>
              
              {/* Kokonaishinta toggle */}
              <div className="flex items-center gap-3 py-2">
                <Switch
                  id="useKokonaishinta"
                  checked={formData.useKokonaishinta}
                  onCheckedChange={(v) => handleChange('useKokonaishinta', v)}
                  data-testid="tarjous-kokonaishinta-toggle"
                />
                <Label htmlFor="useKokonaishinta" className="cursor-pointer text-sm">
                  Kokonaishinta ilman erittelyä
                </Label>
              </div>
              
              {formData.useKokonaishinta ? (
                /* Single kokonaishinta input */
                <div className="space-y-2">
                  <Label htmlFor="kokonaishinta" className="text-sm">
                    Urakkahinta (ALV 0%) <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="kokonaishinta"
                      type="number"
                      value={formData.kokonaishinta}
                      onChange={(e) => handleChange('kokonaishinta', e.target.value)}
                      placeholder="0"
                      className="w-40 bg-white"
                      data-testid="tarjous-kokonaishinta"
                    />
                    <span className="text-gray-600">€</span>
                  </div>
                </div>
              ) : (
                /* Hintaerittely table */
                <div className="space-y-3">
                  <Label className="text-sm">Hintaerittely</Label>
                  
                  <div className="bg-white rounded border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left p-2 font-medium">Toimenpide</th>
                          <th className="text-right p-2 font-medium w-20">Määrä</th>
                          <th className="text-center p-2 font-medium w-20">Yksikkö</th>
                          <th className="text-right p-2 font-medium w-24">Yks.hinta €</th>
                          <th className="text-right p-2 font-medium w-24">Yhteensä €</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.manualRows.map((row) => (
                          <tr key={row.id} className="border-t">
                            <td className="p-1">
                              <Input
                                value={row.toimenpide}
                                onChange={(e) => handleRowChange(row.id, 'toimenpide', e.target.value)}
                                placeholder="Työn kuvaus"
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                value={row.maara}
                                onChange={(e) => handleRowChange(row.id, 'maara', e.target.value)}
                                className="h-8 text-sm text-right"
                              />
                            </td>
                            <td className="p-1">
                              <Select
                                value={row.yksikko}
                                onValueChange={(v) => handleRowChange(row.id, 'yksikko', v)}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="m²">m²</SelectItem>
                                  <SelectItem value="jm">jm</SelectItem>
                                  <SelectItem value="kpl">kpl</SelectItem>
                                  <SelectItem value="h">h</SelectItem>
                                  <SelectItem value="erä">erä</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                value={row.yksikkohinta}
                                onChange={(e) => handleRowChange(row.id, 'yksikkohinta', e.target.value)}
                                className="h-8 text-sm text-right"
                              />
                            </td>
                            <td className="p-1 text-right pr-2 font-medium">
                              {row.yhteensa.toLocaleString('fi-FI', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-1">
                              {formData.manualRows.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeRow(row.id)}
                                  className="h-8 w-8 text-gray-400 hover:text-red-500"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t">
                        <tr>
                          <td colSpan={4} className="p-2 text-right font-semibold">
                            Yhteensä (ALV 0%):
                          </td>
                          <td className="p-2 text-right font-bold text-[#4A9BAD]">
                            {manualTotal.toLocaleString('fi-FI', { minimumFractionDigits: 2 })} €
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRow}
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Lisää rivi
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* C) Lisätyöt – veloitusperiaatteet */}
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
                    <RadioGroupItem value="alv0" id="alv0" />
                    <Label htmlFor="alv0" className="cursor-pointer font-normal">
                      Hinnat ALV 0%
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="incl" id="incl" />
                    <Label htmlFor="incl" className="cursor-pointer font-normal">
                      Hinnat sis. ALV (25,5%)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lisatyoHinta" className="text-sm">
                    Muutos- ja lisätyö tuntihinta (€/h)
                  </Label>
                  <Input
                    id="lisatyoHinta"
                    type="number"
                    value={formData.lisatyoHinta}
                    onChange={(e) => handleChange('lisatyoHinta', e.target.value)}
                    className="w-32"
                    data-testid="tarjous-lisatyo-hinta"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Materiaalihankinta ja yleiskulu</Label>
                  <Select
                    value={String(formData.materialHandlingPercent)}
                    onValueChange={(v) => handleChange('materialHandlingPercent', parseInt(v))}
                  >
                    <SelectTrigger className="w-32" data-testid="tarjous-material-percent">
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
            </div>
          </div>

          {/* D) Lisätiedot */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Lisätiedot</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lisatiedot" className="text-sm">Lisätiedot tarjoukseen</Label>
                <Textarea
                  id="lisatiedot"
                  value={formData.lisatiedot}
                  onChange={(e) => handleChange('lisatiedot', e.target.value)}
                  placeholder="Lisätietoja tai erityisehtoja..."
                  rows={3}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <Label htmlFor="vakioehdot" className="text-sm font-medium">
                    Käytä vakioehtoja
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">
                    Lisää yleiset sopimusehdot tarjoukseen
                  </p>
                </div>
                <Switch
                  id="vakioehdot"
                  checked={formData.kaytaVakioehtoja}
                  onCheckedChange={(v) => handleChange('kaytaVakioehtoja', v)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Peruuta
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleGenerate(true)}
              disabled={!isValid || isGenerating}
              data-testid="tarjous-preview-btn"
            >
              <Eye className="h-4 w-4 mr-2" />
              Esikatselu
            </Button>
            <Button
              onClick={() => handleGenerate(false)}
              disabled={!isValid || isGenerating}
              className="bg-[#4A9BAD] hover:bg-[#3d8699]"
              data-testid="tarjous-create-btn"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Luodaan...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Luo tarjous PDF
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
