import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { GripVertical, Plus, Trash2, RotateCcw, Save, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const OfferTermsEditor = ({ open, onClose }) => {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [draggedIndex, setDraggedIndex] = useState(null);

  const fetchTerms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/presets/offer-terms`);
      if (res.ok) {
        const data = await res.json();
        setTerms(data.terms || []);
      }
    } catch (err) {
      console.error('Failed to fetch offer terms:', err);
      toast.error('Ehtojen lataus epäonnistui');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchTerms();
    }
  }, [open, fetchTerms]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/presets/offer-terms`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terms })
      });
      if (res.ok) {
        toast.success('Ehdot tallennettu');
        onClose();
      } else {
        toast.error('Tallennus epäonnistui');
      }
    } catch (err) {
      console.error('Failed to save offer terms:', err);
      toast.error('Tallennus epäonnistui');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Palauta oletusasetukset? Kaikki muutokset menetetään.')) {
      return;
    }
    
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/presets/offer-terms/reset`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setTerms(data.terms || []);
        toast.success('Oletusasetukset palautettu');
      } else {
        toast.error('Palautus epäonnistui');
      }
    } catch (err) {
      console.error('Failed to reset offer terms:', err);
      toast.error('Palautus epäonnistui');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTerm = () => {
    setTerms([...terms, '']);
    setEditingIndex(terms.length);
    setEditValue('');
  };

  const handleDeleteTerm = (index) => {
    const newTerms = terms.filter((_, i) => i !== index);
    setTerms(newTerms);
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditValue('');
    }
  };

  const handleEditStart = (index) => {
    setEditingIndex(index);
    setEditValue(terms[index]);
  };

  const handleEditSave = () => {
    if (editingIndex !== null) {
      const newTerms = [...terms];
      newTerms[editingIndex] = editValue;
      setTerms(newTerms);
      setEditingIndex(null);
      setEditValue('');
    }
  };

  const handleEditCancel = () => {
    // If it was a new empty term, remove it
    if (editingIndex !== null && terms[editingIndex] === '') {
      handleDeleteTerm(editingIndex);
    }
    setEditingIndex(null);
    setEditValue('');
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newTerms = [...terms];
    const draggedTerm = newTerms[draggedIndex];
    newTerms.splice(draggedIndex, 1);
    newTerms.splice(index, 0, draggedTerm);
    setTerms(newTerms);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Tarjouksen ehdot
            <span className="text-sm font-normal text-gray-500">
              ({terms.length} ehtoa)
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Ladataan...</div>
          ) : (
            <>
              {terms.map((term, index) => (
                <div
                  key={index}
                  draggable={editingIndex !== index}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex gap-2 p-3 rounded-lg border transition-colors ${
                    draggedIndex === index 
                      ? 'bg-teal-50 border-teal-300' 
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                  data-testid={`offer-term-${index}`}
                >
                  <div 
                    className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 pt-1"
                    title="Vedä järjestääksesi"
                  >
                    <GripVertical size={18} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-400 mb-1">
                      {index + 1}.
                    </div>
                    
                    {editingIndex === index ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder="Kirjoita ehto..."
                          rows={4}
                          className="text-sm"
                          autoFocus
                          data-testid={`offer-term-input-${index}`}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleEditSave}
                            disabled={!editValue.trim()}
                            data-testid={`offer-term-save-${index}`}
                          >
                            <Save size={14} className="mr-1" />
                            Tallenna
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleEditCancel}
                          >
                            <X size={14} className="mr-1" />
                            Peruuta
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => handleEditStart(index)}
                        className="text-sm text-gray-700 cursor-pointer hover:bg-white rounded p-2 -m-2 whitespace-pre-wrap"
                        title="Klikkaa muokataksesi"
                      >
                        {term || <span className="text-gray-400 italic">Tyhjä ehto - klikkaa muokataksesi</span>}
                      </div>
                    )}
                  </div>
                  
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteTerm(index)}
                    className="flex-shrink-0 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    title="Poista ehto"
                    data-testid={`offer-term-delete-${index}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
              
              {terms.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Ei ehtoja. Lisää uusi ehto alla olevalla napilla.
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <div className="flex justify-between w-full">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleAddTerm}
                disabled={saving || editingIndex !== null}
                data-testid="add-offer-term"
              >
                <Plus size={16} className="mr-1" />
                Lisää ehto
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={saving}
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                data-testid="reset-offer-terms"
              >
                <RotateCcw size={16} className="mr-1" />
                Palauta oletukset
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Peruuta
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || editingIndex !== null}
                data-testid="save-offer-terms"
              >
                {saving ? 'Tallennetaan...' : 'Tallenna'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OfferTermsEditor;
