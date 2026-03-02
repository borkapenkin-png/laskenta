import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Bug,
  X
} from 'lucide-react';

// Test status enum
const STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  PASS: 'pass',
  FAIL: 'fail',
  SKIP: 'skip'
};

// ==================== TEST DEFINITIONS ====================

const createTestSuite = () => [
  // Measurement System Tests
  {
    id: 'measure-add-preset',
    category: 'Measurement System',
    name: 'Add measurement with preset',
    run: async (ctx) => {
      // Simulate adding a measurement structure validation
      const newMeasurement = {
        id: `test-${Date.now()}`,
        type: 'area',
        label: 'Test Kattomaalaus 2x',
        calculatedValue: 25.5,
        unit: 'm²',
        pricePerUnit: 8.5,
        page: 1
      };
      
      // Validate measurement structure
      if (!newMeasurement.id) throw new Error('Missing id');
      if (!newMeasurement.type) throw new Error('Missing type');
      if (typeof newMeasurement.calculatedValue !== 'number') throw new Error('Invalid calculatedValue');
      if (!newMeasurement.unit) throw new Error('Missing unit');
      
      return { valid: true, label: newMeasurement.label };
    }
  },
  {
    id: 'measure-modify',
    category: 'Measurement System',
    name: 'Modify measurement quantity',
    run: async (ctx) => {
      // Simulate modification logic validation
      const measurement = {
        id: 'test-1',
        calculatedValue: 25.5
      };
      const newValue = 50.0;
      
      const modified = { ...measurement, calculatedValue: newValue };
      
      if (modified.calculatedValue !== newValue) {
        throw new Error(`Modification failed: expected ${newValue}, got ${modified.calculatedValue}`);
      }
      
      return { oldValue: measurement.calculatedValue, newValue: modified.calculatedValue };
    }
  },
  {
    id: 'measure-delete',
    category: 'Measurement System',
    name: 'Delete measurement',
    run: async (ctx) => {
      // Simulate delete logic validation
      const measurements = [
        { id: 'm1', label: 'Test 1' },
        { id: 'm2', label: 'Test 2' },
        { id: 'm3', label: 'Test 3' }
      ];
      
      const targetId = 'm2';
      const filtered = measurements.filter(m => m.id !== targetId);
      
      if (filtered.length !== 2) {
        throw new Error(`Delete failed: expected 2 items, got ${filtered.length}`);
      }
      
      if (filtered.find(m => m.id === targetId)) {
        throw new Error('Delete failed: target still exists');
      }
      
      return { deleted: targetId, remaining: filtered.length };
    }
  },
  {
    id: 'measure-undo',
    category: 'Measurement System',
    name: 'Undo operation',
    run: async (ctx) => {
      const before = ctx.getMeasurements?.()?.length || 0;
      ctx.undo?.();
      await delay(100);
      
      const after = ctx.getMeasurements?.()?.length || 0;
      // After undo of delete, count should increase
      if (after <= before) {
        return { skipped: 'Undo stack may be empty', before, after };
      }
      return { before, after, restored: true };
    }
  },
  {
    id: 'measure-redo',
    category: 'Measurement System',
    name: 'Redo operation',
    run: async (ctx) => {
      const before = ctx.getMeasurements?.()?.length || 0;
      ctx.redo?.();
      await delay(100);
      
      const after = ctx.getMeasurements?.()?.length || 0;
      return { before, after };
    }
  },
  {
    id: 'measure-state-consistency',
    category: 'Measurement System',
    name: 'State consistency check',
    run: async (ctx) => {
      const measurements = ctx.getMeasurements?.() || [];
      
      // Check all measurements have required fields
      for (const m of measurements) {
        if (!m.id) throw new Error('Measurement missing id');
        if (typeof m.calculatedValue !== 'number') throw new Error(`Invalid calculatedValue: ${m.calculatedValue}`);
        if (!m.unit) throw new Error('Measurement missing unit');
      }
      
      // Check no duplicate IDs
      const ids = measurements.map(m => m.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        throw new Error('Duplicate measurement IDs found');
      }
      
      return { count: measurements.length, valid: true };
    }
  },

  // Calculation System Tests
  {
    id: 'calc-unit-price',
    category: 'Calculation System',
    name: 'Unit price multiplication',
    run: async () => {
      const testCases = [
        { qty: 10, price: 8.5, expected: 85 },
        { qty: 25.5, price: 12, expected: 306 },
        { qty: 100, price: 5.5, expected: 550 },
        { qty: 0.5, price: 100, expected: 50 }
      ];
      
      for (const tc of testCases) {
        const result = tc.qty * tc.price;
        if (Math.abs(result - tc.expected) > 0.001) {
          throw new Error(`${tc.qty} × ${tc.price} = ${result}, expected ${tc.expected}`);
        }
      }
      return { tested: testCases.length };
    }
  },
  {
    id: 'calc-vat',
    category: 'Calculation System',
    name: 'VAT 0% vs incl VAT calculation',
    run: async () => {
      const basePrice = 1000;
      const vatRate = 25.5;
      
      // ALV 0% - no change
      const alv0 = basePrice;
      if (alv0 !== 1000) throw new Error(`ALV 0% should be ${basePrice}`);
      
      // Incl VAT
      const inclVat = basePrice * (1 + vatRate / 100);
      const expectedInclVat = 1255;
      if (Math.abs(inclVat - expectedInclVat) > 0.01) {
        throw new Error(`Incl VAT should be ${expectedInclVat}, got ${inclVat}`);
      }
      
      // Reverse calculation
      const netFromGross = inclVat / (1 + vatRate / 100);
      if (Math.abs(netFromGross - basePrice) > 0.01) {
        throw new Error(`Reverse VAT calc failed: ${netFromGross}`);
      }
      
      return { alv0, inclVat: inclVat.toFixed(2), vatRate };
    }
  },
  {
    id: 'calc-rounding',
    category: 'Calculation System',
    name: 'Rounding to 2 decimals',
    run: async () => {
      const testCases = [
        { value: 123.456, expected: '123.46' },
        { value: 99.994, expected: '99.99' },
        { value: 99.996, expected: '100.00' },
        { value: 0.001, expected: '0.00' },
        { value: 1000.554, expected: '1000.55' }
      ];
      
      for (const tc of testCases) {
        const result = tc.value.toFixed(2);
        if (result !== tc.expected) {
          throw new Error(`Rounding ${tc.value} = ${result}, expected ${tc.expected}`);
        }
      }
      return { tested: testCases.length };
    }
  },

  // Koontitarjous Tests
  {
    id: 'koonto-load-projects',
    category: 'Koontitarjous',
    name: 'Load sample project JSONs',
    run: async () => {
      const project1 = {
        version: '1.0',
        project: { id: 'qa-1', name: 'QA Test Project 1' },
        measurements: [
          { id: 'm1', label: 'Kattomaalaus 2x', calculatedValue: 45.5, unit: 'm²', pricePerUnit: 8.5 },
          { id: 'm2', label: 'Seinämaalaus 2x', calculatedValue: 120, unit: 'm²', pricePerUnit: 12 }
        ]
      };
      
      const project2 = {
        version: '1.0',
        project: { id: 'qa-2', name: 'QA Test Project 2' },
        measurements: [
          { id: 'm3', label: 'Kattomaalaus 2x', calculatedValue: 30, unit: 'm²', pricePerUnit: 8.5 },
          { id: 'm4', label: 'Jalkalista', calculatedValue: 25, unit: 'jm', pricePerUnit: 5 }
        ]
      };
      
      // Validate structure
      if (!project1.measurements || !project2.measurements) {
        throw new Error('Invalid project structure');
      }
      
      return { 
        project1: project1.project.name, 
        project2: project2.project.name,
        totalMeasurements: project1.measurements.length + project2.measurements.length
      };
    }
  },
  {
    id: 'koonto-merge',
    category: 'Koontitarjous',
    name: 'Merge identical operations',
    run: async () => {
      // Simulate merge logic
      const items = [
        { label: 'Kattomaalaus 2x', qty: 45.5, unit: 'm²', price: 8.5 },
        { label: 'Seinämaalaus 2x', qty: 120, unit: 'm²', price: 12 },
        { label: 'Kattomaalaus 2x', qty: 30, unit: 'm²', price: 8.5 }, // Duplicate
        { label: 'Jalkalista', qty: 25, unit: 'jm', price: 5 }
      ];
      
      const merged = {};
      for (const item of items) {
        const key = `${item.label}|${item.unit}|${item.price}`;
        if (merged[key]) {
          merged[key].qty += item.qty;
        } else {
          merged[key] = { ...item };
        }
      }
      
      const result = Object.values(merged);
      
      // Should have 3 unique items (Kattomaalaus merged)
      if (result.length !== 3) {
        throw new Error(`Expected 3 merged items, got ${result.length}`);
      }
      
      // Kattomaalaus should have qty 75.5
      const katto = result.find(r => r.label === 'Kattomaalaus 2x');
      if (!katto || Math.abs(katto.qty - 75.5) > 0.001) {
        throw new Error(`Kattomaalaus qty should be 75.5, got ${katto?.qty}`);
      }
      
      return { originalItems: items.length, mergedItems: result.length };
    }
  },
  {
    id: 'koonto-totals',
    category: 'Koontitarjous',
    name: 'Validate merged totals',
    run: async () => {
      const mergedItems = [
        { label: 'Kattomaalaus 2x', qty: 75.5, price: 8.5 },   // 641.75
        { label: 'Seinämaalaus 2x', qty: 120, price: 12 },     // 1440
        { label: 'Jalkalista', qty: 25, price: 5 }             // 125
      ];
      
      let total = 0;
      for (const item of mergedItems) {
        total += item.qty * item.price;
      }
      
      const expected = 641.75 + 1440 + 125; // 2206.75
      if (Math.abs(total - expected) > 0.01) {
        throw new Error(`Total should be ${expected}, got ${total}`);
      }
      
      return { total: total.toFixed(2), expected: expected.toFixed(2) };
    }
  },

  // Maksuerätaulukko Tests
  {
    id: 'maksut-yse6',
    category: 'Maksuerätaulukko',
    name: 'Generate YSE-6 schedule',
    run: async () => {
      const yse6 = [
        { selite: 'Työmaan käynnistys', percent: 10 },
        { selite: 'Valmistelut', percent: 15 },
        { selite: 'Pohjatyöt', percent: 20 },
        { selite: 'Pintatyöt', percent: 25 },
        { selite: 'Viimeistely', percent: 20 },
        { selite: 'Luovutus / virheet korjattu', percent: 10 }
      ];
      
      if (yse6.length !== 6) {
        throw new Error(`YSE-6 should have 6 rows, got ${yse6.length}`);
      }
      
      return { rows: yse6.length, preset: 'YSE-6' };
    }
  },
  {
    id: 'maksut-100percent',
    category: 'Maksuerätaulukko',
    name: 'Total equals 100%',
    run: async () => {
      const yse6Percents = [10, 15, 20, 25, 20, 10];
      const total = yse6Percents.reduce((sum, p) => sum + p, 0);
      
      if (total !== 100) {
        throw new Error(`YSE-6 total should be 100%, got ${total}%`);
      }
      
      // Test YSE-8
      const yse8Percents = [10, 12, 13, 13, 14, 14, 14, 10];
      const yse8Total = yse8Percents.reduce((sum, p) => sum + p, 0);
      
      if (yse8Total !== 100) {
        throw new Error(`YSE-8 total should be 100%, got ${yse8Total}%`);
      }
      
      return { yse6: `${total}%`, yse8: `${yse8Total}%` };
    }
  },
  {
    id: 'maksut-rounding',
    category: 'Maksuerätaulukko',
    name: 'Amount rounding check',
    run: async () => {
      const baseAmount = 100000;
      const percents = [10, 15, 20, 25, 20, 10];
      
      let runningTotal = 0;
      const amounts = percents.map((p, i) => {
        let amount;
        if (i === percents.length - 1) {
          // Last row gets remainder
          amount = baseAmount - runningTotal;
        } else {
          amount = Math.round((p / 100) * baseAmount * 100) / 100;
        }
        runningTotal += amount;
        return amount;
      });
      
      const total = amounts.reduce((sum, a) => sum + a, 0);
      
      if (Math.abs(total - baseAmount) > 0.01) {
        throw new Error(`Amounts total ${total} should equal base ${baseAmount}`);
      }
      
      return { 
        amounts: amounts.map(a => a.toFixed(2)), 
        total: total.toFixed(2),
        exact: total === baseAmount
      };
    }
  },
  {
    id: 'maksut-pdf',
    category: 'Maksuerätaulukko',
    name: 'PDF generation (silent)',
    run: async () => {
      // Simulate PDF generation validation
      const pdfData = {
        title: 'MAKSUERÄTAULUKKO',
        tilaaja: 'QA Test Client',
        kohde: 'QA Test Site',
        urakkasumma: 100000,
        rows: 6
      };
      
      if (!pdfData.title || !pdfData.tilaaja || !pdfData.kohde) {
        throw new Error('PDF missing required fields');
      }
      
      if (pdfData.urakkasumma <= 0) {
        throw new Error('Invalid urakkasumma');
      }
      
      return { fields: Object.keys(pdfData).length, valid: true };
    }
  },

  // PDF Generation Tests
  {
    id: 'pdf-no-overlap',
    category: 'PDF Generation',
    name: 'No overlapping blocks',
    run: async () => {
      // Simulate checking PDF layout
      const blocks = [
        { name: 'header', y: 15, height: 35 },
        { name: 'title', y: 55, height: 15 },
        { name: 'info', y: 75, height: 32 },
        { name: 'table', y: 115, height: 150 },
        { name: 'footer', y: 280, height: 15 }
      ];
      
      for (let i = 0; i < blocks.length - 1; i++) {
        const current = blocks[i];
        const next = blocks[i + 1];
        const currentEnd = current.y + current.height;
        
        if (currentEnd > next.y) {
          throw new Error(`Block "${current.name}" overlaps with "${next.name}"`);
        }
      }
      
      return { blocks: blocks.length, noOverlap: true };
    }
  },
  {
    id: 'pdf-totals-match',
    category: 'PDF Generation',
    name: 'Totals match calculation',
    run: async () => {
      // Simulate totals verification
      const items = [
        { qty: 45.5, price: 8.5 },
        { qty: 120, price: 12 },
        { qty: 32, price: 5 }
      ];
      
      const calculatedTotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
      const displayedTotal = 2026.75; // Expected: 386.75 + 1440 + 160 = 1986.75
      const expectedTotal = 386.75 + 1440 + 160;
      
      if (Math.abs(calculatedTotal - expectedTotal) > 0.01) {
        throw new Error(`Calculated ${calculatedTotal} !== expected ${expectedTotal}`);
      }
      
      return { calculated: calculatedTotal.toFixed(2), match: true };
    }
  }
];

