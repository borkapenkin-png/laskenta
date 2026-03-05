import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Trash2, 
  Save,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Settings2,
  Wrench,
  Calculator
} from 'lucide-react';
import { toast } from 'sonner';

// ==================== STORAGE KEYS ====================
const STORAGE_KEY_PRESETS = 'rakenna_custom_presets';
const STORAGE_KEY_MAKSUERAPRESETS = 'rakenna_maksuerapresets';

// ==================== DEFAULT CONSTRUCTION TYPES ====================
const CONSTRUCTION_TYPES = [
  { value: 'kipsiseina', label: 'Kipsiseinä' },
  { value: 'kipsiotsa', label: 'Kipsiotsa' },
  { value: 'kuivatilaKotelo', label: 'Kuivatila kotelo' },
  { value: 'prhKotelo', label: 'PRH Kotelo' },
  { value: 'kuivatilaAK', label: 'Kuivatila AK' },
  { value: 'markatilaAK', label: 'Märkätila AK' },
  { value: 'prhAK', label: 'PRH AK' },
  { value: 'kuivatilaPystykotelo', label: 'Kuivatila pystykotelo' },
  { value: 'prhPystykotelo', label: 'PRH pystykotelo' },
];

// ==================== DEFAULT PRESETS (same structure as ToolPresetSelector) ====================
const getDefaultPresets = () => ({
  line: {
    groups: [
      {
        name: 'Kotelot',
        items: [
          { id: 'line-1', name: 'Kuivatila kotelot rakennus', price: 35, unit: 'jm', constructionType: 'kuivatilaKotelo', hasOptions: true },
          { id: 'line-2', name: 'Kuivatila kotelot tasoitus ja maalaus', price: 45, unit: 'jm' },
          { id: 'line-3', name: 'PRH Kotelo rakennus', price: 35, unit: 'jm', constructionType: 'prhKotelo', hasOptions: true },
        ]
      },
      {
        name: 'Seinä',
        items: [
          { id: 'line-seina-1', name: 'Kipsiotsa rakennus', price: 20, unit: 'jm', constructionType: 'kipsiotsa', hasOptions: true },
        ]
      },
    ]
  },
  wall: {
    groups: [
      {
        name: 'Maalaus ja tasoitus',
        items: [
          { id: 'wall-1', name: 'Huoltomaalaus', price: 10, unit: 'm²' },
          { id: 'wall-2', name: 'Kipsiseinä tasoitus ja maalaus', price: 20, unit: 'm²' },
          { id: 'wall-3', name: 'Verkkotus, tasoitus ja maalaus', price: 30, unit: 'm²' },
          { id: 'wall-4', name: 'Tapetointi', price: 20, unit: 'm²' },
          { id: 'wall-5', name: 'Mikrotsementi', price: 85, unit: 'm²' },
        ]
      },
      {
        name: 'Seinä rakennus',
        items: [
          { id: 'wall-seina-1', name: 'Kipsiseinä rakennus', price: 25, unit: 'm²', constructionType: 'kipsiseina', hasOptions: true },
        ]
      },
    ]
  },
  rectangle: {
    groups: [
      {
        name: 'Katto',
        items: [
          { id: 'rect-1', name: 'Kipsikatto tasoitus ja maalaus', price: 20, unit: 'm²' },
          { id: 'rect-2', name: 'MT Kipsikatto tasoitus ja maalaus', price: 40, unit: 'm²' },
          { id: 'rect-3', name: 'AK huoltomaalaus', price: 10, unit: 'm²' },
          { id: 'rect-4', name: 'Katto verkotus, tasoitus ja maalaus', price: 30, unit: 'm²' },
        ]
      },
      {
        name: 'Lattia',
        items: [
          { id: 'rect-5', name: 'Pölysidonta', price: 2.5, unit: 'm²' },
          { id: 'rect-6', name: 'Lattiamaalaus/lakkaus', price: 14, unit: 'm²' },
          { id: 'rect-7', name: 'Lattiapinnoitus', price: 45, unit: 'm²' },
        ]
      },
      {
        name: 'Alakatto rakennus',
        items: [
          { id: 'rect-8', name: 'Kuivatila AK rakennus', price: 35, unit: 'm²', constructionType: 'kuivatilaAK', hasOptions: true },
          { id: 'rect-9', name: 'Märkätila AK rakennus', price: 35, unit: 'm²', constructionType: 'markatilaAK', hasOptions: true },
          { id: 'rect-10', name: 'PRH AK rakennus', price: 35, unit: 'm²', constructionType: 'prhAK', hasOptions: true },
        ]
      },
    ]
  },
  polygon: {
    groups: [
      {
        name: 'Katto',
        items: [
          { id: 'poly-1', name: 'Kipsikatto tasoitus ja maalaus', price: 20, unit: 'm²' },
          { id: 'poly-2', name: 'MT Kipsikatto tasoitus ja maalaus', price: 40, unit: 'm²' },
          { id: 'poly-3', name: 'AK huoltomaalaus', price: 10, unit: 'm²' },
          { id: 'poly-4', name: 'Katto verkotus, tasoitus ja maalaus', price: 30, unit: 'm²' },
        ]
      },
      {
        name: 'Lattia',
        items: [
          { id: 'poly-5', name: 'Pölysidonta', price: 2.5, unit: 'm²' },
          { id: 'poly-6', name: 'Lattiamaalaus/lakkaus', price: 14, unit: 'm²' },
          { id: 'poly-7', name: 'Lattiapinnoitus', price: 45, unit: 'm²' },
        ]
      },
      {
        name: 'Alakatto rakennus',
        items: [
          { id: 'poly-8', name: 'Kuivatila AK rakennus', price: 35, unit: 'm²', constructionType: 'kuivatilaAK', hasOptions: true },
          { id: 'poly-9', name: 'Märkätila AK rakennus', price: 35, unit: 'm²', constructionType: 'markatilaAK', hasOptions: true },
          { id: 'poly-10', name: 'PRH AK rakennus', price: 35, unit: 'm²', constructionType: 'prhAK', hasOptions: true },
        ]
      },
    ]
  },
  count: {
    groups: [
      {
        name: 'Ovet ja ikkunat',
        items: [
          { id: 'count-1', name: 'Oven maalaus yheltä puolelta', price: 90, unit: 'kpl' },
          { id: 'count-1b', name: 'Oven maalaus molemmilta puolelta', price: 180, unit: 'kpl' },
          { id: 'count-2', name: 'Sisäikkuna sisäpuolelta', price: 70, unit: 'kpl' },
          { id: 'count-2b', name: 'Sisäikkuna molemmilta puolelta', price: 140, unit: 'kpl' },
          { id: 'count-2c', name: 'Sisä molemmin puolelta ja ulkoikkuna sisäpuolelta', price: 240, unit: 'kpl' },
        ]
      },
      {
        name: 'Pystykotelot rakennus',
        items: [
          { id: 'count-3', name: 'Kuivatila pystykotelo rakennus', price: 35, unit: 'kpl', constructionType: 'kuivatilaPystykotelo', hasOptions: true },
          { id: 'count-4', name: 'PRH pystykotelo rakennus', price: 35, unit: 'kpl', constructionType: 'prhPystykotelo', hasOptions: true },
          { id: 'count-5', name: 'Pystykotelot tasoitus ja maalaus', price: 45, unit: 'kpl', isPystykotelot: true },
        ]
      },
    ]
  }
});

