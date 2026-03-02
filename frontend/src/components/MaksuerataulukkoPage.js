import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText, 
  Copy, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Check,
  ArrowLeft,
  Calculator
} from 'lucide-react';
import { toast } from 'sonner';
import { exportMaksuerataulukkoPDF } from '@/utils/maksuerataulukko-export';

// ==================== PRESETS ====================
const PRESETS = {
  'yse-6': {
    name: 'YSE-6 (balanced)',
    rows: [
      { selite: 'Työmaan käynnistys', percent: 10 },
      { selite: 'Valmistelut', percent: 15 },
      { selite: 'Pohjatyöt', percent: 20 },
      { selite: 'Pintatyöt', percent: 20 },
      { selite: 'Viimeistely', percent: 15 },
      { selite: 'Luovutus / virheet korjattu', percent: 10 },
    ]
  },
  'yse-8': {
    name: 'YSE-8 (detailed)',
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
  },
  '10-80-10': {
    name: '10–80–10 (valmisaste)',
    isValmisaste: true,
    // Dynamic based on milestone count
  },
  'custom': {
    name: 'Oma (muokattava)',
    rows: []
  }
};

// Generate 10-80-10 rows based on milestone count
const generate108010Rows = (milestoneCount) => {
  const rows = [{ selite: 'Kun työt on aloitettu', percent: 10 }];
  
  const middlePercent = 80 / milestoneCount;
  for (let i = 1; i <= milestoneCount; i++) {
    const percentage = Math.round((100 / milestoneCount) * i);
    rows.push({ 
      selite: `${percentage}% valmis`, 
      percent: middlePercent 
    });
  }
  
  rows.push({ selite: 'Kun virheet ja puutteet korjattu', percent: 10 });
  return rows;
};