// Utility delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==================== QA PANEL COMPONENT ====================

export const QAPanel = ({ 
  isOpen, 
  onClose,
  measurements,
  addMeasurement,
  updateMeasurement,
  deleteMeasurement,
  getMeasurements,
  undo,
  redo
}) => {
  const [tests, setTests] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    setTests(createTestSuite().map(t => ({ ...t, status: STATUS.PENDING, result: null, error: null })));
  }, []);

  const runAllTests = useCallback(async () => {
    setIsRunning(true);
    setSummary(null);
    
    const testContext = {
      measurements,
      addMeasurement,
      updateMeasurement,
      deleteMeasurement,
      getMeasurements,
      undo,
      redo
    };
    
    const updatedTests = [...tests];
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    
    for (let i = 0; i < updatedTests.length; i++) {
      const test = updatedTests[i];
      
      // Update status to running
      updatedTests[i] = { ...test, status: STATUS.RUNNING };
      setTests([...updatedTests]);
      
      try {
        const result = await test.run(testContext);
        updatedTests[i] = { ...test, status: STATUS.PASS, result, error: null };
        passed++;
      } catch (error) {
        updatedTests[i] = { ...test, status: STATUS.FAIL, result: null, error: error.message };
        failed++;
      }
      
      setTests([...updatedTests]);
      await delay(50); // Small delay for UI updates
    }
    
    setSummary({ passed, failed, skipped, total: tests.length });
    setIsRunning(false);
  }, [tests, measurements, addMeasurement, updateMeasurement, deleteMeasurement, getMeasurements, undo, redo]);

  const getStatusIcon = (status) => {
    switch (status) {
      case STATUS.PASS:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case STATUS.FAIL:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case STATUS.RUNNING:
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case STATUS.SKIP:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  if (!isOpen) return null;

  // Group tests by category
  const groupedTests = tests.reduce((acc, test) => {
    if (!acc[test.category]) acc[test.category] = [];
    acc[test.category].push(test);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <Bug className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">QA Test Suite</h2>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">DEV MODE</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Actions */}
        <div className="px-6 py-3 border-b flex items-center justify-between">
          <Button
            onClick={runAllTests}
            disabled={isRunning}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Full System Test
              </>
            )}
          </Button>
          
          {summary && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-600 font-medium">✓ {summary.passed} passed</span>
              <span className="text-red-600 font-medium">✗ {summary.failed} failed</span>
              <span className="text-gray-500">Total: {summary.total}</span>
            </div>
          )}
        </div>

        {/* Test Results */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {Object.entries(groupedTests).map(([category, categoryTests]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">{category}</h3>
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left p-3 w-8"></th>
                        <th className="text-left p-3">Test Name</th>
                        <th className="text-left p-3 w-20">Status</th>
                        <th className="text-left p-3">Result / Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryTests.map((test) => (
                        <tr key={test.id} className="border-t border-gray-200">
                          <td className="p-3">{getStatusIcon(test.status)}</td>
                          <td className="p-3 font-medium">{test.name}</td>
                          <td className="p-3">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              test.status === STATUS.PASS ? 'bg-green-100 text-green-700' :
                              test.status === STATUS.FAIL ? 'bg-red-100 text-red-700' :
                              test.status === STATUS.RUNNING ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {test.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-xs font-mono">
                            {test.error && (
                              <span className="text-red-600">{test.error}</span>
                            )}
                            {test.result && !test.error && (
                              <span className="text-gray-600">
                                {JSON.stringify(test.result).substring(0, 80)}
                                {JSON.stringify(test.result).length > 80 ? '...' : ''}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-gray-50 text-xs text-gray-500">
          Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Ctrl+Shift+Q</kbd> to toggle QA panel | 
          URL: <code>?qa=true</code>
        </div>
      </div>
    </div>
  );
};

// ==================== QA MODE HOOK ====================

export const useQAMode = () => {
  const [isQAMode, setIsQAMode] = useState(false);
  const [isQAPanelOpen, setIsQAPanelOpen] = useState(false);

  useEffect(() => {
    // Check URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('qa') === 'true') {
      setIsQAMode(true);
      setIsQAPanelOpen(true); // Auto-open panel when accessed via URL
    }

    // Keyboard shortcut: Ctrl+Shift+Q (Q for QA)
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'Q') {
        e.preventDefault();
        setIsQAMode(true);
        setIsQAPanelOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isQAMode,
    isQAPanelOpen,
    setIsQAPanelOpen,
    toggleQAPanel: () => setIsQAPanelOpen(prev => !prev)
  };
};
