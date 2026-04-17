import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import { DEFAULT_TOOL_PRESETS } from '@/constants/presetDefaults';

// ==================== UNIFIED CONSTRUCTION OPTIONS ====================
const FRAME_OPTIONS = [
  { value: 'puurunko', label: 'Puurunko (kertapuu)' },
  { value: 'metalliranka', label: 'Metalliranka' }
];

const INSULATION_OPTIONS = [
  { value: 'ilman', label: 'Ilman villaa' },
  { value: 'villalla', label: 'Villalla' }
];

const GYPSUM_OPTIONS = [
  { value: '1', label: '1 x kipsi' },
  { value: '2', label: '2 x kipsi' }
];

// ==================== PRESET PRICE MATRIX (base prices) ====================
const CONSTRUCTION_PRICES = {
  kipsiseina: {
    base: 25,
    metalli: 5,  // +5 for metal frame
    villa: 8,    // +8 for insulation
    kipsi2: 12   // +12 for 2x gypsum
  },
  kipsiotsa: {
    base: 20,
    metalli: 3,
    villa: 5,
    kipsi2: 8
  },
  kuivatilaKotelo: {
    base: 35,
    metalli: 0,
    villa: 0,
    kipsi2: 0
  },
  prhKotelo: {
    base: 35,
    metalli: 0,
    villa: 0,
    kipsi2: 0
  },
  kuivatilaAK: {
    base: 35,
    metalli: 0,
    villa: 5,
    kipsi2: 10
  },
  markatilaAK: {
    base: 35,
    metalli: 0,
    villa: 5,
    kipsi2: 10
  },
  prhAK: {
    base: 35,
    metalli: 0,
    villa: 5,
    kipsi2: 10
  },
  kuivatilaPystykotelo: {
    base: 35,
    metalli: 0,
    villa: 0,
    kipsi2: 0
  },
  prhPystykotelo: {
    base: 35,
    metalli: 0,
    villa: 0,
    kipsi2: 0
  }
};

// Calculate price based on options
const calculateConstructionPrice = (type, options) => {
  const prices = CONSTRUCTION_PRICES[type];
  if (!prices) return 35;
  
  let price = prices.base;
  if (options.frameType === 'metalliranka') price += prices.metalli;
  if (options.insulation === 'villalla') price += prices.villa;
  if (options.gypsumLayers === '2') price += prices.kipsi2;
  
  return price;
};

// Generate unified name
const generateConstructionName = (baseType, options) => {
  const parts = [baseType];
  
  if (options.frameType) {
    parts.push(options.frameType === 'metalliranka' ? 'metalliranka' : 'puurunko');
  }
  if (options.insulation) {
    parts.push(options.insulation === 'villalla' ? 'villalla' : 'ilman villaa');
  }
  if (options.gypsumLayers) {
    parts.push(`${options.gypsumLayers}x kipsi`);
  }
  
  return parts.join(', ');
};

// ==================== CONSTRUCTION OPTIONS (exported for TakeoffPanel) ====================
export const FRAME_OPTIONS_EXPORT = FRAME_OPTIONS;
export const INSULATION_OPTIONS_EXPORT = INSULATION_OPTIONS;
export const GYPSUM_OPTIONS_EXPORT = GYPSUM_OPTIONS;
export const CONSTRUCTION_PRICES_EXPORT = CONSTRUCTION_PRICES;
export const calculateConstructionPriceExport = calculateConstructionPrice;

