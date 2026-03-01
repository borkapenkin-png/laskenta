import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

// Default presets for each tool type
const DEFAULT_PRESETS = {
  line: [
    { id: 'line-1', name: 'Kuivatila kotelot rakennus', price: 0, unit: 'jm', isKuivatilaRakennus: true },
    { id: 'line-2', name: 'Kuivatila kotelot tasoitus ja maalaus', price: 45, unit: 'jm' },
    { id: 'line-3', name: 'PRH Kotelo rakennus', price: 0, unit: 'jm', isPRHRakennus: true },
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
    { id: 'rect-8', name: 'Kuivatila AK Rakennus', price: 0, unit: 'm²', isKuivatilaAK: true },
    { id: 'rect-9', name: 'Märkätila AK Rakennus', price: 0, unit: 'm²', isMarkatilaAK: true },
    { id: 'rect-10', name: 'PRH AK Rakennus', price: 0, unit: 'm²', isPRHAK: true },
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
    { id: 'poly-8', name: 'Kuivatila AK Rakennus', price: 0, unit: 'm²', isKuivatilaAK: true },
    { id: 'poly-9', name: 'Märkätila AK Rakennus', price: 0, unit: 'm²', isMarkatilaAK: true },
    { id: 'poly-10', name: 'PRH AK Rakennus', price: 0, unit: 'm²', isPRHAK: true },
    { id: 'poly-other', name: 'Muu', price: 0, unit: 'm²', isCustom: true }
  ],
  count: [
    { id: 'count-1', name: 'Ovi', price: 25, unit: 'kpl' },
    { id: 'count-2', name: 'Ikkuna', price: 20, unit: 'kpl' },
    { id: 'count-3', name: 'Kuivatila pystykotelo rakennus', price: 0, unit: 'jm', isKuivatilaPystykotelo: true },
    { id: 'count-4', name: 'PRH pystykotelo rakennus', price: 0, unit: 'jm', isPRHPystykotelo: true },
    { id: 'count-5', name: 'Pystykotelot tasoitus ja maalaus', price: 45, unit: 'jm', isPystykotelot: true },
    { id: 'count-other', name: 'Muu', price: 0, unit: 'kpl', isCustom: true }
  ]
};

export const ToolPresetSelector = ({ 
  isOpen, 
  toolType, 
  onSelect, 
  onClose, 
  position 
}) => {
  const [customName, setCustomName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const containerRef = useRef(null);

  const presets = DEFAULT_PRESETS[toolType] || [];

  useEffect(() => {
    if (!isOpen) {
      setShowCustomInput(false);
      setCustomName('');
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
    } else {
      onSelect({
        label: preset.name,
        pricePerUnit: preset.price,
        unit: preset.unit,
        isPystykotelot: preset.isPystykotelot || false,
        isRakennustyo: preset.isRakennustyo || false,
        isKuivatilaRakennus: preset.isKuivatilaRakennus || false
      });
    }
  };

  const handleCustomSubmit = () => {
    if (selectedPreset) {
      onSelect({
        label: customName || 'Nimetön',
        pricePerUnit: selectedPreset.price,
        unit: selectedPreset.unit,
        isPystykotelot: selectedPreset.isPystykotelot || false,
        isRakennustyo: selectedPreset.isRakennustyo || false,
        isKuivatilaRakennus: selectedPreset.isKuivatilaRakennus || false
      });
    }
  };

  if (!isOpen || !toolType) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[280px]"
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
      
      <div className="p-2">
        {showCustomInput ? (
          <div className="space-y-2">
            <Input
              autoFocus
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Anna nimi..."
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCustomSubmit();
                if (e.key === 'Escape') onClose();
              }}
            />
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={handleCustomSubmit}
                className="flex-1 bg-[#0052CC]"
              >
                OK
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomName('');
                }}
              >
                Takaisin
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors flex justify-between items-center"
              >
                <span className="text-sm">{preset.name}</span>
                <span className="text-sm text-gray-500 font-mono">
                  {preset.price > 0 ? `${preset.price} €/${preset.unit}` : `0 €`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
