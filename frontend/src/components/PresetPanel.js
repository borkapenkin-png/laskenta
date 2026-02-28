import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

const categories = ['Tasoitus', 'Maalaus', 'Rappaus', 'Muut'];
const subcategories = ['Seinät', 'Katot', 'Julkisivu', 'Metalli', 'Kaiteet', 'Ovet', 'Ikkunat', 'Muu'];
const units = ['m²', 'jm', 'kpl'];

export const PresetPanel = ({ presets, onSave, onDelete, onApply }) => {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [isAdding, setIsAdding] = useState(false);

  const startAdd = () => {
    setIsAdding(true);
    setEditData({
      name: '',
      category: 'Maalaus',
      subcategory: 'Seinät',
      unit: 'm²',
      waste: 5,
      layers: 1,
      productivity: 8,
      materialCost: 2.5,
      wallHeight: 2.6,
      bothSides: false
    });
  };

  const startEdit = (preset) => {
    setEditingId(preset.id);
    setEditData({ ...preset });
  };

  const savePreset = () => {
    if (isAdding) {
      onSave({ ...editData, id: `preset-${Date.now()}` });
      setIsAdding(false);
    } else {
      onSave(editData);
      setEditingId(null);
    }
    setEditData({});
  };

  const cancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setEditData({});
  };

  const PresetForm = ({ data, onChange }) => (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500">Nimi</label>
        <Input
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          placeholder="Esim. Maalaus seinät 2x"
          className="h-8"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">Kategoria</label>
          <Select
            value={data.category}
            onValueChange={(value) => onChange({ ...data, category: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-gray-500">Alakategoria</label>
          <Select
            value={data.subcategory}
            onValueChange={(value) => onChange({ ...data, subcategory: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {subcategories.map(sub => (
                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-gray-500">Yksikkö</label>
          <Select
            value={data.unit}
            onValueChange={(value) => onChange({ ...data, unit: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {units.map(unit => (
                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-gray-500">Hukka %</label>
          <Input
            type="number"
            value={data.waste}
            onChange={(e) => onChange({ ...data, waste: parseInt(e.target.value) || 0 })}
            className="h-8"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">Kerrokset</label>
          <Input
            type="number"
            value={data.layers}
            onChange={(e) => onChange({ ...data, layers: parseInt(e.target.value) || 1 })}
            className="h-8"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">Tuottavuus (m²/h)</label>
          <Input
            type="number"
            step="0.1"
            value={data.productivity}
            onChange={(e) => onChange({ ...data, productivity: parseFloat(e.target.value) || 1 })}
            className="h-8"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">Materiaali (€/yks)</label>
          <Input
            type="number"
            step="0.1"
            value={data.materialCost}
            onChange={(e) => onChange({ ...data, materialCost: parseFloat(e.target.value) || 0 })}
            className="h-8"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">Seinäkorkeus (m)</label>
          <Input
            type="number"
            step="0.1"
            value={data.wallHeight || ''}
            onChange={(e) => onChange({ ...data, wallHeight: parseFloat(e.target.value) || null })}
            className="h-8"
            placeholder="2.6"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Presetit
          </h2>
          <Button
            data-testid="add-preset-button"
            size="sm"
            onClick={startAdd}
            disabled={isAdding || editingId}
            className="bg-[#0052CC] hover:bg-[#0043A8]"
          >
            <Plus className="h-4 w-4 mr-1" />
            Uusi
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {presets.length} presettiä
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {isAdding && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <PresetForm data={editData} onChange={setEditData} />
              <div className="flex gap-2 mt-3">
                <Button
                  data-testid="save-new-preset"
                  size="sm"
                  onClick={savePreset}
                  className="flex-1 bg-[#0052CC] hover:bg-[#0043A8]"
                  disabled={!editData.name}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Tallenna
                </Button>
                <Button
                  data-testid="cancel-new-preset"
                  size="sm"
                  variant="outline"
                  onClick={cancel}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-1" />
                  Peruuta
                </Button>
              </div>
            </div>
          )}

          {presets.map((preset) => {
            const isEditing = editingId === preset.id;

            return (
              <div
                key={preset.id}
                data-testid={`preset-${preset.id}`}
                className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
              >
                {isEditing ? (
                  <>
                    <PresetForm data={editData} onChange={setEditData} />
                    <div className="flex gap-2 mt-3">
                      <Button
                        data-testid={`save-preset-${preset.id}`}
                        size="sm"
                        onClick={savePreset}
                        className="flex-1 bg-[#0052CC] hover:bg-[#0043A8]"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Tallenna
                      </Button>
                      <Button
                        data-testid={`cancel-preset-${preset.id}`}
                        size="sm"
                        variant="outline"
                        onClick={cancel}
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Peruuta
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold text-gray-900 mb-2">{preset.name}</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                      <div>
                        <span className="text-gray-500">Kategoria:</span> {preset.category}
                      </div>
                      <div>
                        <span className="text-gray-500">Alakategoria:</span> {preset.subcategory}
                      </div>
                      <div>
                        <span className="text-gray-500">Yksikkö:</span> {preset.unit}
                      </div>
                      <div>
                        <span className="text-gray-500">Hukka:</span> {preset.waste}%
                      </div>
                      <div>
                        <span className="text-gray-500">Kerrokset:</span> {preset.layers}x
                      </div>
                      <div>
                        <span className="text-gray-500">Tuottavuus:</span> {preset.productivity} m²/h
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        data-testid={`apply-preset-${preset.id}`}
                        size="sm"
                        onClick={() => onApply(preset)}
                        className="flex-1 bg-[#0052CC] hover:bg-[#0043A8]"
                      >
                        Käytä
                      </Button>
                      <Button
                        data-testid={`edit-preset-${preset.id}`}
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(preset)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        data-testid={`delete-preset-${preset.id}`}
                        size="sm"
                        variant="outline"
                        onClick={() => onDelete(preset.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};