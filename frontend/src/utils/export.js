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

// Group measurements by operation (label + unit + pricePerUnit)
const groupMeasurements = (measurements) => {
  const groups = {};
  
  measurements.forEach(m => {
    // Calculate effective quantity for this measurement
    let effectiveQuantity = m.quantity || 0;
    if (m.type === 'wall' && m.wallHeight) {
      const bruttoM2 = effectiveQuantity * m.wallHeight * (m.bothSides ? 2 : 1);
      const openings = m.openings || 0;
      effectiveQuantity = bruttoM2 - openings;
    }
    
    // For Pystykotelot: kpl × height = jm for cost
    let costQuantity = effectiveQuantity;
    if ((m.isPystykotelot || m.isKuivatilaPystykotelo || m.isPRHPystykotelo) && m.wallHeight) {
      costQuantity = m.quantity * m.wallHeight;
    }

    // Create unique key: operationName + unit + pricePerUnit
    const operationName = m.label || 'Muu';
    const unit = m.unit || 'kpl';
    const pricePerUnit = m.pricePerUnit || 0;
    
    // Key includes price to separate same operations with different prices
    const key = `${operationName}__${unit}__${pricePerUnit}`;
    
    if (!groups[key]) {
      groups[key] = {
        label: operationName,
        unit: unit,
        pricePerUnit: pricePerUnit,
        totalQuantity: 0,
        totalCost: 0,
        measurementCount: 0,
        items: []
      };
    }
    
    groups[key].totalQuantity += effectiveQuantity;
    groups[key].totalCost += costQuantity * pricePerUnit;
    groups[key].measurementCount += 1;
    groups[key].items.push(m);
  });
  
  // Sort by cost (highest first)
  return Object.values(groups).sort((a, b) => b.totalCost - a.totalCost);
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
  
  // Table data - grouped by operation
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

  // Price summary ONLY for price export (no YHTEENVETO section)
  if (includePrices) {
    const finalY = doc.lastAutoTable.finalY + 15;
    const totalCost = grouped.reduce((sum, g) => sum + g.totalCost, 0);
    const vatPercentage = settings?.vatPercentage || 25.5;
    const vatAmount = totalCost * vatPercentage / 100;
    const totalWithVat = totalCost + vatAmount;
    
    // Price totals box
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(120, finalY - 5, 70, 35, 2, 2, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Yhteensä (ALV 0%):', 125, finalY + 5);
    doc.text(formatCurrency(totalCost), 185, finalY + 5, { align: 'right' });
    
    doc.text(`ALV ${vatPercentage}%:`, 125, finalY + 13);
    doc.text(formatCurrency(vatAmount), 185, finalY + 13, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.text('Yhteensä (sis. ALV):', 125, finalY + 23);
    doc.text(formatCurrency(totalWithVat), 185, finalY + 23, { align: 'right' });
  }
  
  // Save
  const suffix = includePrices ? '' : '_maarat';
  doc.save(`${project.name || 'projekti'}${suffix}_${new Date().toLocaleDateString('fi-FI').replace(/\./g, '-')}.pdf`);
};

// Company logo as Base64 - J&B Tasoitusmaalaus
const COMPANY_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAw0AAACzCAYAAADLyfB4AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA/hpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDEwLjAtYzAwMCA3OS5kMDRjYzE2OTgsIDIwMjUvMDcvMDItMTI6MTg6MTMgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0idXVpZDo1RDIwODkyNDkzQkZEQjExOTE0QTg1OTBEMzE1MDhDOCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpCQjkzRkZCMjBGQ0YxMUYxQTg5NEZGRDhGMEVCN0YwQyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpCQjkzRkZCMTBGQ0YxMUYxQTg5NEZGRDhGMEVCN0YwQyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBJbGx1c3RyYXRvciBDQyAyMDE1LjMgKFdpbmRvd3MpIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InV1aWQ6OWY1M2NhYTYtMmM0MC00ZGI0LTk3YzMtZDVlYTdkZWE1MTEwIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAu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';

// Brand colors
const BRAND_TEAL = [74, 155, 173]; // #4A9BAD
const BRAND_GRAY = [128, 128, 128];

// Export professional tarjous (offer/quote) PDF
export const exportTarjousPDF = (project, measurements, settings, tarjousData) => {
  const doc = new jsPDF();
  const grouped = groupMeasurements(measurements);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Calculate totals - use ALV 0% if sisallaAlv is false
  const vatPercentage = settings?.vatPercentage || 25.5;
  const showWithVat = tarjousData.sisallaAlv !== false; // default to true
  const totalCost = grouped.reduce((sum, g) => sum + g.totalCost, 0);
  const vatAmount = showWithVat ? totalCost * vatPercentage / 100 : 0;
  const totalWithVat = totalCost + vatAmount;
  
  // Add logo from base64
  try {
    // Logo dimensions - maintain aspect ratio
    const logoWidth = 60;
    const logoHeight = 15;
    doc.addImage(COMPANY_LOGO_BASE64, 'PNG', 20, 15, logoWidth, logoHeight);
  } catch (e) {
    // Fallback: draw text logo if image fails
    doc.setFontSize(20);
    doc.setTextColor(...BRAND_TEAL);
    doc.setFont('helvetica', 'bold');
    doc.text('J&B', 20, 25);
    doc.setTextColor(...BRAND_GRAY);
    doc.setFont('helvetica', 'italic');
    doc.text('tasoitusmaalaus', 38, 25);
  }
  
  // Company info - right aligned
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('J&B Tasoitus Ja Maalaus Oy', pageWidth - 20, 18, { align: 'right' });
  doc.text('Y-tunnus: XXXXXXX-X', pageWidth - 20, 23, { align: 'right' });
  doc.text('puh. XXX XXX XXXX', pageWidth - 20, 28, { align: 'right' });
  
  // Header line
  doc.setDrawColor(...BRAND_TEAL);
  doc.setLineWidth(0.5);
  doc.line(20, 38, pageWidth - 20, 38);
  
  // Title
  doc.setFontSize(22);
  doc.setTextColor(...BRAND_TEAL);
  doc.setFont('helvetica', 'bold');
  doc.text('TARJOUS', 20, 52);
  
  // Date
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  const today = new Date().toLocaleDateString('fi-FI');
  doc.text(`Päivämäärä: ${today}`, pageWidth - 20, 52, { align: 'right' });
  
  // Customer info box
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(20, 58, pageWidth - 40, 24, 2, 2, 'F');
  
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text('Asiakas:', 25, 67);
  doc.setFont('helvetica', 'bold');
  doc.text(tarjousData.asiakas || '', 50, 67);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Kohde:', 25, 75);
  doc.setFont('helvetica', 'bold');
  doc.text(tarjousData.kohde || project.name || '', 50, 75);
  
  // Work items table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND_TEAL);
  doc.text('Urakan sisältö', 20, 95);
  
  const tableData = grouped.map(g => [
    g.label,
    formatNumber(g.totalQuantity),
    g.unit
  ]);

  autoTable(doc, {
    startY: 100,
    head: [['Työ', 'Määrä', 'Yksikkö']],
    body: tableData,
    styles: { 
      fontSize: 9,
      cellPadding: 4,
      textColor: [60, 60, 60]
    },
    headStyles: { 
      fillColor: BRAND_TEAL,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10
    },
    alternateRowStyles: {
      fillColor: [250, 251, 252]
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { halign: 'right', cellWidth: 30 },
      2: { cellWidth: 25 }
    },
    margin: { left: 20, right: 20 }
  });

  let yPos = doc.lastAutoTable.finalY + 15;
  
  // Price section
  doc.setFillColor(...BRAND_TEAL);
  doc.roundedRect(20, yPos, pageWidth - 40, showWithVat ? 35 : 20, 2, 2, 'F');
  
  doc.setTextColor(255, 255, 255);
  
  if (showWithVat) {
    // Show with VAT
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Urakkahinta (ALV 0%):', 30, yPos + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(formatCurrency(totalCost), pageWidth - 30, yPos + 12, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`ALV ${vatPercentage}%:`, 30, yPos + 22);
    doc.text(formatCurrency(vatAmount), pageWidth - 30, yPos + 22, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Urakkahinta yhteensä (sis. ALV):', 30, yPos + 32);
    doc.setFontSize(16);
    doc.text(formatCurrency(totalWithVat), pageWidth - 30, yPos + 32, { align: 'right' });
    
    yPos += 50;
  } else {
    // Show ALV 0% only
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Urakkahinta (ALV 0%):', 30, yPos + 13);
    doc.setFontSize(16);
    doc.text(formatCurrency(totalCost), pageWidth - 30, yPos + 13, { align: 'right' });
    
    yPos += 35;
  }
  
  // Extra work hourly rate
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Muutos- ja lisätöiden tuntihinta: ${tarjousData.lisatyoHinta || '55'} €/h (+ ALV ${vatPercentage}%)`, 20, yPos);
  
  yPos += 15;
  
  // Terms section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_TEAL);
  doc.text('Tarjouksen ehdot', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  
  const terms = [
    '• Tarjous on voimassa 30 päivää tarjouksen päivämäärästä.',
    '• Yksityiskohtaiset työt ja materiaalit käydään läpi urakka- tai selontottoneuvottelussa.',
    '• Urakkahinta perustuu tämänhetkisiin materiaalikustannuksiin.',
    '• Tilaajan vastuulla on kohteen suojaus ennen töiden alkua, ellei toisin sovita.',
    '• Maksuehto: 14 pv netto.',
    '• Urakoitsija ei vastaa piilossa olevista vioista tai rakenteellisista ongelmista.'
  ];
  
  terms.forEach(term => {
    doc.text(term, 20, yPos);
    yPos += 6;
  });
  
  // Additional notes
  if (tarjousData.lisatiedot) {
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Lisätiedot:', 20, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    // Split long text into lines
    const splitText = doc.splitTextToSize(tarjousData.lisatiedot, pageWidth - 40);
    doc.text(splitText, 20, yPos);
    yPos += splitText.length * 5;
  }
  
  // Footer
  const footerY = pageHeight - 25;
  doc.setDrawColor(...BRAND_TEAL);
  doc.setLineWidth(0.3);
  doc.line(20, footerY - 5, pageWidth - 20, footerY - 5);
  
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_TEAL);
  doc.setFont('helvetica', 'bold');
  doc.text('J&B Tasoitus Ja Maalaus Oy', 20, footerY);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.text('Kiitos mielenkiinnostanne! Vastaamme mielellämme lisäkysymyksiin.', 20, footerY + 6);
  
  doc.text(`Sivu 1/1`, pageWidth - 20, footerY + 6, { align: 'right' });
  
  // Save
  const fileName = `Tarjous_${tarjousData.asiakas?.replace(/\s+/g, '_') || 'asiakas'}_${today.replace(/\./g, '-')}.pdf`;
  doc.save(fileName);
};

// Export PDF per floor
export const exportFloorPDF = (project, measurements, floor, settings) => {
  const doc = new jsPDF();
  const grouped = groupMeasurements(measurements);
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('KERROSKOHTAINEN MÄÄRÄLASKENTA', 105, 20, { align: 'center' });
  
  // Project and floor info
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Projekti: ${project.name || 'Nimetön projekti'}`, 20, 35);
  doc.text(`Kerros: ${floor.name}`, 20, 42);
  doc.text(`Päivämäärä: ${new Date().toLocaleDateString('fi-FI')}`, 20, 49);
  
  // Table data - grouped by operation, prices as ALV 0%
  const tableHeaders = [['Operaatio', 'Määrä', 'Yksikkö', 'Hinta €/yks (ALV 0%)', 'Yhteensä € (ALV 0%)']];
  const tableData = grouped.map(g => [
    g.label,
    formatNumber(g.totalQuantity),
    g.unit,
    formatNumber(g.pricePerUnit),
    formatNumber(g.totalCost)
  ]);

  autoTable(doc, {
    startY: 60,
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
    columnStyles: {
      0: { cellWidth: 70 },
      1: { halign: 'right', cellWidth: 25 },
      2: { cellWidth: 20 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 35 }
    }
  });

  // Summary section - NO unit aggregation
  const finalY = doc.lastAutoTable.finalY + 15;
  const totalCost = grouped.reduce((sum, g) => sum + g.totalCost, 0);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('YHTEENVETO', 20, finalY);
  
  doc.setFontSize(10);
  let yPos = finalY + 10;
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Operaatioita yhteensä: ${grouped.length}`, 20, yPos);
  yPos += 10;
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Yhteensä (ALV 0%): ${formatCurrency(totalCost)}`, 20, yPos);
  
  // Save
  const floorName = floor.name.replace(/\s+/g, '_').replace(/\./g, '');
  doc.save(`${project.name || 'projekti'}_${floorName}_${new Date().toLocaleDateString('fi-FI').replace(/\./g, '-')}.pdf`);
};