// ==================== FORMAT HELPERS ====================
const formatCurrency = (value) => {
  return new Intl.NumberFormat('fi-FI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
};

const formatPercent = (value) => {
  return new Intl.NumberFormat('fi-FI', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value || 0);
};

// ==================== MAIN COMPONENT ====================
export const MaksuerataulukkoPage = ({ onBack }) => {
  // Load from localStorage
  const [urakkasumma, setUrakkasumma] = useState(() => {
    return localStorage.getItem('maksuerataulukko_urakkasumma') || '';
  });
  const [vatMode, setVatMode] = useState(() => {
    return localStorage.getItem('maksuerataulukko_vatMode') || 'alv0';
  });
  const [selectedPreset, setSelectedPreset] = useState(() => {
    return localStorage.getItem('maksuerataulukko_preset') || 'yse-6';
  });
  const [milestoneCount, setMilestoneCount] = useState(() => {
    return parseInt(localStorage.getItem('maksuerataulukko_milestones')) || 6;
  });
  
  // Calculated rows
  const [presetRows, setPresetRows] = useState([]);
  const [customRows, setCustomRows] = useState([]);
  const [activeTab, setActiveTab] = useState('preset');
  const [showTable, setShowTable] = useState(false);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('maksuerataulukko_urakkasumma', urakkasumma);
    localStorage.setItem('maksuerataulukko_vatMode', vatMode);
    localStorage.setItem('maksuerataulukko_preset', selectedPreset);
    localStorage.setItem('maksuerataulukko_milestones', String(milestoneCount));
  }, [urakkasumma, vatMode, selectedPreset, milestoneCount]);

  // Calculate rows when preset changes
  const calculateRows = () => {
    const baseAmount = parseFloat(urakkasumma) || 0;
    if (baseAmount <= 0) return [];

    let rows;
    if (selectedPreset === '10-80-10') {
      rows = generate108010Rows(milestoneCount);
    } else if (selectedPreset === 'custom') {
      return customRows;
    } else {
      rows = PRESETS[selectedPreset]?.rows || [];
    }

    // Calculate amounts with rounding adjustment
    let runningTotal = 0;
    const calculatedRows = rows.map((row, index) => {
      let amount;
      if (index === rows.length - 1) {
        // Last row gets the remainder to ensure exact total
        amount = baseAmount - runningTotal;
      } else {
        amount = Math.round((row.percent / 100) * baseAmount * 100) / 100;
      }
      runningTotal += amount;
      
      return {
        ...row,
        era: index + 1,
        summa: amount
      };
    });

    return calculatedRows;
  };

  const handleGenerateTable = () => {
    const amount = parseFloat(urakkasumma);
    if (!amount || amount <= 0) {
      toast.error('Syötä urakkasumma');
      return;
    }
    
    const rows = calculateRows();
    setPresetRows(rows);
    
    // Initialize custom rows from preset
    if (customRows.length === 0) {
      setCustomRows(rows.map(r => ({ ...r, id: Date.now() + r.era })));
    }
    
    setShowTable(true);
    toast.success('Taulukko luotu');
  };

  const handleClear = () => {
    setUrakkasumma('');
    setShowTable(false);
    setPresetRows([]);
    setCustomRows([]);
    toast.info('Taulukko tyhjennetty');
  };

  // Custom table handlers
  const handleCustomRowChange = (id, field, value) => {
    const baseAmount = parseFloat(urakkasumma) || 0;
    
    setCustomRows(prev => prev.map(row => {
      if (row.id !== id) return row;
      
      const updated = { ...row, [field]: value };
      
      // Auto-calc: if percent changes, update summa
      if (field === 'percent') {
        const pct = parseFloat(value) || 0;
        updated.summa = Math.round((pct / 100) * baseAmount * 100) / 100;
      }
      // Auto-calc: if summa changes, update percent
      else if (field === 'summa') {
        const sum = parseFloat(value) || 0;
        updated.percent = baseAmount > 0 ? (sum / baseAmount) * 100 : 0;
      }
      
      return updated;
    }));
  };

  const addCustomRow = () => {
    setCustomRows(prev => [...prev, {
      id: Date.now(),
      era: prev.length + 1,
      selite: '',
      percent: 0,
      summa: 0
    }]);
  };

  const removeCustomRow = (id) => {
    setCustomRows(prev => {
      const filtered = prev.filter(r => r.id !== id);
      // Renumber
      return filtered.map((r, i) => ({ ...r, era: i + 1 }));
    });
  };

  const normalizeCustomRows = () => {
    const total = customRows.reduce((sum, r) => sum + (parseFloat(r.percent) || 0), 0);
    if (total === 0) return;
    
    const baseAmount = parseFloat(urakkasumma) || 0;
    const factor = 100 / total;
    
    let runningTotal = 0;
    const normalized = customRows.map((row, index) => {
      const newPercent = (parseFloat(row.percent) || 0) * factor;
      let newSumma;
      if (index === customRows.length - 1) {
        newSumma = baseAmount - runningTotal;
      } else {
        newSumma = Math.round((newPercent / 100) * baseAmount * 100) / 100;
      }
      runningTotal += newSumma;
      
      return {
        ...row,
        percent: newPercent,
        summa: newSumma
      };
    });
    
    setCustomRows(normalized);
    toast.success('Prosentit normalisoitu 100%:iin');
  };

  // Validation
  const customTotal = customRows.reduce((sum, r) => sum + (parseFloat(r.percent) || 0), 0);
  const isCustomValid = Math.abs(customTotal - 100) < 0.1;

  // Get current rows based on tab
  const getCurrentRows = () => {
    return activeTab === 'custom' ? customRows : presetRows;
  };

  // Copy to clipboard
  const handleCopy = () => {
    const rows = getCurrentRows();
    const baseAmount = parseFloat(urakkasumma) || 0;
    const total = rows.reduce((sum, r) => sum + r.summa, 0);
    
    let text = 'Maksuerätaulukko\n';
    text += `Urakkasumma: ${formatCurrency(baseAmount)} € (${vatMode === 'alv0' ? 'ALV 0%' : 'sis. ALV 25,5%'})\n\n`;
    text += 'Erä\tSelite\t%\tSumma €\n';
    text += '────────────────────────────────────\n';
    
    rows.forEach(row => {
      text += `${row.era}\t${row.selite}\t${formatPercent(row.percent)} %\t${formatCurrency(row.summa)} €\n`;
    });
    
    text += '────────────────────────────────────\n';
    text += `Yhteensä\t\t100 %\t${formatCurrency(total)} €\n`;
    
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Kopioitu leikepöydälle');
    }).catch(() => {
      toast.error('Kopiointi epäonnistui');
    });
  };

  // PDF Export
  const handleExportPDF = () => {
    const rows = getCurrentRows();
    const baseAmount = parseFloat(urakkasumma) || 0;
    
    if (rows.length === 0 || baseAmount <= 0) {
      toast.error('Luo taulukko ensin');
      return;
    }
    
    try {
      exportMaksuerataulukkoPDF({
        urakkasumma: baseAmount,
        vatMode,
        presetName: PRESETS[selectedPreset]?.name || 'Oma',
        rows
      });
      toast.success('PDF luotu');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF-vienti epäonnistui');
    }
  };

  // Render table
  const renderTable = (rows, isEditable = false) => {
    const total = rows.reduce((sum, r) => sum + (r.summa || 0), 0);
    const percentTotal = rows.reduce((sum, r) => sum + (parseFloat(r.percent) || 0), 0);
    
    return (
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm" data-testid="maksuerataulukko-table">
          <thead className="bg-[#4A9BAD] text-white">
            <tr>
              <th className="text-left p-3 font-semibold w-16">Erä</th>
              <th className="text-left p-3 font-semibold">Selite</th>
              <th className="text-right p-3 font-semibold w-24">%</th>
              <th className="text-right p-3 font-semibold w-32">Summa €</th>
              {isEditable && <th className="w-12"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr 
                key={row.id || row.era} 
                className={`border-t ${index % 2 === 0 ? 'bg-white' : 'bg-[#F5F7FA]'}`}
              >
                <td className="p-3 text-gray-600">{row.era}</td>
                <td className="p-3">
                  {isEditable ? (
                    <Input
                      value={row.selite}
                      onChange={(e) => handleCustomRowChange(row.id, 'selite', e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Kuvaus"
                    />
                  ) : (
                    row.selite
                  )}
                </td>
                <td className="p-3 text-right">
                  {isEditable ? (
                    <Input
                      type="number"
                      value={row.percent || ''}
                      onChange={(e) => handleCustomRowChange(row.id, 'percent', e.target.value)}
                      className="h-8 text-sm text-right w-20"
                      step="0.1"
                    />
                  ) : (
                    `${formatPercent(row.percent)} %`
                  )}
                </td>
                <td className="p-3 text-right font-medium">
                  {isEditable ? (
                    <Input
                      type="number"
                      value={row.summa || ''}
                      onChange={(e) => handleCustomRowChange(row.id, 'summa', e.target.value)}
                      className="h-8 text-sm text-right w-28"
                      step="0.01"
                    />
                  ) : (
                    `${formatCurrency(row.summa)} €`
                  )}
                </td>
                {isEditable && (
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCustomRow(row.id)}
                      className="h-8 w-8 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100 border-t-2 border-[#4A9BAD]">
            <tr>
              <td className="p-3 font-bold" colSpan={2}>Yhteensä</td>
              <td className="p-3 text-right font-bold">
                {formatPercent(percentTotal)} %
                {isEditable && !isCustomValid && (
                  <span className="text-red-500 ml-1">!</span>
                )}
              </td>
              <td className="p-3 text-right font-bold text-[#4A9BAD]">
                {formatCurrency(total)} €
              </td>
              {isEditable && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-gray-600"
            data-testid="maksuerataulukko-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Takaisin
          </Button>
          <div className="h-6 w-px bg-gray-300"></div>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-[#4A9BAD]" />
            <h1 className="text-lg font-semibold text-gray-800">Maksuerätaulukko</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* INPUT SECTION */}
        <div className="bg-white rounded-lg border p-6 space-y-6" data-testid="maksuerataulukko-input">
          <h2 className="font-semibold text-gray-700 border-b pb-2">Syöttötiedot</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Urakkasumma */}
            <div className="space-y-2">
              <Label htmlFor="urakkasumma" className="text-sm font-medium">
                Urakkasumma (€) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="urakkasumma"
                type="number"
                value={urakkasumma}
                onChange={(e) => setUrakkasumma(e.target.value)}
                placeholder="100000"
                className="w-48"
                data-testid="maksuerataulukko-urakkasumma"
              />
            </div>

            {/* ALV mode */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">ALV-käsittely</Label>
              <RadioGroup
                value={vatMode}
                onValueChange={setVatMode}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="alv0" id="alv0" />
                  <Label htmlFor="alv0" className="cursor-pointer font-normal">
                    ALV 0%
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="incl" id="incl" />
                  <Label htmlFor="incl" className="cursor-pointer font-normal">
                    Sis. ALV 25,5%
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Preset selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Pohja</Label>
              <Select
                value={selectedPreset}
                onValueChange={setSelectedPreset}
              >
                <SelectTrigger className="w-56" data-testid="maksuerataulukko-preset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yse-6">YSE-6 (balanced)</SelectItem>
                  <SelectItem value="yse-8">YSE-8 (detailed)</SelectItem>
                  <SelectItem value="10-80-10">10–80–10 (valmisaste)</SelectItem>
                  <SelectItem value="custom">Oma (muokattava)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Milestone count for 10-80-10 */}
            {selectedPreset === '10-80-10' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Väli-erien määrä</Label>
                <Select
                  value={String(milestoneCount)}
                  onValueChange={(v) => setMilestoneCount(parseInt(v))}
                >
                  <SelectTrigger className="w-40" data-testid="maksuerataulukko-milestones">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 väli-erää (80%/4)</SelectItem>
                    <SelectItem value="5">5 väli-erää (80%/5)</SelectItem>
                    <SelectItem value="6">6 väli-erää (80%/6)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClear}
              data-testid="maksuerataulukko-clear"
            >
              Tyhjennä
            </Button>
            <Button
              onClick={handleGenerateTable}
              className="bg-[#4A9BAD] hover:bg-[#3d8699] text-white"
              data-testid="maksuerataulukko-generate"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Luo taulukko
            </Button>
          </div>
        </div>

        {/* OUTPUT SECTION */}
        {showTable && (
          <div className="bg-white rounded-lg border p-6 space-y-4" data-testid="maksuerataulukko-output">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-semibold text-gray-700">Maksuerätaulukko</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  data-testid="maksuerataulukko-copy"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Kopioi
                </Button>
                <Button
                  size="sm"
                  onClick={handleExportPDF}
                  className="bg-[#4A9BAD] hover:bg-[#3d8699] text-white"
                  data-testid="maksuerataulukko-pdf"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Vie PDF
                </Button>
              </div>
            </div>

            {/* Summary info */}
            <div className="flex gap-6 text-sm text-gray-600 bg-[#F5F7FA] p-3 rounded">
              <span>
                <strong>Urakkasumma:</strong> {formatCurrency(parseFloat(urakkasumma) || 0)} €
              </span>
              <span>
                <strong>ALV:</strong> {vatMode === 'alv0' ? 'ALV 0%' : 'Sis. ALV 25,5%'}
              </span>
              <span>
                <strong>Pohja:</strong> {PRESETS[selectedPreset]?.name || 'Oma'}
              </span>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                <TabsTrigger value="preset">Valmis</TabsTrigger>
                <TabsTrigger value="custom">Muokattava</TabsTrigger>
              </TabsList>

              <TabsContent value="preset" className="mt-4">
                {renderTable(presetRows, false)}
              </TabsContent>

              <TabsContent value="custom" className="mt-4 space-y-4">
                {/* Validation warning */}
                {!isCustomValid && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                    <AlertCircle className="h-5 w-5" />
                    <span className="text-sm">
                      Prosenttien summa on {formatPercent(customTotal)}% (pitäisi olla 100%)
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={normalizeCustomRows}
                      className="ml-auto"
                    >
                      Normalisoi
                    </Button>
                  </div>
                )}

                {isCustomValid && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
                    <Check className="h-5 w-5" />
                    <span className="text-sm">Prosenttien summa on 100% - taulukko on valmis</span>
                  </div>
                )}

                {renderTable(customRows, true)}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={addCustomRow}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Lisää rivi
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
};
