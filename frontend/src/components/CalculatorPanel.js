import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

export const CalculatorPanel = ({ measurements, settings, onSettingsChange, onGlobalWallHeightChange }) => {
  const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const summary = useMemo(() => {
    let totalM2 = 0;
    let totalJm = 0;
    let totalKpl = 0;
    let totalCost = 0;

    measurements.forEach(m => {
      let effectiveQuantity = m.quantity || 0;

      // For wall type: convert running meters to m² if height is set
      if (m.type === 'wall' && m.wallHeight) {
        const bruttoM2 = effectiveQuantity * m.wallHeight * (m.bothSides ? 2 : 1);
        const openings = m.openings || 0;
        effectiveQuantity = bruttoM2 - openings;
      }

      // Track by unit type
      if (m.unit === 'm²') {
        totalM2 += effectiveQuantity;
      } else if (m.unit === 'jm') {
        totalJm += effectiveQuantity;
      } else if (m.unit === 'kpl') {
        totalKpl += effectiveQuantity;
      }

      // Calculate cost
      const pricePerUnit = m.pricePerUnit || 0;
      totalCost += effectiveQuantity * pricePerUnit;
    });

    const vatPercentage = settings?.vatPercentage || 25.5;
    const vatAmount = totalCost * vatPercentage / 100;
    const totalWithVat = totalCost + vatAmount;

    return {
      totalM2,
      totalJm,
      totalKpl,
      totalCost,
      vatPercentage,
      vatAmount,
      totalWithVat
    };
  }, [measurements, settings]);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Laskenta</h2>
        <p className="text-sm text-gray-500">Yhteenveto</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6">
          {/* Quantities summary */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-gray-700">Määrät</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{formatNumber(summary.totalM2)}</div>
                <div className="text-xs text-blue-600">m²</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{formatNumber(summary.totalJm)}</div>
                <div className="text-xs text-green-600">jm</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-700">{formatNumber(summary.totalKpl)}</div>
                <div className="text-xs text-purple-600">kpl</div>
              </div>
            </div>
          </div>

          {/* Cost summary */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-gray-700">Kustannukset</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Yhteensä (alv 0%)</span>
                <span className="font-semibold">{formatNumber(summary.totalCost)} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>ALV {summary.vatPercentage}%</span>
                <span>{formatNumber(summary.vatAmount)} €</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-bold">Yhteensä (sis. ALV)</span>
                <span className="font-bold text-lg">{formatNumber(summary.totalWithVat)} €</span>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-gray-700">Asetukset</h3>
            <div>
              <Label className="text-xs">ALV %</Label>
              <Input
                type="number"
                step="0.5"
                value={settings?.vatPercentage || 25.5}
                onChange={(e) => onSettingsChange({ ...settings, vatPercentage: parseFloat(e.target.value) || 25.5 })}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Oletuskorkeus seinille (m)</Label>
              <Input
                type="number"
                step="0.1"
                value={settings?.defaultWallHeight || 2.6}
                onChange={(e) => onSettingsChange({ ...settings, defaultWallHeight: parseFloat(e.target.value) || 2.6 })}
                className="h-8"
              />
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
