import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COMPANY } from '@/constants/company';

// Import logo
import companyLogo from '@/assets/jb-logo.png';

// Brand colors (same as tarjous)
const BRAND_TEAL = [74, 155, 173]; // #4A9BAD
const BRAND_DARK = [60, 60, 60];
const BRAND_LIGHT = [245, 247, 250];

// Page layout constants (same as tarjous)
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 15;
const MARGIN_BOTTOM = 25;

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

// Helper function to format percent
const formatPercent = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return Number(value).toLocaleString('fi-FI', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 1 
  });
};

/**
 * Export Maksuerätaulukko PDF with same style as Tarjous
 * @param {Object} data - Contains urakkasumma, vatMode, presetName, rows
 */
export const exportMaksuerataulukkoPDF = (data) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;
  
  const { urakkasumma, vatMode, presetName, rows } = data;
  const total = rows.reduce((sum, r) => sum + (r.summa || 0), 0);
  const today = new Date().toLocaleDateString('fi-FI');
  
  let yPos = MARGIN_TOP;
  
  // ==================== HEADER (same as tarjous) ====================
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
    doc.setTextColor(128, 128, 128);
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
  doc.text('MAKSUERÄTAULUKKO', MARGIN_LEFT, yPos);
  
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_DARK);
  doc.setFont('helvetica', 'normal');
  doc.text(`Päivämäärä: ${today}`, pageWidth - MARGIN_RIGHT, yPos - 5, { align: 'right' });
  
  yPos += 15;
  
  // ==================== INFO BLOCK (same style as tarjous asiakastiedot) ====================
  doc.setFillColor(...BRAND_LIGHT);
  doc.roundedRect(MARGIN_LEFT, yPos, contentWidth, 28, 2, 2, 'F');
  
  const col1X = MARGIN_LEFT + 5;
  const col2X = MARGIN_LEFT + 45;
  const col3X = pageWidth / 2 + 10;
  const col4X = pageWidth / 2 + 50;
  let infoY = yPos + 8;
  
  doc.setFontSize(9);
  
  // Row 1 - Urakkasumma
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Urakkasumma:', col1X, infoY);
  doc.setTextColor(...BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(urakkasumma), col2X, infoY);
  
  // Row 1 - ALV
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('ALV:', col3X, infoY);
  doc.setTextColor(...BRAND_DARK);
  doc.text(vatMode === 'alv0' ? 'ALV 0%' : 'Sis. ALV 25,5%', col4X, infoY);
  
  infoY += 10;
  
  // Row 2 - Pohja
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Pohja:', col1X, infoY);
  doc.setTextColor(...BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.text(presetName || 'Oma', col2X, infoY);
  
  // Row 2 - Eriä
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Maksuerät:', col3X, infoY);
  doc.setTextColor(...BRAND_DARK);
  doc.text(`${rows.length} kpl`, col4X, infoY);
  
  yPos += 38;
  
  // ==================== TABLE (same style as tarjous) ====================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND_TEAL);
  doc.text('Maksuerät', MARGIN_LEFT, yPos);
  
  yPos += 5;
  
  // Prepare table data
  const tableData = rows.map(row => [
    row.era,
    row.selite,
    `${formatPercent(row.percent)} %`,
    formatCurrency(row.summa)
  ]);
  
  // Add total row
  tableData.push([
    { content: 'Yhteensä', colSpan: 2, styles: { fontStyle: 'bold' } },
    { content: '100 %', styles: { fontStyle: 'bold', halign: 'right' } },
    { content: formatCurrency(total), styles: { fontStyle: 'bold', halign: 'right' } }
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Erä', 'Selite', '%', 'Summa €']],
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
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' }
    },
    margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
    // Style the last row (total) differently
    didParseCell: function(data) {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fillColor = [230, 240, 245];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  yPos = doc.lastAutoTable.finalY + 15;
  
  // ==================== NOTES SECTION ====================
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  
  const notes = [
    '• Maksuerät laskutetaan urakan etenemisen mukaan.',
    '• Viimeinen erä laskutetaan, kun työ on vastaanotettu ja virheet korjattu.',
    '• Maksuehto sovitun mukaan, viivästyskorko korkolain mukaisesti.'
  ];
  
  notes.forEach(note => {
    doc.text(note, MARGIN_LEFT, yPos);
    yPos += 5;
  });
  
  // ==================== FOOTER (same style as tarjous) ====================
  const footerY = pageHeight - 20;
  
  doc.setDrawColor(...BRAND_TEAL);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, footerY - 8, pageWidth - MARGIN_RIGHT, footerY - 8);
  
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY.name, MARGIN_LEFT, footerY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(COMPANY.phone + ' | ' + COMPANY.email, MARGIN_LEFT, footerY + 5);
  
  doc.text(`Sivu 1 / 1`, pageWidth - MARGIN_RIGHT, footerY + 5, { align: 'right' });
  
  // Save
  const fileName = `Maksuerataulukko_${formatNumber(urakkasumma, 0).replace(/\s/g, '')}_${today.replace(/\./g, '-')}.pdf`;
  doc.save(fileName);
};
