import React, { useState } from 'react';
import { Trash2, Edit2, Check, X, Plus, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

export const PresetPanel = ({ presets, onSave, onDelete, onApply }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const startAdd = () => {
    setIsAdding(true);
    setEditData({
      name: '',
      unit: 'm²',
      pricePerUnit: 0
    });
  };

  const startEdit = (preset) => {
    setEditingId(preset.id);
    setEditData({ ...preset });
  };

  const savePreset = () => {
    if (!editData.name) return;
    
    const preset = {
      ...editData,
      id: editingId || `preset-${Date.now()}`
    };
    
    onSave(preset);
    setIsAdding(false);
    setEditingId(null);
    setEditData({});
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    setEditData({});
  };

  const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Preset form component
  const PresetForm = ({ data, onChange }) => (
    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
      <div>
        <Label className="text-xs">Nimi</Label>
        <Input
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          placeholder="Esim. Seinämaalaus"
          className="h-8"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Yksikkö</Label>
          <Input
            value={data.unit}
            onChange={(e) => onChange({ ...data, unit: e.target.value })}
            placeholder="m²"
            className="h-8"
          />
        </div>
        <div>
          <Label className="text-xs">Hinta (€/{data.unit || 'yks'})</Label>
          <Input
            type="number"
            step="0.5"
            value={data.pricePerUnit}
            onChange={(e) => onChange({ ...data, pricePerUnit: parseFloat(e.target.value) || 0 })}
            className="h-8"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={savePreset} className="flex-1 bg-green-600 hover:bg-green-700">
          <Check className="h-4 w-4 mr-1" /> Tallenna
        </Button>
        <Button size="sm" variant="outline" onClick={cancelEdit} className="flex-1">
          <X className="h-4 w-4 mr-1" /> Peruuta
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Presetit</h2>
          <p className="text-sm text-gray-500">Valmiit tuotteet/työt</p>
        </div>
        {!isAdding && (
          <Button size="sm" onClick={startAdd} className="bg-[#0052CC]">
            <Plus className="h-4 w-4 mr-1" /> Lisää
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {isAdding && (
            <PresetForm data={editData} onChange={setEditData} />
          )}

          {presets.length === 0 && !isAdding ? (
            <div className="text-center text-gray-400 py-8">
              <p>Ei presettejä</p>
              <p className="text-xs mt-1">Lisää tuotteita/töitä nopeampaan mittaukseen</p>
            </div>
          ) : (
            presets.map((preset) => {
              const isEditing = editingId === preset.id;

              if (isEditing) {
                return (
                  <PresetForm key={preset.id} data={editData} onChange={setEditData} />
                );
              }

              return (
                <div
                  key={preset.id}
                  className="border rounded-lg p-3 bg-white border-gray-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{preset.name}</div>
                      <div className="text-xs text-gray-500">
                        {formatNumber(preset.pricePerUnit)} € / {preset.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onApply(preset)}
                        className="h-8 px-2"
                        title="Käytä mittaukseen"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(preset)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(preset.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Default presets suggestion */}
      {presets.length === 0 && !isAdding && (
        <div className="border-t pt-4 mt-4">
          <p className="text-xs text-gray-500 mb-2">Esimerkkipresettejä:</p>
          <div className="space-y-1">
            {[
              { name: 'Seinämaalaus', unit: 'm²', pricePerUnit: 15 },
              { name: 'Kattomaalaus', unit: 'm²', pricePerUnit: 12 },
              { name: 'Tasoitus', unit: 'm²', pricePerUnit: 8 },
              { name: 'Rappaus', unit: 'm²', pricePerUnit: 25 }
            ].map((example, i) => (
              <Button
                key={i}
                size="sm"
                variant="ghost"
                onClick={() => onSave({ ...example, id: `preset-${Date.now()}-${i}` })}
                className="w-full justify-start text-xs h-7"
              >
                <Plus className="h-3 w-3 mr-1" /> {example.name} ({example.pricePerUnit} €/{example.unit})
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
