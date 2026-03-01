import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FileText } from 'lucide-react';

export const TarjousDialog = ({ open, onClose, onGenerate, projectName }) => {
  const [formData, setFormData] = useState({
    asiakas: '',
    kohde: '',
    lisatyoHinta: '55',
    lisatiedot: '',
    sisallaAlv: false  // ALV 0% by default, checkbox adds VAT
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = () => {
    onGenerate(formData);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#4A9BAD]" />
            Tee tarjous
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Customer */}
          <div className="space-y-2">
            <Label htmlFor="asiakas">Asiakas (kenelle tarjotaan)</Label>
            <Input
              id="asiakas"
              value={formData.asiakas}
              onChange={(e) => handleChange('asiakas', e.target.value)}
              placeholder="Esim. Rakennusyhtiö Oy"
              data-testid="tarjous-asiakas"
            />
          </div>

          {/* Project/Location */}
          <div className="space-y-2">
            <Label htmlFor="kohde">Kohde / Projekti</Label>
            <Input
              id="kohde"
              value={formData.kohde}
              onChange={(e) => handleChange('kohde', e.target.value)}
              placeholder={projectName || "Esim. As Oy Helsingin Koti"}
              data-testid="tarjous-kohde"
            />
          </div>

          {/* Extra work hourly rate */}
          <div className="space-y-2">
            <Label htmlFor="lisatyoHinta">Muutos- ja lisätyö tunnihinta (€/h)</Label>
            <Input
              id="lisatyoHinta"
              type="number"
              value={formData.lisatyoHinta}
              onChange={(e) => handleChange('lisatyoHinta', e.target.value)}
              placeholder="55"
              data-testid="tarjous-lisatyo"
            />
          </div>

          {/* ALV selection */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sisallaAlv"
              checked={formData.sisallaAlv}
              onCheckedChange={(checked) => handleChange('sisallaAlv', checked)}
              data-testid="tarjous-alv"
            />
            <Label htmlFor="sisallaAlv" className="text-sm cursor-pointer">
              Lisää ALV hintaan
            </Label>
          </div>

          {/* Additional notes */}
          <div className="space-y-2">
            <Label htmlFor="lisatiedot">Lisätiedot (valinnainen)</Label>
            <Textarea
              id="lisatiedot"
              value={formData.lisatiedot}
              onChange={(e) => handleChange('lisatiedot', e.target.value)}
              placeholder="Esim. erityisehdot, aikataulut..."
              rows={3}
              data-testid="tarjous-lisatiedot"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Peruuta
          </Button>
          <Button 
            onClick={handleGenerate}
            className="bg-[#4A9BAD] hover:bg-[#3d8699]"
            disabled={!formData.asiakas}
            data-testid="tarjous-generate-button"
          >
            <FileText className="h-4 w-4 mr-2" />
            Luo tarjous PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