// ==================== DEFAULT MAKSUERÄ PRESETS ====================
const getDefaultMaksueraPresets = () => [
  {
    id: 'yse-6',
    name: 'YSE-6 (balanced)',
    isDefault: true,
    rows: [
      { selite: 'Työmaan käynnistys', percent: 10 },
      { selite: 'Valmistelut', percent: 15 },
      { selite: 'Pohjatyöt', percent: 20 },
      { selite: 'Pintatyöt', percent: 25 },
      { selite: 'Viimeistely', percent: 20 },
      { selite: 'Luovutus / virheet korjattu', percent: 10 },
    ]
  },
  {
    id: 'yse-8',
    name: 'YSE-8 (detailed)',
    isDefault: true,
    rows: [
      { selite: 'Aloitus', percent: 10 },
      { selite: 'Suojaukset', percent: 12 },
      { selite: 'Tasoitusvaihe 1', percent: 13 },
      { selite: 'Tasoitusvaihe 2', percent: 13 },
      { selite: 'Pohjamaalaus', percent: 14 },
      { selite: 'Pintamaalaus', percent: 14 },
      { selite: 'Viimeistely', percent: 14 },
      { selite: 'Vastaanotto', percent: 10 },
    ]
  }
];

// ==================== TOOL TYPE LABELS ====================
const TOOL_LABELS = {
  line: 'Viiva (jm)',
  wall: 'Seinä (jm → m²)',
  rectangle: 'Suorakulmio (m²)',
  polygon: 'Monikulmio (m²)',
  count: 'Kappalemäärä (kpl)'
};

const UNIT_OPTIONS = [
  { value: 'm²', label: 'm² (neliömetri)' },
  { value: 'jm', label: 'jm (juoksumetri)' },
  { value: 'kpl', label: 'kpl (kappale)' }
];