// ==================== MAIN COMPONENT ====================
export const ToolPresetSelector = ({ 
  isOpen, 
  toolType, 
  onSelect, 
  onClose, 
  position,
  customPresets
}) => {
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const containerRef = useRef(null);

  // Use custom presets if provided, otherwise use defaults
  const presetConfig = customPresets?.[toolType] || DEFAULT_TOOL_PRESETS[toolType];
  // Filter out empty groups and add "Muu" item to last group if not present
  let groups = presetConfig?.groups || [];
  
  // Ensure "Muu" (custom) option exists
  const hasCustomOption = groups.some(g => g.items?.some(i => i.isCustom));
  if (!hasCustomOption && groups.length > 0) {
    // Add Muu group
    const defaultUnit = toolType === 'count' ? 'kpl' : (toolType === 'line' || toolType === 'wall' ? 'jm' : 'm²');
    groups = [
      ...groups,
      {
        name: 'Muu',
        items: [{ id: `${toolType}-other`, name: 'Muu', price: 0, unit: defaultUnit, isCustom: true }]
      }
    ];
  }

  useEffect(() => {
    if (!isOpen) {
      setShowCustomInput(false);
      setCustomName('');
      setCustomPrice('');
      setSelectedPreset(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handlePresetClick = (preset) => {
    if (preset.isCustom) {
      setSelectedPreset(preset);
      setShowCustomInput(true);
    } else if (preset.hasOptions) {
      // For construction presets: use default options and let user edit in TakeoffPanel
      const defaultOptions = {
        frameType: 'puurunko',
        insulation: 'ilman',
        gypsumLayers: '1'
      };
      const basePrice = calculateConstructionPrice(preset.constructionType, defaultOptions);
      const baseTypeName = preset.name.replace(' rakennus', '');
      const generatedName = generateConstructionName(baseTypeName, defaultOptions);
      
      onSelect({
        label: generatedName,
        pricePerUnit: basePrice,
        unit: preset.unit,
        constructionType: preset.constructionType,
        constructionOptions: defaultOptions,
        isKipsiRakennus: preset.isKipsiRakennus || false
      });
    } else {
      onSelect({
        label: preset.name,
        pricePerUnit: preset.price,
        unit: preset.unit,
        isPystykotelot: preset.isPystykotelot || false,
        constructionType: preset.constructionType || null,
        constructionOptions: null
      });
    }
  };

  const handleCustomSubmit = async () => {
    if (selectedPreset) {
      const label = customName || 'Nimetön';
      const unit = selectedPreset.unit;
      
      // Add custom item to TES prices (async, don't block the UI)
      try {
        const API_URL = process.env.REACT_APP_BACKEND_URL || '';
        fetch(`${API_URL}/api/presets/tes-prices/add-custom`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: label, unit })
        }).then(res => {
          if (res.ok) {
            console.log(`Custom TES price added: ${label}`);
          }
        }).catch(err => {
          console.warn('Failed to add custom TES price:', err);
        });
      } catch (e) {
        // Silently fail - this is a nice-to-have feature
        console.warn('Failed to add custom TES price:', e);
      }
      
      onSelect({
        label,
        pricePerUnit: parseFloat(customPrice) || 0,
        unit,
        isPystykotelot: selectedPreset.isPystykotelot || false,
        constructionType: null,
        constructionOptions: null
      });
    }
  };

  if (!isOpen || !toolType) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[300px] max-w-[340px]"
      style={{ 
        left: position?.x || 100, 
        top: position?.y || 100 
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <span className="font-medium text-sm">Valitse tyyppi</span>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={onClose}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="p-2 max-h-[400px] overflow-y-auto">
        {showCustomInput ? (
          <div className="space-y-2">
            <Input
              autoFocus
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Anna nimi..."
              className="h-9"
              data-testid="custom-preset-name"
            />
            <Input
              type="number"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              placeholder={`Hinta (€/${selectedPreset?.unit || 'yks'})`}
              className="h-9"
              data-testid="custom-preset-price"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCustomSubmit();
                if (e.key === 'Escape') onClose();
              }}
            />
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={handleCustomSubmit}
                className="flex-1 bg-[#4A9BAD]"
              >
                OK
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomName('');
                  setCustomPrice('');
                }}
              >
                Takaisin
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group, groupIdx) => (
              <div key={groupIdx}>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide px-2 mb-1">
                  {group.name}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((preset) => (
                    <button
                      key={preset.id}
                      data-testid={`preset-${preset.id}`}
                      onClick={() => handlePresetClick(preset)}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors flex items-center justify-between group"
                    >
                      <span className="text-sm">{preset.name}</span>
                      {!preset.isCustom && preset.price > 0 && (
                        <span className="text-xs text-gray-400">{preset.price} €/{preset.unit}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
