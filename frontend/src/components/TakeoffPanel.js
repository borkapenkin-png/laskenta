import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Edit2, Check, X, Copy, Footprints, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { 
  FRAME_OPTIONS_EXPORT as FRAME_OPTIONS,
  INSULATION_OPTIONS_EXPORT as INSULATION_OPTIONS,
  GYPSUM_OPTIONS_EXPORT as GYPSUM_OPTIONS,
  CONSTRUCTION_PRICES_EXPORT as CONSTRUCTION_PRICES,
  calculateConstructionPriceExport as calculateConstructionPrice
} from './ToolPresetSelector';

// Jalkalista price constant
const JALKALISTA_PRICE = 5; // €/jm

// Generate unified name from construction options
const generateConstructionName = (baseType, options) => {
  const parts = [baseType];
  
  if (options?.frameType) {
    parts.push(options.frameType === 'metalliranka' ? 'metalliranka' : 'puurunko');
  }
  if (options?.insulation) {
    parts.push(options.insulation === 'villalla' ? 'villalla' : 'ilman villaa');
  }
  if (options?.gypsumLayers) {
    parts.push(`${options.gypsumLayers}x kipsi`);
  }
  
  return parts.join(', ');
};

// Unified Construction Options Editor Component
const ConstructionOptionsEditor = ({ editData, setEditData, formatNumber }) => {
  const options = editData.constructionOptions || {
    frameType: 'puurunko',
    insulation: 'ilman',
    gypsumLayers: '1'
  };

  // Update options and recalculate price
  const handleOptionChange = (field, value) => {
    const newOptions = { ...options, [field]: value };
    const newPrice = calculateConstructionPrice(editData.constructionType, newOptions);
    
    // Get base type name for label
    const baseName = editData.label?.split(',')[0] || 'Rakennus';
    const newLabel = generateConstructionName(baseName, newOptions);
    
    setEditData({
      ...editData,
      constructionOptions: newOptions,
      pricePerUnit: newPrice,
      label: newLabel
    });
  };

  // Check if this is a pystykotelo type (needs height)
  const isPystykoteloType = editData.constructionType?.includes('Pystykotelo') || 
    editData.constructionType === 'kuivatilaPystykotelo' || 
    editData.constructionType === 'prhPystykotelo';

  return (
    <div className="space-y-2 p-2 bg-[#4A9BAD]/10 rounded-lg">
      <div className="text-xs font-medium text-[#4A9BAD]">Rakennus asetukset</div>
      
      {/* Height for pystykotelo types */}
      {isPystykoteloType && (
        <div>
          <label className="text-xs text-gray-500">Korkeus (m)</label>
          <Input
            type="number"
            step="0.1"
            value={editData.wallHeight || 2.6}
            onChange={(e) => setEditData({ ...editData, wallHeight: parseFloat(e.target.value) || 2.6 })}
            className="h-8"
          />
          {editData.wallHeight && editData.quantity && (
            <p className="text-xs text-gray-400 mt-1">
              = {formatNumber(editData.quantity * editData.wallHeight)} jm
            </p>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-3 gap-2">
        {/* Frame type */}
        <div>
          <label className="text-xs text-gray-500">Karkass</label>
          <Select value={options.frameType} onValueChange={(v) => handleOptionChange('frameType', v)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FRAME_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Insulation */}
        <div>
          <label className="text-xs text-gray-500">Villa</label>
          <Select value={options.insulation} onValueChange={(v) => handleOptionChange('insulation', v)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSULATION_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Gypsum layers */}
        <div>
          <label className="text-xs text-gray-500">Kipsi</label>
          <Select value={options.gypsumLayers} onValueChange={(v) => handleOptionChange('gypsumLayers', v)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GYPSUM_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Live price preview */}
      <div className="text-xs text-gray-600 mt-1">
        Laskettu hinta: <span className="font-medium">{editData.pricePerUnit} €/{editData.unit}</span>
      </div>
    </div>
  );
};

// Rakennustyö presets - different construction types
const RAKENNUSTYO_PRESETS = [
  { name: 'Purkutyöt', price: 0 },
  { name: 'Suojaustyöt', price: 0 },
  { name: 'Siivoustyöt', price: 0 },
  { name: 'Jätteenkäsittely', price: 0 },
  { name: 'Kuljetustyöt', price: 0 },
  { name: 'Nostotyöt', price: 0 },
  { name: 'Telinetyöt', price: 0 },
  { name: 'Korjaustyöt', price: 0 },
  { name: 'Asennustyöt', price: 0 },
];

// All presets by type - used for changing preset in edit mode
const ALL_PRESETS = {
  line: [
    { id: 'line-1', name: 'Kuivatila kotelot rakennus', price: 35, unit: 'jm', isKuivatilaRakennus: true },
    { id: 'line-2', name: 'Kuivatila kotelot tasoitus ja maalaus', price: 45, unit: 'jm' },
    { id: 'line-3', name: 'PRH Kotelo rakennus', price: 35, unit: 'jm', isPRHRakennus: true },
    { id: 'line-other', name: 'Muu', price: 0, unit: 'jm', isCustom: true }
  ],
  wall: [
    { id: 'wall-1', name: 'Huoltomaalaus', price: 10, unit: 'm²' },
    { id: 'wall-2', name: 'Kipsiseinä tasoitus ja maalaus', price: 20, unit: 'm²' },
    { id: 'wall-3', name: 'Verkkotus, tasoitus ja maalaus', price: 30, unit: 'm²' },
    { id: 'wall-4', name: 'Tapetointi', price: 20, unit: 'm²' },
    { id: 'wall-5', name: 'Mikrotsementi', price: 85, unit: 'm²' },
    { id: 'wall-other', name: 'Muu', price: 0, unit: 'm²', isCustom: true }
  ],
  rectangle: [
    { id: 'rect-1', name: 'Kipsikatto tasoitus ja maalaus', price: 20, unit: 'm²' },
    { id: 'rect-2', name: 'MT Kipsikatto tasoitus ja maalaus', price: 40, unit: 'm²' },
    { id: 'rect-3', name: 'AK huoltomaalaus', price: 10, unit: 'm²' },
    { id: 'rect-4', name: 'Katto verkotus, tasoitus ja maalaus', price: 30, unit: 'm²' },
    { id: 'rect-5', name: 'Pölysidonta', price: 2.5, unit: 'm²' },
    { id: 'rect-6', name: 'Lattiamaalaus/lakkaus', price: 14, unit: 'm²' },
    { id: 'rect-7', name: 'Lattiapinnoitus', price: 45, unit: 'm²' },
    { id: 'rect-8', name: 'Kuivatila AK Rakennus', price: 35, unit: 'm²', isKuivatilaAK: true },
    { id: 'rect-9', name: 'Märkätila AK Rakennus', price: 35, unit: 'm²', isMarkatilaAK: true },
    { id: 'rect-10', name: 'PRH AK Rakennus', price: 35, unit: 'm²', isPRHAK: true },
    { id: 'rect-other', name: 'Muu', price: 0, unit: 'm²', isCustom: true }
  ],
  polygon: [
    { id: 'poly-1', name: 'Kipsikatto tasoitus ja maalaus', price: 20, unit: 'm²' },
    { id: 'poly-2', name: 'MT Kipsikatto tasoitus ja maalaus', price: 40, unit: 'm²' },
    { id: 'poly-3', name: 'AK huoltomaalaus', price: 10, unit: 'm²' },
    { id: 'poly-4', name: 'Katto verkotus, tasoitus ja maalaus', price: 30, unit: 'm²' },
    { id: 'poly-5', name: 'Pölysidonta', price: 2.5, unit: 'm²' },
    { id: 'poly-6', name: 'Lattiamaalaus/lakkaus', price: 14, unit: 'm²' },
    { id: 'poly-7', name: 'Lattiapinnoitus', price: 45, unit: 'm²' },
    { id: 'poly-8', name: 'Kuivatila AK Rakennus', price: 35, unit: 'm²', isKuivatilaAK: true },
    { id: 'poly-9', name: 'Märkätila AK Rakennus', price: 35, unit: 'm²', isMarkatilaAK: true },
    { id: 'poly-10', name: 'PRH AK Rakennus', price: 35, unit: 'm²', isPRHAK: true },
    { id: 'poly-other', name: 'Muu', price: 0, unit: 'm²', isCustom: true }
  ],
  count: [
    { id: 'count-1', name: 'Oven maalaus yheltä puolelta', price: 90, unit: 'kpl' },
    { id: 'count-1b', name: 'Oven maalaus molemmilta puolelta', price: 180, unit: 'kpl' },
    { id: 'count-2', name: 'Sisäikkuna sisäpuolelta', price: 70, unit: 'kpl' },
    { id: 'count-2b', name: 'Sisäikkuna molemmilta puolelta', price: 140, unit: 'kpl' },
    { id: 'count-2c', name: 'Sisä molemmin puolelta ja ulkoikkuna sisäpuolelta', price: 240, unit: 'kpl' },
    { id: 'count-3', name: 'Kuivatila pystykotelo rakennus', price: 35, unit: 'kpl', isKuivatilaPystykotelo: true },
    { id: 'count-4', name: 'PRH pystykotelo rakennus', price: 35, unit: 'kpl', isPRHPystykotelo: true },
    { id: 'count-5', name: 'Pystykotelot tasoitus ja maalaus', price: 45, unit: 'kpl', isPystykotelot: true },
    { id: 'count-other', name: 'Muu', price: 0, unit: 'kpl', isCustom: true }
  ]
};

export const TakeoffPanel = ({ 
  measurements, 
  onUpdate, 
  onUpdateByLabel,
  onDelete, 
  onCopy, 
  onAddJalkalista,
  onAddJalkalistaAll,
  settings, 
  selectedMeasurementId, 
  onMeasurementSelect
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupEditData, setGroupEditData] = useState({});
  const containerRef = useRef(null);

  const startEdit = (measurement) => {
    setEditingId(measurement.id);
    setEditData({ ...measurement });
  };

  const saveEdit = () => {
    onUpdate(editingId, editData);
    setEditingId(null);
    setEditData({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  // Group editing - edit all measurements with same label
  const startGroupEdit = (groupKey, groupData) => {
    setEditingGroup(groupKey);
    setGroupEditData({ label: groupData.label, pricePerUnit: groupData.pricePerUnit });
  };

  const saveGroupEdit = () => {
    if (editingGroup && onUpdateByLabel) {
      onUpdateByLabel(editingGroup, groupEditData);
    }
    setEditingGroup(null);
    setGroupEditData({});
  };

  const cancelGroupEdit = () => {
    setEditingGroup(null);
    setGroupEditData({});
  };

  // Simple calculation: quantity * price
  const calculateRow = (m) => {
    let effectiveQuantity = m.quantity || 0;
    let displayUnit = m.unit || 'kpl';

    // For wall type: convert running meters to m² if height is set
    if (m.type === 'wall' && m.wallHeight) {
      const bruttoM2 = effectiveQuantity * m.wallHeight * (m.bothSides ? 2 : 1);
      const openings = m.openings || 0;
      effectiveQuantity = bruttoM2 - openings;
    }
    
    // Determine costQuantity - the quantity used for cost calculation
    let costQuantity = effectiveQuantity;
    let totalJm = null;
    
    // For Pystykotelot types: kpl × height = jm (running meters)
    // Display shows kpl count, but also calculate total jm
    if ((m.isPystykotelot || m.isKuivatilaPystykotelo || m.isPRHPystykotelo) && m.wallHeight) {
      totalJm = m.quantity * m.wallHeight; // kpl × height = jm
      costQuantity = totalJm; // Price is per jm, so cost is based on total jm
    }

    const pricePerUnit = m.pricePerUnit || 0;
    const totalCost = costQuantity * pricePerUnit;

    return {
      effectiveQuantity,
      displayUnit,
      totalCost,
      // For Pystykotelot, show total jm (kpl × height)
      totalJm
    };
  };

  const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Group measurements by label for summary
  const groupedMeasurements = measurements.reduce((acc, m) => {
    const key = m.label || 'Muu';
    if (!acc[key]) {
      acc[key] = {
        label: m.label || 'Muu',
        unit: m.unit,
        pricePerUnit: m.pricePerUnit || 0,
        totalQuantity: 0,
        totalCost: 0,
        count: 0
      };
    }
    const calc = calculateRow(m);
    acc[key].totalQuantity += calc.effectiveQuantity;
    acc[key].totalCost += calc.totalCost;
    acc[key].count += 1;
    return acc;
  }, {});

  const groupedArray = Object.values(groupedMeasurements).sort((a, b) => b.totalCost - a.totalCost);

  // Calculate totals
  const totals = measurements.reduce((acc, m) => {
    const calc = calculateRow(m);
    return {
      totalCost: acc.totalCost + calc.totalCost
    };
  }, { totalCost: 0 });

  const vatPercentage = settings?.vatPercentage || 25.5;
  const totalWithVat = totals.totalCost * (1 + vatPercentage / 100);

  return (
    <div ref={containerRef} className="h-full flex flex-col p-4 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Määrälaskenta</h2>
          <p className="text-sm text-gray-500">{measurements.length} mittausta</p>
        </div>
        {/* Add jalkalistat to all walls button */}
        {measurements.some(m => m.type === 'wall') && onAddJalkalistaAll && (
          <Button
            size="sm"
            variant="outline"
            onClick={onAddJalkalistaAll}
            className="text-xs border-green-300 text-green-700 hover:bg-green-50"
            data-testid="add-jalkalistat-all-btn"
            title="Lisää jalkalista maalaus kaikille seinille"
          >
            <Footprints className="h-3.5 w-3.5 mr-1" />
            Jalkalistat kaikille
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        {measurements.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            Aloita mittaamalla PDF:stä
          </div>
        ) : (
          <div className="space-y-2">
            {measurements.map((measurement) => {
              const isEditing = editingId === measurement.id;
              const isSelected = selectedMeasurementId === measurement.id;
              const calc = calculateRow(isEditing ? editData : measurement);

              return (
                <div
                  key={measurement.id}
                  data-testid={`measurement-row-${measurement.id}`}
                  onClick={(e) => {
                    if (e.target.closest('button') || e.target.closest('input')) return;
                    if (!isEditing && onMeasurementSelect) {
                      onMeasurementSelect(measurement.id);
                    }
                  }}
                  className={`border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer ${
                    isSelected ? 'bg-orange-50 border-orange-400 border-2' : 'bg-white border-gray-200'
                  }`}
                >
                  {isEditing ? (
                    // Edit mode
                    <div className="space-y-3">
                      {/* Preset type selector */}
                      <div>
                        <label className="text-xs text-gray-500">Tyyppi</label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full h-8 justify-between text-left">
                              <span className="truncate">{editData.label || 'Valitse tyyppi'}</span>
                              <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto">
                            <DropdownMenuLabel>Vaihda tyyppi</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {(ALL_PRESETS[editData.type] || ALL_PRESETS.rectangle).map((preset) => (
                              <DropdownMenuItem
                                key={preset.id}
                                onClick={() => {
                                  // Reset special flags and apply new preset
                                  const newData = {
                                    ...editData,
                                    label: preset.name,
                                    pricePerUnit: preset.price,
                                    unit: preset.unit,
                                    // Reset all special flags
                                    isPystykotelot: false,
                                    isRakennustyo: false,
                                    isKuivatilaRakennus: false,
                                    isPRHRakennus: false,
                                    isKuivatilaAK: false,
                                    isMarkatilaAK: false,
                                    isPRHAK: false,
                                    isKuivatilaPystykotelo: false,
                                    isPRHPystykotelo: false,
                                    isCustom: false,
                                    // Apply new preset flags
                                    ...(preset.isPystykotelot && { isPystykotelot: true }),
                                    ...(preset.isKuivatilaRakennus && { isKuivatilaRakennus: true }),
                                    ...(preset.isPRHRakennus && { isPRHRakennus: true }),
                                    ...(preset.isKuivatilaAK && { isKuivatilaAK: true }),
                                    ...(preset.isMarkatilaAK && { isMarkatilaAK: true }),
                                    ...(preset.isPRHAK && { isPRHAK: true }),
                                    ...(preset.isKuivatilaPystykotelo && { isKuivatilaPystykotelo: true }),
                                    ...(preset.isPRHPystykotelo && { isPRHPystykotelo: true }),
                                    ...(preset.isCustom && { isCustom: true }),
                                  };
                                  setEditData(newData);
                                }}
                              >
                                {preset.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Custom name input - only shown for "Muu" type */}
                      {editData.isCustom && (
                        <div>
                          <label className="text-xs text-gray-500">Nimi / Kuvaus</label>
                          <Input
                            value={editData.label || ''}
                            onChange={(e) => setEditData({ ...editData, label: e.target.value })}
                            placeholder="Esim. Seinämaalaus"
                            className="h-8"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">Määrä</label>
                          <Input
                            type="number"
                            step="0.1"
                            value={editData.quantity || 0}
                            onChange={(e) => setEditData({ ...editData, quantity: parseFloat(e.target.value) || 0 })}
                            className="h-8"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Yksikkö</label>
                          <Input
                            value={editData.unit || 'm²'}
                            onChange={(e) => setEditData({ ...editData, unit: e.target.value })}
                            className="h-8"
                          />
                        </div>
                      </div>

                      {editData.type === 'wall' && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-gray-500">Korkeus (m)</label>
                            <Input
                              type="number"
                              step="0.1"
                              value={editData.wallHeight || 2.6}
                              onChange={(e) => setEditData({ ...editData, wallHeight: parseFloat(e.target.value) || 2.6 })}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Aukot (m²)</label>
                            <Input
                              type="number"
                              step="0.1"
                              value={editData.openings || 0}
                              onChange={(e) => setEditData({ ...editData, openings: parseFloat(e.target.value) || 0 })}
                              className="h-8"
                            />
                          </div>
                          <div className="flex items-end">
                            <label className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={editData.bothSides || false}
                                onChange={(e) => setEditData({ ...editData, bothSides: e.target.checked })}
                              />
                              Molemmat puolet
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Pystykotelot height field */}
                      {editData.isPystykotelot && (
                        <div>
                          <label className="text-xs text-gray-500">Korkeus (m)</label>
                          <Input
                            type="number"
                            step="0.1"
                            value={editData.wallHeight || 2.6}
                            onChange={(e) => setEditData({ ...editData, wallHeight: parseFloat(e.target.value) || 2.6 })}
                            className="h-8"
                          />
                          {editData.wallHeight && editData.quantity && (
                            <p className="text-xs text-gray-400 mt-1">
                              = {formatNumber(editData.quantity * editData.wallHeight)} m²
                            </p>
                          )}
                        </div>
                      )}

                      {/* Unified Construction Options Panel - for all "rakennus" types */}
                      {editData.constructionType && (
                        <ConstructionOptionsEditor
                          editData={editData}
                          setEditData={setEditData}
                          formatNumber={formatNumber}
                        />
                      )}

                      <div>
                        <label className="text-xs text-gray-500">Hinta (€ / {editData.unit || 'yks'})</label>
                        <Input
                          type="number"
                          step="0.5"
                          value={editData.pricePerUnit || 0}
                          onChange={(e) => setEditData({ ...editData, pricePerUnit: parseFloat(e.target.value) || 0 })}
                          className="h-8"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={saveEdit} className="flex-1 bg-green-600 hover:bg-green-700">
                          <Check className="h-4 w-4 mr-1" /> Tallenna
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit} className="flex-1">
                          <X className="h-4 w-4 mr-1" /> Peruuta
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode - Professional responsive layout
                    // Row: flex container with space-between, gap for spacing
                    // Left: flex-1 min-w-0 (shrinks, allows ellipsis)
                    // Right: flex-none whitespace-nowrap (fixed, never hidden)
                    <div 
                      className="flex items-center justify-between gap-2"
                      style={{ minHeight: '44px' }}
                    >
                      {/* LEFT: Content area - shrinks to fit, allows ellipsis */}
                      <div 
                        className="flex-1 min-w-0 overflow-hidden"
                        title={measurement.label || `Mittaus ${measurement.id.slice(-4)}`}
                      >
                        {/* Title - 2 line clamp with ellipsis */}
                        <div 
                          className="font-medium text-sm leading-tight"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            wordBreak: 'break-word'
                          }}
                        >
                          {measurement.label || `Mittaus ${measurement.id.slice(-4)}`}
                        </div>
                        {/* Details row - single line ellipsis */}
                        <div 
                          className="text-xs text-gray-500 truncate mt-0.5"
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {formatNumber(calc.effectiveQuantity)} {measurement.unit}
                          {(measurement.isPystykotelot || measurement.isKuivatilaPystykotelo || measurement.isPRHPystykotelo) && measurement.wallHeight && calc.totalJm && (
                            <span className="ml-1 text-gray-400">
                              × {measurement.wallHeight}m = {formatNumber(calc.totalJm)} jm
                            </span>
                          )}
                          {measurement.hasRankaKipsi && (
                            <span className={`ml-1 ${measurement.isPRHRakennus || measurement.isPRHAK || measurement.isPRHPystykotelo ? 'text-purple-500' : measurement.isMarkatilaAK ? 'text-cyan-500' : 'text-blue-500'}`}>
                              ({measurement.rankaType || 'metall'}, {measurement.kipsiType || '1-kert.'})
                              {measurement.isMarkatilaAK && measurement.lagiPaneeli && ' + paneeli'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* RIGHT: Actions area - NEVER hidden, fixed width */}
                      <div 
                        className="flex items-center gap-1"
                        style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}
                      >
                        {measurement.type === 'wall' && onAddJalkalista && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onAddJalkalista(measurement)}
                            className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 flex-shrink-0"
                            title="Lisää jalkalista maalaus"
                            data-testid={`jalkalista-btn-${measurement.id}`}
                          >
                            <Footprints className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onCopy && onCopy(measurement)}
                          className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 flex-shrink-0"
                          title="Kopioi"
                          data-testid={`copy-btn-${measurement.id}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(measurement)}
                          className="h-7 w-7 p-0 text-gray-600 hover:text-gray-800 hover:bg-gray-100 flex-shrink-0"
                          title="Muokkaa"
                          data-testid={`edit-btn-${measurement.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(measurement.id)}
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                          title="Poista"
                          data-testid={`delete-btn-${measurement.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Grouped Summary - Editable */}
      {measurements.length > 0 && groupedArray.length > 0 && (
        <div className="border-t border-gray-200 pt-3 mt-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Yhteenveto tyypeittäin</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {groupedArray.map((group, idx) => {
              const isGroupEditing = editingGroup === group.label;
              
              return isGroupEditing ? (
                <div key={idx} className="flex items-center gap-1 text-xs bg-blue-50 rounded px-2 py-1.5" data-testid={`summary-row-${idx}`}>
                  <Input
                    value={groupEditData.label || ''}
                    onChange={(e) => setGroupEditData(prev => ({ ...prev, label: e.target.value }))}
                    className="h-6 text-xs flex-1"
                    data-testid={`group-edit-label-${idx}`}
                  />
                  <span className="text-gray-400 mx-1">{formatNumber(group.totalQuantity)} {group.unit}</span>
                  <Input
                    type="number"
                    step="0.5"
                    value={groupEditData.pricePerUnit || ''}
                    onChange={(e) => setGroupEditData(prev => ({ ...prev, pricePerUnit: parseFloat(e.target.value) || 0 }))}
                    className="h-6 text-xs w-16"
                    data-testid={`group-edit-price-${idx}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveGroupEdit();
                      if (e.key === 'Escape') cancelGroupEdit();
                    }}
                  />
                  <span className="text-gray-400">€</span>
                  <Button size="sm" variant="ghost" onClick={saveGroupEdit} className="h-5 w-5 p-0 text-green-600" data-testid={`group-save-${idx}`}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelGroupEdit} className="h-5 w-5 p-0 text-red-500">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div key={idx} className="flex justify-between text-xs bg-gray-50 rounded px-2 py-1 group cursor-pointer hover:bg-gray-100" 
                     data-testid={`summary-row-${idx}`}
                     onClick={() => startGroupEdit(group.label, group)}>
                  <span className="truncate flex-1 mr-2">
                    {group.label} 
                    {group.count > 1 && <span className="text-gray-400 ml-1">({group.count})</span>}
                  </span>
                  <span className="text-gray-600 mr-2">{formatNumber(group.totalQuantity)} {group.unit}</span>
                  <span className="font-medium mr-1">{formatNumber(group.totalCost)} €</span>
                  <Edit2 className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Totals */}
      {measurements.length > 0 && (
        <div className="border-t border-gray-200 pt-4 mt-2 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Yhteenveto</h3>
          <div className="flex justify-between text-sm">
            <span>Yhteensä (alv 0%)</span>
            <span className="font-semibold">{formatNumber(totals.totalCost)} €</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>ALV {vatPercentage}%</span>
            <span>{formatNumber(totals.totalCost * vatPercentage / 100)} €</span>
          </div>
          <div className="flex justify-between text-base font-bold border-t pt-2">
            <span>Yhteensä (sis. ALV)</span>
            <span>{formatNumber(totalWithVat)} €</span>
          </div>
        </div>
      )}
    </div>
  );
};
