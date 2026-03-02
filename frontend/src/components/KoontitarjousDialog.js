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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Trash2, FileText } from 'lucide-react';
import { getTarjousSnapshots, deleteTarjousSnapshot, clearTarjousSnapshots } from '@/utils/storage';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
};

export const KoontitarjousDialog = ({ open, onClose, onGenerate, vatPercentage = 25.5 }) => {
  const [snapshots, setSnapshots] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [asiakas, setAsiakas] = useState('');
  const [kohde, setKohde] = useState('');
  const [sisallaAlv, setSisallaAlv] = useState(true);

  // Load snapshots when dialog opens
  useEffect(() => {
    if (open) {
      const loaded = getTarjousSnapshots();
      setSnapshots(loaded);
      setSelectedIds([]);
    }
  }, [open]);

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === snapshots.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(snapshots.map(s => s.id));
    }
  };

  const handleDelete = (id) => {
    deleteTarjousSnapshot(id);
    setSnapshots(prev => prev.filter(s => s.id !== id));
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const handleClearAll = () => {
    if (window.confirm('Haluatko varmasti poistaa kaikki tallennetut tarjoukset?')) {
      clearTarjousSnapshots();
      setSnapshots([]);
      setSelectedIds([]);
    }
  };

  const handleGenerate = () => {
    const selected = snapshots.filter(s => selectedIds.includes(s.id));
    if (selected.length === 0) return;

    onGenerate(selected, {
      asiakas,
      kohde,
      sisallaAlv,
      vatPercentage,
    });
    onClose();
  };

  const selectedTotal = snapshots
    .filter(s => selectedIds.includes(s.id))
    .reduce((sum, s) => sum + (s.totals?.totalCost || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="koontitarjous-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#4A9BAD]">
            Koontitarjous
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="koonto-asiakas">Asiakas</Label>
              <Input
                id="koonto-asiakas"
                value={asiakas}
                onChange={(e) => setAsiakas(e.target.value)}
                placeholder="Asiakkaan nimi"
                data-testid="koontitarjous-asiakas"
              />
            </div>
            <div>
              <Label htmlFor="koonto-kohde">Kohde</Label>
              <Input
                id="koonto-kohde"
                value={kohde}
                onChange={(e) => setKohde(e.target.value)}
                placeholder="Kohteen nimi"
                data-testid="koontitarjous-kohde"
              />
            </div>
          </div>

          {/* VAT toggle */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Switch
              id="koonto-alv"
              checked={sisallaAlv}
              onCheckedChange={setSisallaAlv}
              data-testid="koontitarjous-alv-toggle"
            />
            <Label htmlFor="koonto-alv" className="cursor-pointer">
              Näytä ALV {vatPercentage}%
            </Label>
          </div>

          {/* Snapshots list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Valitse tarjoukset ({snapshots.length} kpl)</Label>
              {snapshots.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    data-testid="koontitarjous-select-all"
                  >
                    {selectedIds.length === snapshots.length ? 'Poista valinnat' : 'Valitse kaikki'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="text-red-500 hover:text-red-700"
                    data-testid="koontitarjous-clear-all"
                  >
                    Tyhjennä kaikki
                  </Button>
                </div>
              )}
            </div>

            {snapshots.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Ei tallennettuja tarjouksia.</p>
                <p className="text-sm mt-1">Luo ensin yksittäisiä tarjouksia "Tee tarjous" -toiminnolla.</p>
              </div>
            ) : (
              <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                {snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className={`flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors ${
                      selectedIds.includes(snapshot.id) ? 'bg-[#4A9BAD]/10' : ''
                    }`}
                    data-testid={`koontitarjous-snapshot-${snapshot.id}`}
                  >
                    <Checkbox
                      checked={selectedIds.includes(snapshot.id)}
                      onCheckedChange={() => handleToggleSelect(snapshot.id)}
                      data-testid={`koontitarjous-checkbox-${snapshot.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{snapshot.title || snapshot.projectName}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(snapshot.createdAt).toLocaleDateString('fi-FI')} 
                        {snapshot.customerName && ` • ${snapshot.customerName}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[#4A9BAD]">
                        {formatCurrency(snapshot.totals?.totalCost)}
                      </p>
                      <p className="text-xs text-gray-500">ALV 0%</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(snapshot.id)}
                      className="text-gray-400 hover:text-red-500"
                      data-testid={`koontitarjous-delete-${snapshot.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected total */}
          {selectedIds.length > 0 && (
            <div className="p-4 bg-[#4A9BAD]/10 rounded-lg" data-testid="koontitarjous-summary">
              <div className="flex justify-between items-center">
                <span className="font-medium">Valittu {selectedIds.length} tarjousta</span>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#4A9BAD]">
                    {formatCurrency(selectedTotal)}
                  </p>
                  {sisallaAlv && (
                    <p className="text-sm text-gray-600">
                      sis. ALV: {formatCurrency(selectedTotal * (1 + vatPercentage / 100))}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={onClose} data-testid="koontitarjous-cancel">
            Peruuta
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={selectedIds.length === 0}
            className="bg-[#4A9BAD] hover:bg-[#3d8494]"
            data-testid="koontitarjous-generate"
          >
            Luo koontitarjous ({selectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
