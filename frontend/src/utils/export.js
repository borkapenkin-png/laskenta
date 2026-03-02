import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COMPANY, DEFAULT_TERMS, VAT_PERCENTAGE } from '@/constants/company';

// Import logo - webpack will handle this as data URL
import companyLogo from '@/assets/jb-logo.png';

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
    doc.addImage(companyLogo, 'PNG', 20, 15, logoWidth, logoHeight);
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
  
  // Return data for snapshot
  return {
    operations: grouped.map(g => ({
      label: g.label,
      quantity: g.totalQuantity,
      unit: g.unit,
    })),
    totals: {
      totalCost,
      vatPercentage: showWithVat ? vatPercentage : 0,
      vatAmount,
      totalWithVat,
    }
  };
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
