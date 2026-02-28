import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatNumber, formatCurrency } from '@/utils/pdfHelpers';
import { Separator } from '@/components/ui/separator';

export const CalculatorPanel = ({ measurements, settings, onSettingsChange }) => {
  const [summary, setSummary] = useState({
    totalWalls: 0,
    totalCeilings: 0,
    totalFloors: 0,
    totalFacade: 0,
    totalJm: 0,
    totalKpl: 0,
    totalLaborHours: 0,
    totalLaborCost: 0,
    totalMaterialCost: 0,
    totalPrice: 0,
    totalPriceWithVat: 0
  });

  useEffect(() => {
    const calculateSummary = () => {
      let totalWalls = 0;
      let totalCeilings = 0;
      let totalFloors = 0;
      let totalFacade = 0;
      let totalJm = 0;
      let totalKpl = 0;
      let totalLaborHours = 0;
      let totalLaborCost = 0;
      let totalMaterialCost = 0;
      const defaultProductivity = 8; // Fixed productivity

      measurements.forEach(m => {
        const layers = m.layers || 1;
        const materialCost = m.materialCostPerUnit || 0;
        const hourlyRate = settings?.hourlyRate || 45;

        let effectiveQuantity = m.quantity || 0;

        if (m.type === 'wall' && m.wallHeight) {
          const bruttoM2 = effectiveQuantity * m.wallHeight * (m.bothSides ? 2 : 1);
          const openings = m.openings || 0;
          effectiveQuantity = bruttoM2 - openings;
        }

        if (m.subcategory === 'Seinät' || m.type === 'wall') {
          totalWalls += effectiveQuantity;
        } else if (m.subcategory === 'Katot') {
          totalCeilings += effectiveQuantity;
        } else if (m.subcategory === 'Lattiat') {
          totalFloors += effectiveQuantity;
        } else if (m.subcategory === 'Julkisivu') {
          totalFacade += effectiveQuantity;
        }

        if (m.unit === 'jm') {
          totalJm += effectiveQuantity;
        } else if (m.unit === 'kpl') {
          totalKpl += effectiveQuantity;
        }

        const totalQuantity = effectiveQuantity * layers;
        const laborHours = totalQuantity / defaultProductivity;
        const laborCost = laborHours * hourlyRate;
        const matCost = totalQuantity * materialCost;

        totalLaborHours += laborHours;
        totalLaborCost += laborCost;
        totalMaterialCost += matCost;
      });

      const totalPrice = totalLaborCost + totalMaterialCost;
      const vatPercentage = settings?.vatPercentage || 25.5;
      const totalPriceWithVat = totalPrice * (1 + vatPercentage / 100);

      setSummary({
        totalWalls,
        totalCeilings,
        totalFloors,
        totalFacade,
        totalJm,
        totalKpl,
        totalLaborHours,
        totalLaborCost,
        totalMaterialCost,
        totalPrice,
        totalPriceWithVat
      });
    };

    calculateSummary();
  }, [measurements, settings]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Kustannuslaskenta
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Globaaliasetukset</h3>
            
            <div>
              <Label htmlFor="hourlyRate" className="text-xs text-gray-500">Työtuntihinta (€/h)</Label>
              <Input
                id="hourlyRate"
                data-testid="hourly-rate-input"
                type="number"
                step="1"
                value={settings?.hourlyRate || 45}
                onChange={(e) => onSettingsChange({ ...settings, hourlyRate: parseFloat(e.target.value) || 45 })}
                className="h-9"
              />
            </div>

            <div>
              <Label htmlFor="vat" className="text-xs text-gray-500">ALV %</Label>
              <Input
                id="vat"
                data-testid="vat-input"
                type="number"
                step="0.1"
                value={settings?.vatPercentage || 25.5}
                onChange={(e) => onSettingsChange({ ...settings, vatPercentage: parseFloat(e.target.value) || 25.5 })}
                className="h-9"
              />
            </div>

            <div>
              <Label htmlFor="doorArea" className="text-xs text-gray-500">Ovien oletusala (m²)</Label>
              <Input
                id="doorArea"
                data-testid="door-area-input"
                type="number"
                step="0.1"
                value={settings?.defaultDoorArea || 2.1}
                onChange={(e) => onSettingsChange({ ...settings, defaultDoorArea: parseFloat(e.target.value) || 2.1 })}
                className="h-9"
              />
            </div>

            <div>
              <Label htmlFor="windowArea" className="text-xs text-gray-500">Ikkunoiden oletusala (m²)</Label>
              <Input
                id="windowArea"
                data-testid="window-area-input"
                type="number"
                step="0.1"
                value={settings?.defaultWindowArea || 1.5}
                onChange={(e) => onSettingsChange({ ...settings, defaultWindowArea: parseFloat(e.target.value) || 1.5 })}
                className="h-9"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Yhteenveto</h3>
            
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Seinät</span>
                <span className="font-mono font-medium">{formatNumber(summary.totalWalls)} m²</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Katot</span>
                <span className="font-mono font-medium">{formatNumber(summary.totalCeilings)} m²</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Lattiat</span>
                <span className="font-mono font-medium">{formatNumber(summary.totalFloors)} m²</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Julkisivu</span>
                <span className="font-mono font-medium">{formatNumber(summary.totalFacade)} m²</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Juoksumetrit</span>
                <span className="font-mono font-medium">{formatNumber(summary.totalJm)} jm</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Kappaleet</span>
                <span className="font-mono font-medium">{formatNumber(summary.totalKpl)} kpl</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Työtunnit</span>
                <span className="font-mono font-medium">{formatNumber(summary.totalLaborHours)} h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Työkustannukset</span>
                <span className="font-mono font-medium">{formatCurrency(summary.totalLaborCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Materiaali</span>
                <span className="font-mono font-medium">{formatCurrency(summary.totalMaterialCost)}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">Hind kokku (ALV 0%)</span>
                <span className="font-mono font-bold text-lg text-[#0052CC]">
                  {formatCurrency(summary.totalPrice)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">Hind kokku (sis. ALV)</span>
                <span className="font-mono font-bold text-lg text-[#10B981]">
                  {formatCurrency(summary.totalPriceWithVat)}
                </span>
              </div>
            </div>
          </div>
        </div>
        </div>
      </ScrollArea>
    </div>
  );
};