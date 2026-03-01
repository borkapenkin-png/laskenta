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

export const CalibrateDialog = ({ open, onClose, onCalibrate, onStartCalibration, pdfRenderInfo }) => {
  const [selectedScale, setSelectedScale] = useState('50');
  const [customScale, setCustomScale] = useState('');
  const [knownDistance, setKnownDistance] = useState('');
  const [calibrationMode, setCalibrationMode] = useState('preset');

  // Calculate pixelsPerMeter based on actual PDF rendering DPI
  // IMPORTANT: We need to calculate for zoom=1 (normalized coordinates)
  const calculatePixelsPerMeter = (scaleValue) => {
    // Get actual DPI from PDF rendering
    const actualDPI = pdfRenderInfo?.actualDPI || 72;
    const currentZoom = pdfRenderInfo?.zoom || 1;
    
    // Calculate base DPI (at zoom=1) - this is what we store measurements in
    const baseDPI = actualDPI / currentZoom;
    
    // Calculate actual pixels per cm based on base DPI
    // 1 inch = 2.54 cm, so pixels per cm = DPI / 2.54
    const pixelsPerCm = baseDPI / 2.54;
    
    // For a 1:X scale drawing:
    // 1 cm on drawing = X cm in real life = X/100 meters
    // So: pixelsPerCm pixels = X/100 meters
    // Therefore: pixelsPerMeter = pixelsPerCm / (X/100) = pixelsPerCm * 100 / X
    const pixelsPerMeter = (pixelsPerCm * 100) / scaleValue;
    
    console.log(`Scale 1:${scaleValue}, BaseDPI: ${baseDPI.toFixed(0)}, Zoom: ${currentZoom}, px/cm: ${pixelsPerCm.toFixed(2)}, px/m: ${pixelsPerMeter.toFixed(2)}`);
    
    return pixelsPerMeter;
  };

  const handlePresetCalibrate = () => {
    const scaleValue = parseInt(selectedScale);
    if (scaleValue > 0) {
      const pixelsPerMeter = calculatePixelsPerMeter(scaleValue);
      
      onCalibrate({
        ratio: `1:${scaleValue}`,
        scaleValue: scaleValue,
        pixelsPerMeter: pixelsPerMeter,
        detected: false
      });
      onClose();
    }
  };

  const handleCustomScaleCalibrate = () => {
    const scaleValue = parseInt(customScale);
    if (scaleValue > 0) {
      const pixelsPerMeter = calculatePixelsPerMeter(scaleValue);
      
      onCalibrate({
        ratio: `1:${scaleValue}`,
        scaleValue: scaleValue,
        pixelsPerMeter: pixelsPerMeter,
        detected: false
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

  const hasPdfLoaded = pdfRenderInfo && pdfRenderInfo.actualDPI;

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
            {!hasPdfLoaded && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <p className="font-medium">Lataa PDF ensin!</p>
                <p className="text-xs mt-1">
                  Mittakaavan oikea laskenta vaatii PDF-tiedoston lataamisen.
                </p>
              </div>
            )}

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
                  disabled={!customScale || parseInt(customScale) <= 0 || !hasPdfLoaded}
                  size="sm"
                >
                  Käytä
                </Button>
              </div>
            </div>

            {hasPdfLoaded && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="text-xs">
                  PDF DPI: {pdfRenderInfo.actualDPI.toFixed(0)} | 
                  Zoom: {((pdfRenderInfo.zoom || 1) * 100).toFixed(0)}%
                </p>
              </div>
            )}

            <Button
              onClick={handlePresetCalibrate}
              className="w-full bg-[#0052CC] hover:bg-[#0043A8]"
              disabled={!selectedScale || !hasPdfLoaded}
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
              disabled={!knownDistance || parseFloat(knownDistance) <= 0 || !hasPdfLoaded}
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
