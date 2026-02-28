import React, { useState } from 'react';
import { Trash2, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatNumber } from '@/utils/pdfHelpers';

const categories = ['Tasoitus', 'Maalaus', 'Rappaus', 'Muut'];
const subcategories = [
  'Seinät', 'Katot', 'Julkisivu', 'Metalli', 
  'Kaiteet', 'Ovet', 'Ikkunat', 'Muu'
];

export const TakeoffPanel = ({ measurements, onUpdate, onDelete, settings }) => {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

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

  const calculateRow = (m) => {
    const waste = (m.waste || 0) / 100;
    const layers = m.layers || 1;
    const productivity = m.productivity || 1;
    const materialCost = m.materialCostPerUnit || 0;
    const hourlyRate = settings?.hourlyRate || 45;

    let effectiveQuantity = m.quantity || 0;

    if (m.type === 'wall' && m.wallHeight) {
      const bruttoM2 = effectiveQuantity * m.wallHeight * (m.bothSides ? 2 : 1);
      const openings = m.openings || 0;
      effectiveQuantity = bruttoM2 - openings;
    }

    const quantityWithWaste = effectiveQuantity * (1 + waste) * layers;
    const laborHours = quantityWithWaste / productivity;
    const laborCost = laborHours * hourlyRate;
    const totalMaterialCost = quantityWithWaste * materialCost;
    const totalCost = laborCost + totalMaterialCost;

    return {
      effectiveQuantity,
      quantityWithWaste,
      laborHours,
      laborCost,
      totalMaterialCost,
      totalCost
    };
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Määrälaskenta
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {measurements.length} mittausta
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {measurements.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              Aloita mittaamalla PDF:stä
            </div>
          ) : (
            measurements.map((measurement) => {
              const isEditing = editingId === measurement.id;
              const data = isEditing ? editData : measurement;
              const calculated = calculateRow(data);

              return (
                <div
                  key={measurement.id}
                  data-testid={`measurement-row-${measurement.id}`}
                  className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                >
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {isEditing ? (
                      <>
                        <div>
                          <label className="text-xs text-gray-500">Kategoria</label>
                          <Select
                            value={editData.category}
                            onValueChange={(value) => setEditData({ ...editData, category: value })}
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
                            value={editData.subcategory}
                            onValueChange={(value) => setEditData({ ...editData, subcategory: value })}
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

                        {data.type === 'wall' && (
                          <>
                            <div>
                              <label className="text-xs text-gray-500">Korkeus (m)</label>
                              <Input
                                type="number"
                                step="0.1"
                                value={editData.wallHeight || ''}
                                onChange={(e) => setEditData({ ...editData, wallHeight: parseFloat(e.target.value) || 0 })}
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
                          </>
                        )}

                        <div>
                          <label className="text-xs text-gray-500">Hukka %</label>
                          <Input
                            type="number"
                            value={editData.waste || 0}
                            onChange={(e) => setEditData({ ...editData, waste: parseInt(e.target.value) || 0 })}
                            className="h-8"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-gray-500">Kerrokset</label>
                          <Input
                            type="number"
                            value={editData.layers || 1}
                            onChange={(e) => setEditData({ ...editData, layers: parseInt(e.target.value) || 1 })}
                            className="h-8"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-gray-500">Tuottavuus (m²/h)</label>
                          <Input
                            type="number"
                            step="0.1"
                            value={editData.productivity || 1}
                            onChange={(e) => setEditData({ ...editData, productivity: parseFloat(e.target.value) || 1 })}
                            className="h-8"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-gray-500">Materiaali (€/yks)</label>
                          <Input
                            type="number"
                            step="0.1"
                            value={editData.materialCostPerUnit || 0}
                            onChange={(e) => setEditData({ ...editData, materialCostPerUnit: parseFloat(e.target.value) || 0 })}
                            className="h-8"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-xs text-gray-500">Kategoria</span>
                          <p className="font-medium">{data.category || 'Määrittelemätön'}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Alakategoria</span>
                          <p className="font-medium">{data.subcategory || 'Määrittelemätön'}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Määrä</span>
                          <p className="font-mono font-medium">
                            {formatNumber(data.type === 'wall' && data.wallHeight ? calculated.effectiveQuantity : data.quantity)} {data.unit}
                          </p>
                        </div>
                        {data.type === 'wall' && data.wallHeight && (
                          <>
                            <div>
                              <span className="text-xs text-gray-500">Korkeus</span>
                              <p className="font-mono font-medium">{formatNumber(data.wallHeight)} m</p>
                            </div>
                            <div>
                              <span className="text-xs text-gray-500">Brutto m²</span>
                              <p className="font-mono font-medium">
                                {formatNumber(data.quantity * data.wallHeight * (data.bothSides ? 2 : 1))}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs text-gray-500">Netto m²</span>
                              <p className="font-mono font-medium">{formatNumber(calculated.effectiveQuantity)}</p>
                            </div>
                          </>
                        )}
                        <div>
                          <span className="text-xs text-gray-500">Työtunnit</span>
                          <p className="font-mono font-medium">{formatNumber(calculated.laborHours)} h</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Yhteensä</span>
                          <p className="font-mono font-medium">{formatNumber(calculated.totalCost)} €</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    {isEditing ? (
                      <>
                        <Button
                          data-testid={`save-edit-${measurement.id}`}
                          size="sm"
                          onClick={saveEdit}
                          className="flex-1 bg-[#0052CC] hover:bg-[#0043A8]"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Tallenna
                        </Button>
                        <Button
                          data-testid={`cancel-edit-${measurement.id}`}
                          size="sm"
                          variant="outline"
                          onClick={cancelEdit}
                          className="flex-1"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Peruuta
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          data-testid={`edit-measurement-${measurement.id}`}
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(measurement)}
                          className="flex-1"
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Muokkaa
                        </Button>
                        <Button
                          data-testid={`delete-measurement-${measurement.id}`}
                          size="sm"
                          variant="outline"
                          onClick={() => onDelete(measurement.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};