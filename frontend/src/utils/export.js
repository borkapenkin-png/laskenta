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
const BRAND_DARK = [60, 60, 60];
const BRAND_LIGHT = [245, 247, 250];

// Page layout constants
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 15;
const MARGIN_BOTTOM = 30;

// Helper to check if we need a new page
const checkPageBreak = (doc, yPos, neededHeight, pageHeight) => {
  if (yPos + neededHeight > pageHeight - MARGIN_BOTTOM) {
    doc.addPage();
    return MARGIN_TOP + 10;
  }
  return yPos;
};

// Export professional tarjous (offer/quote) PDF
export const exportTarjousPDF = (project, measurements, settings, tarjousData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;
  
  // Determine mode
  const isManualMode = tarjousData.sourceMode === 'manual';
  
  // Get grouped measurements only for auto mode
  const grouped = isManualMode ? [] : groupMeasurements(measurements);
  
  // VAT settings
  const vatPercentage = settings?.vatPercentage || 25.5;
  const showWithVat = tarjousData.vatMode === 'incl';
  const materialHandlingPercent = tarjousData.materialHandlingPercent || 10;
  const lisatyoHinta = tarjousData.lisatyoHinta || '55';
  
  // Calculate totals (always internal ALV 0%)
  let totalCost;
  if (isManualMode) {
    totalCost = tarjousData.manualTotal || 0;
  } else {
    totalCost = grouped.reduce((sum, g) => sum + g.totalCost, 0);
  }
  const vatAmount = totalCost * vatPercentage / 100;
  const totalWithVat = totalCost + vatAmount;
  
  // Format date
  const offerDate = tarjousData.paivamaara 
    ? new Date(tarjousData.paivamaara).toLocaleDateString('fi-FI')
    : new Date().toLocaleDateString('fi-FI');
  
  let pageNumber = 1;
  let yPos = MARGIN_TOP;
  
  // ==================== HEADER ====================
  // Logo (left)
  try {
    const logoWidth = 55;
    const logoHeight = 14;
    doc.addImage(companyLogo, 'PNG', MARGIN_LEFT, yPos, logoWidth, logoHeight);
  } catch (e) {
    doc.setFontSize(18);
    doc.setTextColor(...BRAND_TEAL);
    doc.setFont('helvetica', 'bold');
    doc.text('J&B', MARGIN_LEFT, yPos + 10);
    doc.setTextColor(...BRAND_GRAY);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(12);
    doc.text('tasoitusmaalaus', MARGIN_LEFT + 18, yPos + 10);
  }
  
  // Company info (right)
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY.name, pageWidth - MARGIN_RIGHT, yPos + 3, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Y-tunnus: ${COMPANY.businessId}`, pageWidth - MARGIN_RIGHT, yPos + 8, { align: 'right' });
  doc.text(COMPANY.address, pageWidth - MARGIN_RIGHT, yPos + 13, { align: 'right' });
  doc.text(COMPANY.zipCity, pageWidth - MARGIN_RIGHT, yPos + 18, { align: 'right' });
  doc.text(COMPANY.phone, pageWidth - MARGIN_RIGHT, yPos + 23, { align: 'right' });
  doc.text(COMPANY.email, pageWidth - MARGIN_RIGHT, yPos + 28, { align: 'right' });
  
  yPos += 35;
  
  // Header line
  doc.setDrawColor(...BRAND_TEAL);
  doc.setLineWidth(0.8);
  doc.line(MARGIN_LEFT, yPos, pageWidth - MARGIN_RIGHT, yPos);
  
  yPos += 12;
  
  // ==================== TITLE SECTION ====================
  doc.setFontSize(24);
  doc.setTextColor(...BRAND_TEAL);
  doc.setFont('helvetica', 'bold');
  doc.text('TARJOUS', MARGIN_LEFT, yPos);
  
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_DARK);
  doc.setFont('helvetica', 'normal');
  doc.text(`Päivämäärä: ${offerDate}`, pageWidth - MARGIN_RIGHT, yPos - 5, { align: 'right' });
  
  yPos += 12;
  
  // ==================== ASIAKASTIEDOT BLOCK ====================
  doc.setFillColor(...BRAND_LIGHT);
  doc.roundedRect(MARGIN_LEFT, yPos, contentWidth, 42, 2, 2, 'F');
  
  const col1X = MARGIN_LEFT + 5;
  const col2X = MARGIN_LEFT + 50;
  const col3X = pageWidth / 2 + 10;
  const col4X = pageWidth / 2 + 55;
  let infoY = yPos + 8;
  
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  
  // Row 1
  doc.text('Asiakas:', col1X, infoY);
  doc.setTextColor(...BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.text(tarjousData.asiakas || '', col2X, infoY);
  
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Voimassa:', col3X, infoY);
  doc.setTextColor(...BRAND_DARK);
  doc.text(`${tarjousData.voimassa || 30} päivää`, col4X, infoY);
  
  infoY += 8;
  
  // Row 2
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Kohde:', col1X, infoY);
  doc.setTextColor(...BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.text(tarjousData.kohde || project.name || '', col2X, infoY);
  
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Maksuehto:', col3X, infoY);
  doc.setTextColor(...BRAND_DARK);
  doc.text(`${tarjousData.maksuehto || 14} pv netto`, col4X, infoY);
  
  infoY += 8;
  
  // Row 3 (optional)
  if (tarjousData.yhteyshenkilo) {
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('Yhteyshenkilö:', col1X, infoY);
    doc.setTextColor(...BRAND_DARK);
    doc.text(tarjousData.yhteyshenkilo, col2X, infoY);
  }
  
  if (tarjousData.email) {
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('Sähköposti:', col3X, infoY);
    doc.setTextColor(...BRAND_DARK);
    doc.text(tarjousData.email, col4X, infoY);
  }
  
  infoY += 8;
  
  // Row 4 (phone)
  if (tarjousData.puhelin) {
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('Puhelin:', col1X, infoY);
    doc.setTextColor(...BRAND_DARK);
    doc.text(tarjousData.puhelin, col2X, infoY);
  }
  
  yPos += 50;
  
  // ==================== URAKAN SISÄLTÖ (Manual mode text) ====================
  if (isManualMode && tarjousData.urakanSisalto) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...BRAND_TEAL);
    doc.text('Urakan sisältö', MARGIN_LEFT, yPos);
    
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND_DARK);
    
    // Split and wrap text properly
    const scopeLines = doc.splitTextToSize(tarjousData.urakanSisalto, contentWidth);
    scopeLines.forEach(line => {
      yPos = checkPageBreak(doc, yPos, 5, pageHeight);
      doc.text(line, MARGIN_LEFT, yPos);
      yPos += 5;
    });
    
    yPos += 8;
  }
  
  // ==================== CONTENT TABLE / HINTA ====================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND_TEAL);
  doc.text(isManualMode ? 'Hinta' : 'Urakan sisältö', MARGIN_LEFT, yPos);
  
  yPos += 5;
  
  // Prepare table data based on mode
  let tableData;
  if (isManualMode) {
    if (tarjousData.useKokonaishinta) {
      // Single kokonaishinta - no table, just show total
      tableData = null;
    } else {
      // Manual rows table
      tableData = tarjousData.manualRows
        .filter(r => r.toimenpide || r.maara)
        .map(r => [
          r.toimenpide || '',
          r.maara || '',
          r.yksikko || '',
          r.yksikkohinta ? formatCurrency(parseFloat(r.yksikkohinta)) : '',
          formatCurrency(r.yhteensa || 0)
        ]);
    }
  } else {
    // Auto mode - grouped measurements
    tableData = grouped.map(g => [
      g.label,
      formatNumber(g.totalQuantity),
      g.unit,
      formatCurrency(g.pricePerUnit),
      formatCurrency(g.totalCost)
    ]);
  }

  // Only show table if we have data
  if (tableData && tableData.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Toimenpide', 'Määrä', 'Yksikkö', 'Yksikköhinta', 'Yhteensä']],
      body: tableData,
      styles: { 
        fontSize: 9,
        cellPadding: 4,
        textColor: BRAND_DARK,
        lineColor: [220, 220, 220],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: BRAND_TEAL,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [250, 251, 252]
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { halign: 'right', cellWidth: 25 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }
      },
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      didDrawPage: () => {
        pageNumber++;
      }
    });
    yPos = doc.lastAutoTable.finalY + 10;
  } else {
    // No table (kokonaishinta mode)
    yPos += 5;
  }
  
  // ==================== TOTALS SECTION ====================
  yPos = checkPageBreak(doc, yPos, 50, pageHeight);
  
  const totalsBoxHeight = showWithVat ? 40 : 22;
  doc.setFillColor(...BRAND_TEAL);
  doc.roundedRect(MARGIN_LEFT, yPos, contentWidth, totalsBoxHeight, 2, 2, 'F');
  
  doc.setTextColor(255, 255, 255);
  
  if (showWithVat) {
    // Show with VAT - 3 lines
    let totY = yPos + 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Yhteensä (ALV 0%):', MARGIN_LEFT + 10, totY);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(totalCost), pageWidth - MARGIN_RIGHT - 10, totY, { align: 'right' });
    
    totY += 10;
    doc.setFont('helvetica', 'normal');
    doc.text(`ALV ${vatPercentage} %:`, MARGIN_LEFT + 10, totY);
    doc.text(formatCurrency(vatAmount), pageWidth - MARGIN_RIGHT - 10, totY, { align: 'right' });
    
    totY += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Yhteensä (sis. ALV):', MARGIN_LEFT + 10, totY);
    doc.setFontSize(14);
    doc.text(formatCurrency(totalWithVat), pageWidth - MARGIN_RIGHT - 10, totY, { align: 'right' });
    
    yPos += totalsBoxHeight + 12;
  } else {
    // ALV 0% only - single line
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Yhteensä (ALV 0%):', MARGIN_LEFT + 10, yPos + 14);
    doc.setFontSize(14);
    doc.text(formatCurrency(totalCost), pageWidth - MARGIN_RIGHT - 10, yPos + 14, { align: 'right' });
    
    yPos += totalsBoxHeight + 12;
  }
  
  // ==================== LISÄ- JA MUUTOSTYÖT SECTION ====================
  yPos = checkPageBreak(doc, yPos, 35, pageHeight);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_TEAL);
  doc.text('Lisä- ja muutostyöt', MARGIN_LEFT, yPos);
  
  yPos += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_DARK);
  
  // Hourly rate - respect VAT mode
  const hourlyRateText = showWithVat 
    ? `Työ: ${lisatyoHinta} €/h (sis. ALV ${vatPercentage} %)`
    : `Työ: ${lisatyoHinta} €/h (ALV 0%)`;
  doc.text(hourlyRateText, MARGIN_LEFT, yPos);
  
  yPos += 5;
  doc.text(`Materiaalit: hankintahinta + ${materialHandlingPercent} % (materiaalihankinta ja yleiskulu)`, MARGIN_LEFT, yPos);
  
  yPos += 6;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Lisä- ja muutostyöt toteutetaan tilaajan erillisellä hyväksynnällä ja laskutetaan toteutuneen mukaan.', MARGIN_LEFT, yPos);
  
  yPos += 12;
  
  // ==================== TARJOUKSEN EHDOT ====================
  if (tarjousData.kaytaVakioehtoja !== false) {
    yPos = checkPageBreak(doc, yPos, 80, pageHeight);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BRAND_TEAL);
    doc.text('Tarjouksen ehdot', MARGIN_LEFT, yPos);
    
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND_DARK);
    
    DEFAULT_TERMS.forEach((term, index) => {
      // Check page break for each term
      yPos = checkPageBreak(doc, yPos, 12, pageHeight);
      
      const bulletText = `${index + 1}. ${term}`;
      const splitText = doc.splitTextToSize(bulletText, contentWidth - 5);
      
      splitText.forEach((line, lineIndex) => {
        yPos = checkPageBreak(doc, yPos, 5, pageHeight);
        doc.text(line, MARGIN_LEFT + (lineIndex === 0 ? 0 : 5), yPos);
        yPos += 4.5;
      });
      yPos += 1;
    });
  }
  
  // ==================== LISÄTIEDOT ====================
  if (tarjousData.lisatiedot) {
    yPos += 5;
    yPos = checkPageBreak(doc, yPos, 25, pageHeight);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND_TEAL);
    doc.text('Lisätiedot', MARGIN_LEFT, yPos);
    
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND_DARK);
    
    const splitText = doc.splitTextToSize(tarjousData.lisatiedot, contentWidth);
    splitText.forEach(line => {
      yPos = checkPageBreak(doc, yPos, 5, pageHeight);
      doc.text(line, MARGIN_LEFT, yPos);
      yPos += 5;
    });
  }
  
  // ==================== FOOTER (on all pages) ====================
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 15;
    
    doc.setDrawColor(...BRAND_TEAL);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_LEFT, footerY - 5, pageWidth - MARGIN_RIGHT, footerY - 5);
    
    doc.setFontSize(8);
    doc.setTextColor(...BRAND_TEAL);
    doc.setFont('helvetica', 'bold');
    doc.text(COMPANY.name, MARGIN_LEFT, footerY);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Kiitos mielenkiinnostanne!', MARGIN_LEFT, footerY + 5);
    
    doc.text(`Sivu ${i} / ${totalPages}`, pageWidth - MARGIN_RIGHT, footerY + 5, { align: 'right' });
  }
  
  // Save
  const fileName = `Tarjous_${tarjousData.asiakas?.replace(/\s+/g, '_') || 'asiakas'}_${offerDate.replace(/\./g, '-')}.pdf`;
  doc.save(fileName);
  
  // Return data for snapshot
  return {
    operations: grouped.map(g => ({
      label: g.label,
      quantity: g.totalQuantity,
      unit: g.unit,
      pricePerUnit: g.pricePerUnit,
      totalCost: g.totalCost,
    })),
    totals: {
      totalCost,
      vatPercentage: showWithVat ? vatPercentage : 0,
      vatAmount: showWithVat ? vatAmount : 0,
      totalWithVat: showWithVat ? totalWithVat : totalCost,
    }
  };
};

// Export koontitarjous (summary offer) PDF from multiple snapshots
export const exportKoontitarjousPDF = (snapshots, tarjousData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const vatPercentage = tarjousData.vatPercentage || 25.5;
  const showWithVat = tarjousData.sisallaAlv !== false;
  
  // Calculate grand totals
  let grandTotalCost = 0;
  snapshots.forEach(s => {
    grandTotalCost += s.totals?.totalCost || 0;
  });
  const grandVatAmount = showWithVat ? grandTotalCost * vatPercentage / 100 : 0;
  const grandTotalWithVat = grandTotalCost + grandVatAmount;
  
  // Add logo
  try {
    const logoWidth = 60;
    const logoHeight = 15;
    doc.addImage(companyLogo, 'PNG', 20, 15, logoWidth, logoHeight);
  } catch (e) {
    doc.setFontSize(20);
    doc.setTextColor(...BRAND_TEAL);
    doc.setFont('helvetica', 'bold');
    doc.text('J&B', 20, 25);
    doc.setTextColor(...BRAND_GRAY);
    doc.setFont('helvetica', 'italic');
    doc.text('tasoitusmaalaus', 38, 25);
  }
  
  // Company info
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
  doc.text('KOONTITARJOUS', 20, 52);
  
  // Date
  const today = new Date().toLocaleDateString('fi-FI');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
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
  doc.text(tarjousData.kohde || 'Koontitarjous', 50, 75);
  
  // Parts table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND_TEAL);
  doc.text('Tarjouksen osat', 20, 95);
  
  const tableData = snapshots.map(s => [
    s.title || s.projectName || 'Tarjous',
    new Date(s.createdAt).toLocaleDateString('fi-FI'),
    formatCurrency(s.totals?.totalCost || 0)
  ]);

  autoTable(doc, {
    startY: 100,
    head: [['Osa / Kohde', 'Päivämäärä', 'Hinta (ALV 0%)']],
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
      0: { cellWidth: 90 },
      1: { cellWidth: 35, halign: 'center' },
      2: { halign: 'right', cellWidth: 40 }
    },
    margin: { left: 20, right: 20 }
  });

  let yPos = doc.lastAutoTable.finalY + 15;
  
  // Grand total price section
  doc.setFillColor(...BRAND_TEAL);
  doc.roundedRect(20, yPos, pageWidth - 40, showWithVat ? 35 : 20, 2, 2, 'F');
  
  doc.setTextColor(255, 255, 255);
  
  if (showWithVat) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Kokonaishinta (ALV 0%):', 30, yPos + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(formatCurrency(grandTotalCost), pageWidth - 30, yPos + 12, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`ALV ${vatPercentage}%:`, 30, yPos + 22);
    doc.text(formatCurrency(grandVatAmount), pageWidth - 30, yPos + 22, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Kokonaishinta yhteensä (sis. ALV):', 30, yPos + 32);
    doc.setFontSize(16);
    doc.text(formatCurrency(grandTotalWithVat), pageWidth - 30, yPos + 32, { align: 'right' });
    
    yPos += 50;
  } else {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Kokonaishinta (ALV 0%):', 30, yPos + 13);
    doc.setFontSize(16);
    doc.text(formatCurrency(grandTotalCost), pageWidth - 30, yPos + 13, { align: 'right' });
    
    yPos += 35;
  }
  
  // Terms
  yPos += 10;
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
    '• Koontitarjous sisältää yllä mainitut osat.',
    '• Maksuehto: 14 pv netto.'
  ];
  
  terms.forEach(term => {
    doc.text(term, 20, yPos);
    yPos += 6;
  });
  
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
  doc.text('Kiitos mielenkiinnostanne!', 20, footerY + 6);
  doc.text(`Sivu 1/1`, pageWidth - 20, footerY + 6, { align: 'right' });
  
  // Save
  const fileName = `Koontitarjous_${tarjousData.asiakas?.replace(/\s+/g, '_') || 'asiakas'}_${today.replace(/\./g, '-')}.pdf`;
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
