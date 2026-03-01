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

// Company logo as Base64 - J&B Tasoitusmaalaus
const COMPANY_LOGO_URL = 'https://customer-assets.emergentagent.com/job_4628cfe4-4401-4d0d-bec9-a250414cea6b/artifacts/u200pb2s_IMG_6020.png';

// Brand colors
const BRAND_TEAL = [74, 155, 173]; // #4A9BAD
const BRAND_GRAY = [128, 128, 128];

// Export professional tarjous (offer/quote) PDF
export const exportTarjousPDF = async (project, measurements, settings, tarjousData) => {
  const doc = new jsPDF();
  const grouped = groupMeasurements(measurements);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Calculate totals
  const vatPercentage = settings?.vatPercentage || 25.5;
  const totalCost = grouped.reduce((sum, g) => sum + g.totalCost, 0);
  const vatAmount = totalCost * vatPercentage / 100;
  const totalWithVat = totalCost + vatAmount;
  
  // Load and add logo
  try {
    const logoImg = await loadImage(COMPANY_LOGO_URL);
    // Logo dimensions - maintain aspect ratio
    const logoWidth = 60;
    const logoHeight = 15;
    doc.addImage(logoImg, 'PNG', 20, 15, logoWidth, logoHeight);
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
  doc.roundedRect(20, yPos, pageWidth - 40, 35, 2, 2, 'F');
  
  doc.setTextColor(255, 255, 255);
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

// Helper function to load image as base64
const loadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
};
