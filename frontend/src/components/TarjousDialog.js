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
import { FileText, Eye, Loader2 } from 'lucide-react';
import { VALIDITY_OPTIONS, PAYMENT_TERM_OPTIONS } from '@/constants/company';

export const TarjousDialog = ({ open, onClose, onGenerate, projectName }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
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
    
    // Hinnat (Prices)
    vatMode: 'alv0', // 'alv0' or 'incl'
    lisatyoHinta: '55',
    
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

  const handleGenerate = async (isPreview = false) => {
    if (!formData.asiakas.trim()) {
      return;
    }
    
    setIsGenerating(true);
    try {
      await onGenerate({
        ...formData,
        isPreview,
        sisallaAlv: formData.vatMode === 'incl',
      });
      if (!isPreview) {
        onClose();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const isValid = formData.asiakas.trim() && formData.kohde.trim();

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
            </div>
          </div>

          {/* C) Hinnat */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Hinnat</h3>
            
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
                      Hinnat sis. ALV
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              
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
                />
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
