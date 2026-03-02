import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Brand colors (same as tarjous)
const BRAND_TEAL = [74, 155, 173]; // #4A9BAD
const BRAND_DARK = [60, 60, 60];
const BRAND_LIGHT = [245, 247, 250];

// Page layout constants
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 20;

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
 * Export Maksuerätaulukko PDF - minimal header, no company info, no date, no preset name
 * @param {Object} data - Contains urakkasumma, vatMode, kohde, rows
 */
export const exportMaksuerataulukkoPDF = (data) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;
  
  const { urakkasumma, vatMode, kohde, rows } = data;
  const total = rows.reduce((sum, r) => sum + (r.summa || 0), 0);
  
  let yPos = MARGIN_TOP;
  
  // ==================== TITLE ====================
  doc.setFontSize(22);
  doc.setTextColor(...BRAND_TEAL);
  doc.setFont('helvetica', 'bold');
  doc.text('MAKSUERÄTAULUKKO', MARGIN_LEFT, yPos);
  
  yPos += 12;
  
  // Header line
  doc.setDrawColor(...BRAND_TEAL);
  doc.setLineWidth(0.8);
  doc.line(MARGIN_LEFT, yPos, pageWidth - MARGIN_RIGHT, yPos);
  
  yPos += 12;
  
  // ==================== INFO BLOCK (minimal) ====================
  doc.setFillColor(...BRAND_LIGHT);
  doc.roundedRect(MARGIN_LEFT, yPos, contentWidth, 24, 2, 2, 'F');
  
  let infoY = yPos + 9;
  
  doc.setFontSize(10);
  
  // Työmaa / Kohde
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Työmaa / Kohde:', MARGIN_LEFT + 5, infoY);
  doc.setTextColor(...BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  doc.text(kohde || '-', MARGIN_LEFT + 48, infoY);
  
  infoY += 8;
  
  // Urakkasumma + ALV
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Urakkasumma:', MARGIN_LEFT + 5, infoY);
  doc.setTextColor(...BRAND_DARK);
  doc.setFont('helvetica', 'bold');
  const vatText = vatMode === 'alv0' ? ' (ALV 0%)' : ' (sis. ALV 25,5%)';
  doc.text(formatCurrency(urakkasumma) + vatText, MARGIN_LEFT + 48, infoY);
  
  yPos += 34;
  
  // ==================== TABLE ====================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
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
    didParseCell: function(data) {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fillColor = [230, 240, 245];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  yPos = doc.lastAutoTable.finalY + 15;
  
  // ==================== NOTES ====================
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
  
  // Save with kohde in filename
  const safeKohde = (kohde || 'projekti').replace(/[^a-zA-Z0-9äöåÄÖÅ]/g, '_').substring(0, 30);
  const fileName = `Maksuerataulukko_${safeKohde}.pdf`;
  doc.save(fileName);
};