// ==================== LOAD/SAVE FUNCTIONS ====================
export const loadCustomPresets = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PRESETS);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading custom presets:', e);
  }
  return getDefaultPresets();
};

export const saveCustomPresets = (presets) => {
  try {
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
  } catch (e) {
    console.error('Error saving custom presets:', e);
  }
};

export const loadMaksueraPresets = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MAKSUERAPRESETS);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading maksuerä presets:', e);
  }
  return getDefaultMaksueraPresets();
};

export const saveMaksueraPresets = (presets) => {
  try {
    localStorage.setItem(STORAGE_KEY_MAKSUERAPRESETS, JSON.stringify(presets));
  } catch (e) {
    console.error('Error saving maksuerä presets:', e);
  }
};

// ==================== PRESET ITEM EDITOR ====================
const PresetItemEditor = ({ item, onUpdate, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="border rounded-lg p-3 bg-white">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium text-sm truncate">{item.name}</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{item.price} €/{item.unit}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(item.id)}
            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nimi</Label>
              <Input
                value={item.name}
                onChange={(e) => onUpdate({ ...item, name: e.target.value })}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Hinta (€)</Label>
              <Input
                type="number"
                step="0.5"
                value={item.price}
                onChange={(e) => onUpdate({ ...item, price: parseFloat(e.target.value) || 0 })}
                className="h-8"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Yksikkö</Label>
              <Select value={item.unit} onValueChange={(v) => onUpdate({ ...item, unit: v })}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Rakennus-tyyppi</Label>
              <Select 
                value={item.constructionType || 'none'} 
                onValueChange={(v) => onUpdate({ 
                  ...item, 
                  constructionType: v === 'none' ? null : v,
                  hasOptions: v !== 'none'
                })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Ei rakennus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ei rakennus</SelectItem>
                  {CONSTRUCTION_TYPES.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {item.constructionType && (
            <div className="p-2 bg-teal-50 rounded text-xs text-teal-700">
              Rakennus-tyyppi: Karkass, Villa ja Kipsi -valinnat tulevat automaattisesti
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==================== TOOL PRESETS TAB ====================
const ToolPresetsTab = ({ presets, setPresets }) => {
  const [selectedTool, setSelectedTool] = useState('rectangle');
  const [selectedGroup, setSelectedGroup] = useState(null);
  
  const toolPresets = presets[selectedTool] || { groups: [] };
  
  useEffect(() => {
    if (toolPresets.groups.length > 0 && !selectedGroup) {
      setSelectedGroup(toolPresets.groups[0].name);
    }
  }, [selectedTool, toolPresets.groups, selectedGroup]);
  
  const currentGroup = toolPresets.groups.find(g => g.name === selectedGroup);
  
  const handleUpdateItem = (updatedItem) => {
    const newPresets = { ...presets };
    const groups = newPresets[selectedTool].groups.map(group => {
      if (group.name === selectedGroup) {
        return {
          ...group,
          items: group.items.map(item => item.id === updatedItem.id ? updatedItem : item)
        };
      }
      return group;
    });
    newPresets[selectedTool] = { groups };
    setPresets(newPresets);
  };
  
  const handleDeleteItem = (itemId) => {
    const newPresets = { ...presets };
    const groups = newPresets[selectedTool].groups.map(group => {
      if (group.name === selectedGroup) {
        return {
          ...group,
          items: group.items.filter(item => item.id !== itemId)
        };
      }
      return group;
    });
    newPresets[selectedTool] = { groups };
    setPresets(newPresets);
  };
  
  const handleAddItem = () => {
    const newId = `${selectedTool}-custom-${Date.now()}`;
    const defaultUnit = selectedTool === 'count' ? 'kpl' : (selectedTool === 'line' ? 'jm' : 'm²');
    const newItem = {
      id: newId,
      name: 'Uusi preset',
      price: 0,
      unit: defaultUnit
    };
    
    const newPresets = { ...presets };
    const groups = newPresets[selectedTool].groups.map(group => {
      if (group.name === selectedGroup) {
        return {
          ...group,
          items: [...group.items, newItem]
        };
      }
      return group;
    });
    newPresets[selectedTool] = { groups };
    setPresets(newPresets);
  };
  
  const handleAddGroup = () => {
    const groupName = prompt('Anna uuden ryhmän nimi:');
    if (!groupName) return;
    
    const newPresets = { ...presets };
    newPresets[selectedTool].groups.push({
      name: groupName,
      items: []
    });
    setPresets(newPresets);
    setSelectedGroup(groupName);
  };
  
  const handleDeleteGroup = () => {
    if (!selectedGroup) return;
    if (!confirm(`Haluatko varmasti poistaa ryhmän "${selectedGroup}" ja kaikki sen presetit?`)) return;
    
    const newPresets = { ...presets };
    newPresets[selectedTool].groups = newPresets[selectedTool].groups.filter(g => g.name !== selectedGroup);
    setPresets(newPresets);
    setSelectedGroup(newPresets[selectedTool].groups[0]?.name || null);
  };
  
  return (
    <div className="space-y-4">
      {/* Tool selector */}
      <div>
        <Label className="text-xs text-gray-500">Työkalu</Label>
        <Select value={selectedTool} onValueChange={(v) => { setSelectedTool(v); setSelectedGroup(null); }}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TOOL_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Group selector */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs text-gray-500">Ryhmä</Label>
          <Select value={selectedGroup || ''} onValueChange={setSelectedGroup}>
            <SelectTrigger>
              <SelectValue placeholder="Valitse ryhmä" />
            </SelectTrigger>
            <SelectContent>
              {toolPresets.groups.map((group) => (
                <SelectItem key={group.name} value={group.name}>{group.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-1">
          <Button size="sm" variant="outline" onClick={handleAddGroup} className="h-9">
            <Plus className="h-4 w-4" />
          </Button>
          {selectedGroup && (
            <Button size="sm" variant="outline" onClick={handleDeleteGroup} className="h-9 text-red-500">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Items list */}
      {currentGroup && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{currentGroup.name}</Label>
            <Button size="sm" onClick={handleAddItem} className="h-7 bg-teal-600 hover:bg-teal-700">
              <Plus className="h-4 w-4 mr-1" /> Lisää preset
            </Button>
          </div>
          
          <ScrollArea className="h-[300px]">
            <div className="space-y-2 pr-2">
              {currentGroup.items.map(item => (
                <PresetItemEditor
                  key={item.id}
                  item={item}
                  onUpdate={handleUpdateItem}
                  onDelete={handleDeleteItem}
                />
              ))}
              {currentGroup.items.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  Ei presettejä tässä ryhmässä
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

// ==================== MAKSUERÄ PRESETS TAB ====================
const MaksueraPresetsTab = ({ presets, setPresets }) => {
  const [selectedPresetId, setSelectedPresetId] = useState(null);
  const [newPresetName, setNewPresetName] = useState('');
  
  const selectedPreset = presets.find(p => p.id === selectedPresetId);
  
  const handleAddPreset = () => {
    if (!newPresetName.trim()) {
      toast.error('Anna presetin nimi');
      return;
    }
    
    const newPreset = {
      id: `custom-${Date.now()}`,
      name: newPresetName.trim(),
      isDefault: false,
      rows: [
        { selite: 'Aloitus', percent: 10 },
        { selite: 'Työvaihe 1', percent: 40 },
        { selite: 'Työvaihe 2', percent: 40 },
        { selite: 'Luovutus', percent: 10 },
      ]
    };
    
    setPresets([...presets, newPreset]);
    setNewPresetName('');
    setSelectedPresetId(newPreset.id);
    toast.success('Preset lisätty');
  };
  
  const handleDeletePreset = (presetId) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset?.isDefault) {
      toast.error('Oletuspresettiä ei voi poistaa');
      return;
    }
    
    setPresets(presets.filter(p => p.id !== presetId));
    if (selectedPresetId === presetId) {
      setSelectedPresetId(null);
    }
    toast.success('Preset poistettu');
  };
  
  const handleUpdateRow = (rowIndex, field, value) => {
    const newPresets = presets.map(p => {
      if (p.id === selectedPresetId) {
        const newRows = [...p.rows];
        newRows[rowIndex] = { ...newRows[rowIndex], [field]: value };
        return { ...p, rows: newRows };
      }
      return p;
    });
    setPresets(newPresets);
  };
  
  const handleAddRow = () => {
    const newPresets = presets.map(p => {
      if (p.id === selectedPresetId) {
        return { ...p, rows: [...p.rows, { selite: 'Uusi vaihe', percent: 0 }] };
      }
      return p;
    });
    setPresets(newPresets);
  };
  
  const handleDeleteRow = (rowIndex) => {
    const newPresets = presets.map(p => {
      if (p.id === selectedPresetId) {
        const newRows = p.rows.filter((_, i) => i !== rowIndex);
        return { ...p, rows: newRows };
      }
      return p;
    });
    setPresets(newPresets);
  };
  
  const totalPercent = selectedPreset?.rows.reduce((sum, r) => sum + (r.percent || 0), 0) || 0;
  
  return (
    <div className="space-y-4">
      {/* Add new preset */}
      <div className="flex gap-2">
        <Input
          placeholder="Uuden presetin nimi..."
          value={newPresetName}
          onChange={(e) => setNewPresetName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddPreset()}
          className="flex-1"
        />
        <Button onClick={handleAddPreset} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="h-4 w-4 mr-1" /> Lisää
        </Button>
      </div>
      
      {/* Preset list */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Presetit</Label>
        <div className="grid grid-cols-2 gap-2">
          {presets.map(preset => (
            <div
              key={preset.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedPresetId === preset.id 
                  ? 'border-teal-500 bg-teal-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedPresetId(preset.id)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{preset.name}</span>
                {!preset.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id); }}
                    className="h-6 w-6 p-0 text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {preset.rows?.length || 0} riviä
                {preset.isDefault && <span className="ml-2 text-teal-600">(oletus)</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Edit selected preset */}
      {selectedPreset && !selectedPreset.isDefault && (
        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Muokkaa: {selectedPreset.name}</Label>
            <div className={`text-sm font-medium ${totalPercent === 100 ? 'text-green-600' : 'text-red-600'}`}>
              Yhteensä: {totalPercent}%
            </div>
          </div>
          
          <ScrollArea className="h-[200px]">
            <div className="space-y-2 pr-2">
              {selectedPreset.rows.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    value={row.selite}
                    onChange={(e) => handleUpdateRow(idx, 'selite', e.target.value)}
                    className="flex-1 h-8"
                    placeholder="Selite"
                  />
                  <Input
                    type="number"
                    value={row.percent}
                    onChange={(e) => handleUpdateRow(idx, 'percent', parseFloat(e.target.value) || 0)}
                    className="w-20 h-8"
                  />
                  <span className="text-sm text-gray-500">%</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteRow(idx)}
                    className="h-8 w-8 p-0 text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <Button size="sm" variant="outline" onClick={handleAddRow}>
            <Plus className="h-4 w-4 mr-1" /> Lisää rivi
          </Button>
        </div>
      )}
      
      {selectedPreset?.isDefault && (
        <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
          Oletuspresettiä ei voi muokata. Luo uusi preset muokataksesi.
        </div>
      )}
    </div>
  );
};

// ==================== MAIN SETTINGS DIALOG ====================
export const SettingsDialog = ({ open, onClose, onPresetsChange }) => {
  const [toolPresets, setToolPresets] = useState(() => loadCustomPresets());
  const [maksueraPresets, setMaksueraPresets] = useState(() => loadMaksueraPresets());
  const [hasChanges, setHasChanges] = useState(false);
  
  // Track changes
  useEffect(() => {
    setHasChanges(true);
  }, [toolPresets, maksueraPresets]);
  
  const handleSave = () => {
    saveCustomPresets(toolPresets);
    saveMaksueraPresets(maksueraPresets);
    if (onPresetsChange) {
      onPresetsChange(toolPresets, maksueraPresets);
    }
    setHasChanges(false);
    toast.success('Asetukset tallennettu');
  };
  
  const handleReset = () => {
    if (!confirm('Haluatko varmasti palauttaa kaikki oletusasetukset? Tämä poistaa kaikki mukautetut presetit.')) return;
    
    const defaults = getDefaultPresets();
    const defaultMaksuera = getDefaultMaksueraPresets();
    setToolPresets(defaults);
    setMaksueraPresets(defaultMaksuera);
    saveCustomPresets(defaults);
    saveMaksueraPresets(defaultMaksuera);
    if (onPresetsChange) {
      onPresetsChange(defaults, defaultMaksuera);
    }
    toast.success('Oletusasetukset palautettu');
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Asetukset
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="presets" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="presets" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Mittaus presetit
            </TabsTrigger>
            <TabsTrigger value="maksuerataulukko" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Maksuerätaulukko
            </TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-auto p-1">
            <TabsContent value="presets" className="mt-4">
              <ToolPresetsTab presets={toolPresets} setPresets={setToolPresets} />
            </TabsContent>
            
            <TabsContent value="maksuerataulukko" className="mt-4">
              <MaksueraPresetsTab presets={maksueraPresets} setPresets={setMaksueraPresets} />
            </TabsContent>
          </div>
        </Tabs>
        
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleReset} className="text-red-600 hover:text-red-700">
            <RotateCcw className="h-4 w-4 mr-2" />
            Palauta oletukset
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Peruuta
            </Button>
            <Button onClick={handleSave} className="bg-teal-600 hover:bg-teal-700">
              <Save className="h-4 w-4 mr-2" />
              Tallenna
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
