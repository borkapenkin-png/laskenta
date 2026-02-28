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

export const CalibrateDialog = ({ open, onClose, onCalibrate }) => {
  const [knownDistance, setKnownDistance] = useState('');
  const [mode, setMode] = useState('manual');

  const handleSubmit = () => {
    if (knownDistance && parseFloat(knownDistance) > 0) {
      onCalibrate(parseFloat(knownDistance));
      setKnownDistance('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kalibroi mittakaava</DialogTitle>
          <DialogDescription>
            Klikkaa kaksi pistettä PDF:stä ja syötä niiden välinen todellinen etäisyys.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="distance">Todellinen etäisyys (metriä)</Label>
            <Input
              id="distance"
              data-testid="calibration-distance-input"
              type="number"
              step="0.01"
              placeholder="Esim. 5.0"
              value={knownDistance}
              onChange={(e) => setKnownDistance(e.target.value)}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">Ohjeet:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Sulje tämä ikkuna</li>
              <li>Klikkaa kaksi pistettä PDF:stä</li>
              <li>Syötä pisteiden välinen todellinen etäisyys</li>
              <li>Järjestelmä laskee mittakaavan automaattisesti</li>
            </ol>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            data-testid="start-calibration"
            onClick={handleSubmit}
            className="flex-1 bg-[#0052CC] hover:bg-[#0043A8]"
            disabled={!knownDistance || parseFloat(knownDistance) <= 0}
          >
            Aloita kalibrointi
          </Button>
          <Button
            data-testid="cancel-calibration"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Peruuta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
