import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Edit2, Check, X, Copy, Footprints } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

// Jalkalista price constant
const JALKALISTA_PRICE = 5; // €/jm

export const TakeoffPanel = ({ measurements, onUpdate, onDelete, onCopy, onAddJalkalista, settings, selectedMeasurementId, onMeasurementSelect }) => {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
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

  // Simple calculation: quantity * price
  const calculateRow = (m) => {
    let effectiveQuantity = m.quantity || 0;

    // For wall type: convert running meters to m² if height is set
    if (m.type === 'wall' && m.wallHeight) {
      const bruttoM2 = effectiveQuantity * m.wallHeight * (m.bothSides ? 2 : 1);
      const openings = m.openings || 0;
      effectiveQuantity = bruttoM2 - openings;
    }
    
    // For Pystykotelot: show jm but calculate total based on height for display
    // Price is per jm, so we use original quantity for cost
    let costQuantity = m.quantity || 0;
    if (m.isPystykotelot && m.wallHeight) {
      // Display shows total m² but price is per jm
      effectiveQuantity = m.quantity; // Keep original jm for display
    }

    const pricePerUnit = m.pricePerUnit || 0;
    const totalCost = costQuantity * pricePerUnit;

    return {
      effectiveQuantity,
      totalCost,
      // For Pystykotelot, also calculate total m² for info
      totalM2: m.isPystykotelot && m.wallHeight ? m.quantity * m.wallHeight : null
    };
  };

  // Calculate totals
  const totals = measurements.reduce((acc, m) => {
    const calc = calculateRow(m);
    return {
      totalCost: acc.totalCost + calc.totalCost
    };
  }, { totalCost: 0 });

  const vatPercentage = settings?.vatPercentage || 25.5;
  const totalWithVat = totals.totalCost * (1 + vatPercentage / 100);

  const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div ref={containerRef} className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Määrälaskenta</h2>
          <p className="text-sm text-gray-500">{measurements.length} mittausta</p>
        </div>
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
                      <div>
                        <label className="text-xs text-gray-500">Nimi / Kuvaus</label>
                        <Input
                          value={editData.label || ''}
                          onChange={(e) => setEditData({ ...editData, label: e.target.value })}
                          placeholder="Esim. Seinämaalaus"
                          className="h-8"
                        />
                      </div>

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
                    // View mode
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {measurement.label || `Mittaus ${measurement.id.slice(-4)}`}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatNumber(calc.effectiveQuantity)} {measurement.unit}
                          {measurement.isPystykotelot && measurement.wallHeight && (
                            <span className="ml-1 text-gray-400">
                              (h: {measurement.wallHeight}m = {formatNumber(calc.totalM2)} m²)
                            </span>
                          )}
                          {measurement.pricePerUnit > 0 && (
                            <span className="ml-2">× {formatNumber(measurement.pricePerUnit)} €</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="text-right mr-2">
                          <div className="font-semibold text-sm">
                            {formatNumber(calc.totalCost)} €
                          </div>
                        </div>
                        {/* Jalkalista button for wall measurements */}
                        {measurement.type === 'wall' && onAddJalkalista && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onAddJalkalista(measurement)}
                            className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Lisää jalkalista maalaus"
                          >
                            <Footprints className="h-4 w-4 mr-1" />
                            <span className="text-xs">Jalkalista</span>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onCopy && onCopy(measurement)}
                          className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700"
                          title="Kopioi"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(measurement)}
                          className="h-8 w-8 p-0"
                          title="Muokkaa"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(measurement.id)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          title="Poista"
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

      {/* Totals */}
      {measurements.length > 0 && (
        <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
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
