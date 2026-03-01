import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

export const CalculatorPanel = ({ measurements, settings, onSettingsChange, onGlobalWallHeightChange }) => {
  const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Group measurements by operation (label + unit + pricePerUnit)
  const operationGroups = useMemo(() => {
    const groups = {};

    measurements.forEach(m => {
      // Calculate effective quantity
      let effectiveQuantity = m.quantity || 0;
      
      // For wall type: convert running meters to m² if height is set
      if (m.type === 'wall' && m.wallHeight) {
        const bruttoM2 = effectiveQuantity * m.wallHeight * (m.bothSides ? 2 : 1);
        const openings = m.openings || 0;
        effectiveQuantity = bruttoM2 - openings;
      }
      
      // For Pystykotelot: kpl × height = jm
      let costQuantity = effectiveQuantity;
      if ((m.isPystykotelot || m.isKuivatilaPystykotelo || m.isPRHPystykotelo) && m.wallHeight) {
        costQuantity = m.quantity * m.wallHeight;
      }

      // Create unique key: operationName + unit + pricePerUnit
      const operationName = m.label || 'Nimetön';
      const unit = m.unit || 'kpl';
      const pricePerUnit = m.pricePerUnit || 0;
      
      // Key includes price to separate same operations with different prices
      const groupKey = `${operationName}__${unit}__${pricePerUnit}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          operationName,
          unit,
          pricePerUnit,
          totalQuantity: 0,
          totalCost: 0,
          measurementCount: 0,
          measurements: []
        };
      }

      groups[groupKey].totalQuantity += effectiveQuantity;
      groups[groupKey].totalCost += costQuantity * pricePerUnit;
      groups[groupKey].measurementCount += 1;
      groups[groupKey].measurements.push(m);
    });

    // Convert to array and sort by cost (highest first)
    return Object.values(groups).sort((a, b) => b.totalCost - a.totalCost);
  }, [measurements]);

  // Calculate grand totals
  const totals = useMemo(() => {
    let totalCost = 0;
    
    operationGroups.forEach(group => {
      totalCost += group.totalCost;
    });

    const vatPercentage = settings?.vatPercentage || 25.5;
    const vatAmount = totalCost * vatPercentage / 100;
    const totalWithVat = totalCost + vatAmount;

    return {
      totalCost,
      vatPercentage,
      vatAmount,
      totalWithVat
    };
  }, [operationGroups, settings]);

  // Get unit badge color
  const getUnitColor = (unit) => {
    switch (unit) {
      case 'm²': return 'bg-blue-100 text-blue-700';
      case 'jm': return 'bg-green-100 text-green-700';
      case 'kpl': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="h-full flex flex-col p-4 pb-16">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Laskenta</h2>
        <p className="text-sm text-gray-500">{operationGroups.length} operaatiota</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6">
          {/* Operations list */}
          {operationGroups.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-gray-700">Operaatiot</h3>
              <div className="space-y-2">
                {operationGroups.map((group, idx) => (
                  <div 
                    key={idx} 
                    className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
                  >
                    {/* Row 1: Operation name and total */}
                    <div className="flex items-start justify-between gap-2">
                      {/* Left: Operation name */}
                      <div 
                        className="flex-1 min-w-0 font-medium text-sm leading-tight"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                        title={group.operationName}
                      >
                        {group.operationName}
                      </div>
                      {/* Right: Row total */}
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold text-sm">
                          {formatNumber(group.totalCost)} €
                        </div>
                      </div>
                    </div>
                    
                    {/* Row 2: Quantity, unit, price info */}
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <div className="flex items-center gap-2">
                        {/* Quantity with unit badge */}
                        <span className={`px-2 py-0.5 rounded-full font-medium ${getUnitColor(group.unit)}`}>
                          {formatNumber(group.totalQuantity)} {group.unit}
                        </span>
                        {/* Unit price */}
                        {group.pricePerUnit > 0 && (
                          <span className="text-gray-400">
                            × {formatNumber(group.pricePerUnit)} €/{group.unit}
                          </span>
                        )}
                      </div>
                      {/* Measurement count */}
                      {group.measurementCount > 1 && (
                        <span className="text-gray-400">
                          {group.measurementCount} mittausta
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {operationGroups.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              Ei mittauksia
            </div>
          )}

          {/* Grand Total */}
          {operationGroups.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-gray-700">Yhteenveto</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Yhteensä (alv 0%)</span>
                  <span className="font-semibold">{formatNumber(totals.totalCost)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>ALV {totals.vatPercentage}%</span>
                  <span>{formatNumber(totals.vatAmount)} €</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-bold">Yhteensä (sis. ALV)</span>
                  <span className="font-bold text-lg">{formatNumber(totals.totalWithVat)} €</span>
                </div>
              </div>
            </div>
          )}

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
                onChange={(e) => {
                  const newHeight = parseFloat(e.target.value) || 2.6;
                  onSettingsChange({ ...settings, defaultWallHeight: newHeight });
                  // Also update all existing measurements
                  if (onGlobalWallHeightChange) {
                    onGlobalWallHeightChange(newHeight);
                  }
                }}
                className="h-8"
              />
              <p className="text-xs text-gray-400 mt-1">Muuttaa kaikkien seinien korkeuden</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
