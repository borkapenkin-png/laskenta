import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Common architectural scales
const PRESET_SCALES = [
  { label: '1:10', value: 10 },
  { label: '1:20', value: 20 },
  { label: '1:50', value: 50 },
  { label: '1:100', value: 100 },
  { label: '1:200', value: 200 },
  { label: '1:500', value: 500 },
];

export const CalibrateDialog = ({ open, onClose, onCalibrate, onStartCalibration }) => {
  const [selectedScale, setSelectedScale] = useState('50');
  const [customScale, setCustomScale] = useState('');
  const [knownDistance, setKnownDistance] = useState('');
  const [calibrationMode, setCalibrationMode] = useState('preset');

  const handlePresetCalibrate = () => {
    const scaleValue = parseInt(selectedScale);
    if (scaleValue > 0) {
      // For scale 1:50, 1cm on drawing = 50cm real = 0.5m
      // We need to know the PDF DPI to calculate properly
      // Assuming standard 72 DPI for PDF: 1 inch = 72 pixels, 1 cm = 28.35 pixels
      // At 1:50 scale: 28.35 pixels = 0.5m real
      // So pixelsPerMeter = 28.35 / 0.5 = 56.7 at 72 DPI
      // But PDFs are usually rendered at higher resolution, let's use 96 DPI as default
      // At 96 DPI: 1 cm = 37.8 pixels
      // At 1:50: 37.8 pixels = 0.5m, so pixelsPerMeter = 75.6
      
      // Actually, the correct formula is:
      // pixelsPerMeter = (pixels per cm on screen) * 100 / scaleValue
      // We'll estimate based on typical PDF rendering
      const estimatedPixelsPerCm = 37.8; // ~96 DPI
      const pixelsPerMeter = (estimatedPixelsPerCm * 100) / scaleValue;
      
      onCalibrate({
        ratio: `1:${scaleValue}`,
        scaleValue: scaleValue,
        pixelsPerMeter: pixelsPerMeter,
        detected: false,
        needsCalibration: true // Flag that this is an estimate, user should verify
      });
      onClose();
    }
  };

  const handleCustomScaleCalibrate = () => {
    const scaleValue = parseInt(customScale);
    if (scaleValue > 0) {
      const estimatedPixelsPerCm = 37.8;
      const pixelsPerMeter = (estimatedPixelsPerCm * 100) / scaleValue;
      
      onCalibrate({
        ratio: `1:${scaleValue}`,
        scaleValue: scaleValue,
        pixelsPerMeter: pixelsPerMeter,
        detected: false,
        needsCalibration: true
      });
      onClose();
    }
  };

  const handleTwoPointCalibration = () => {
    const distance = parseFloat(knownDistance);
    if (distance > 0 && onStartCalibration) {
      onStartCalibration(distance);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kalibroi mittakaava</DialogTitle>
          <DialogDescription>
            Valitse joonisen mittakaava tai kalibroi kahdella pisteellä.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={calibrationMode} onValueChange={setCalibrationMode} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preset">Mittakaava</TabsTrigger>
            <TabsTrigger value="twopoint">Kaksi pistettä</TabsTrigger>
          </TabsList>

          <TabsContent value="preset" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Valitse joonisen mittakaava</Label>
              <Select value={selectedScale} onValueChange={setSelectedScale}>
                <SelectTrigger>
                  <SelectValue placeholder="Valitse mittakaava" />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_SCALES.map(scale => (
                    <SelectItem key={scale.value} value={scale.value.toString()}>
                      {scale.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-center text-gray-500 text-sm">tai</div>

            <div className="space-y-2">
              <Label>Syötä mukautettu mittakaava (1:X)</Label>
              <div className="flex gap-2">
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-2">1:</span>
                  <Input
                    type="number"
                    placeholder="50"
                    value={customScale}
                    onChange={(e) => setCustomScale(e.target.value)}
                    className="w-24"
                  />
                </div>
                <Button 
                  onClick={handleCustomScaleCalibrate}
                  disabled={!customScale || parseInt(customScale) <= 0}
                  size="sm"
                >
                  Käytä
                </Button>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <p className="font-medium">Huom!</p>
              <p className="text-xs mt-1">
                Tämä on arvio. Tarkkaan mittaukseen käytä "Kaksi pistettä" -kalibrointia, 
                jossa mittaat tunnetun etäisyyden suoraan PDF:stä.
              </p>
            </div>

            <Button
              onClick={handlePresetCalibrate}
              className="w-full bg-[#0052CC] hover:bg-[#0043A8]"
              disabled={!selectedScale}
            >
              Aseta mittakaava 1:{selectedScale}
            </Button>
          </TabsContent>

          <TabsContent value="twopoint" className="space-y-4 pt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium mb-2">Ohjeet:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Syötä tunnettu etäisyys (esim. mitta joonisella)</li>
                <li>Klikkaa "Aloita kalibrointi"</li>
                <li>Klikkaa PDF:stä kaksi pistettä, jotka vastaavat syötettyä etäisyyttä</li>
                <li>Järjestelmä laskee mittakaavan automaattisesti</li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label htmlFor="distance">Tunnettu etäisyys (metriä)</Label>
              <Input
                id="distance"
                data-testid="calibration-distance-input"
                type="number"
                step="0.01"
                placeholder="Esim. 5.0"
                value={knownDistance}
                onChange={(e) => setKnownDistance(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Esim. jos joonisella on merkitty 5m mittaviiva, syötä 5.0
              </p>
            </div>

            <Button
              data-testid="start-calibration"
              onClick={handleTwoPointCalibration}
              className="w-full bg-[#0052CC] hover:bg-[#0043A8]"
              disabled={!knownDistance || parseFloat(knownDistance) <= 0}
            >
              Aloita kalibrointi
            </Button>
          </TabsContent>
        </Tabs>

        <Button
          variant="outline"
          onClick={onClose}
          className="w-full mt-2"
        >
          Peruuta
        </Button>
      </DialogContent>
    </Dialog>
  );
};
