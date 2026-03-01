import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper function to format numbers Finnish style
const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '0,00';
  return Number(value).toLocaleString('fi-FI', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

// Helper function to format currency Finnish style
const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0,00 €';
  return Number(value).toLocaleString('fi-FI', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }) + ' €';
};

// Group measurements by label (type)
const groupMeasurements = (measurements) => {
  const groups = {};
  
  measurements.forEach(m => {
    const key = m.label || 'Muu';
    if (!groups[key]) {
      groups[key] = {
        label: m.label || 'Muu',
        unit: m.unit,
        pricePerUnit: m.pricePerUnit || 0,
        totalQuantity: 0,
        totalCost: 0,
        items: []
      };
    }
    
    // Calculate effective quantity for this measurement
    let effectiveQuantity = m.quantity || 0;
    if (m.type === 'wall' && m.wallHeight) {
      const bruttoM2 = effectiveQuantity * m.wallHeight * (m.bothSides ? 2 : 1);
      const openings = m.openings || 0;
      effectiveQuantity = bruttoM2 - openings;
    }
    
    groups[key].totalQuantity += effectiveQuantity;
    groups[key].totalCost += effectiveQuantity * (m.pricePerUnit || 0);
    groups[key].items.push(m);
  });
  
  return Object.values(groups);
};

export const exportToCSV = (measurements, summary, settings) => {
  const grouped = groupMeasurements(measurements);
  
  const headers = [
    'Tyyppi',
    'Määrä',
    'Yksikkö',
    'Hinta (€/yks)',
    'Yhteensä (€)'
  ];

  const rows = grouped.map(g => [
    g.label,
    formatNumber(g.totalQuantity),
    g.unit,
    formatNumber(g.pricePerUnit),
    formatNumber(g.totalCost)
  ]);

  const vatPercentage = settings?.vatPercentage || 25.5;
  const totalCost = grouped.reduce((sum, g) => sum + g.totalCost, 0);
  const vatAmount = totalCost * vatPercentage / 100;
  const totalWithVat = totalCost + vatAmount;

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';')),
    '',
    'YHTEENVETO',
    `Yhteensä (ALV 0%);${formatNumber(totalCost)} €`,
    `ALV ${vatPercentage}%;${formatNumber(vatAmount)} €`,
    `Yhteensä (sis. ALV);${formatNumber(totalWithVat)} €`
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `maaralaskenta_${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

// Export PDF with prices (full version)
export const exportToPDF = (project, measurements, summary, settings) => {
  exportPDFWithOptions(project, measurements, settings, true);
};

// Export PDF without prices (for subcontractors)
export const exportToPDFQuantitiesOnly = (project, measurements, settings) => {
  exportPDFWithOptions(project, measurements, settings, false);
};

// Common PDF export function with options
const exportPDFWithOptions = (project, measurements, settings, includePrices) => {
  const doc = new jsPDF();
  const grouped = groupMeasurements(measurements);
  
  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const title = includePrices ? 'MÄÄRÄ- JA KUSTANNUSLASKENTA' : 'MÄÄRÄLASKENTA';
  doc.text(title, 105, 20, { align: 'center' });
  
  // Project info
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Projekti: ${project.name || 'Nimetön projekti'}`, 20, 35);
  doc.text(`Päivämäärä: ${new Date().toLocaleDateString('fi-FI')}`, 20, 42);
  
  // Table data - grouped by type
  let tableHeaders, tableData;
  
  if (includePrices) {
    tableHeaders = [['Tyyppi', 'Määrä', 'Yksikkö', 'Hinta €/yks', 'Yhteensä €']];
    tableData = grouped.map(g => [
      g.label,
      formatNumber(g.totalQuantity),
      g.unit,
      formatNumber(g.pricePerUnit),
      formatNumber(g.totalCost)
    ]);
  } else {
    tableHeaders = [['Tyyppi', 'Määrä', 'Yksikkö']];
    tableData = grouped.map(g => [
      g.label,
      formatNumber(g.totalQuantity),
      g.unit
    ]);
  }

  autoTable(doc, {
    startY: 55,
    head: tableHeaders,
    body: tableData,
    styles: { 
      fontSize: 9,
      cellPadding: 3
    },
    headStyles: { 
      fillColor: [0, 82, 204],
      textColor: 255,
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250]
    },
    columnStyles: includePrices ? {
      0: { cellWidth: 70 },
      1: { halign: 'right', cellWidth: 25 },
      2: { cellWidth: 20 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 35 }
    } : {
      0: { cellWidth: 100 },
      1: { halign: 'right', cellWidth: 40 },
      2: { cellWidth: 30 }
    }
  });

  // Summary section
  const finalY = doc.lastAutoTable.finalY + 15;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('YHTEENVETO', 20, finalY);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let yPos = finalY + 10;
  
  // Quantity summary by unit
  const quantityByUnit = {};
  grouped.forEach(g => {
    if (!quantityByUnit[g.unit]) {
      quantityByUnit[g.unit] = 0;
    }
    quantityByUnit[g.unit] += g.totalQuantity;
  });
  
  Object.entries(quantityByUnit).forEach(([unit, qty]) => {
    doc.text(`${unit}: ${formatNumber(qty)}`, 20, yPos);
    yPos += 7;
  });
  
  // Cost summary (only if prices included)
  if (includePrices) {
    yPos += 5;
    const vatPercentage = settings?.vatPercentage || 25.5;
    const totalCost = grouped.reduce((sum, g) => sum + g.totalCost, 0);
    const vatAmount = totalCost * vatPercentage / 100;
    const totalWithVat = totalCost + vatAmount;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Yhteenveto', 20, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Yhteensä (ALV 0%): ${formatCurrency(totalCost)}`, 20, yPos);
    yPos += 7;
    doc.text(`ALV ${vatPercentage}%: ${formatCurrency(vatAmount)}`, 20, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'bold');
    doc.text(`Yhteensä (sis. ALV): ${formatCurrency(totalWithVat)}`, 20, yPos);
  }
  
  // Save
  const suffix = includePrices ? '' : '_maarat';
  doc.save(`${project.name || 'projekti'}${suffix}_${new Date().toLocaleDateString('fi-FI').replace(/\./g, '-')}.pdf`);
};
