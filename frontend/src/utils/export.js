import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNumber, formatCurrency } from './pdfHelpers';

export const exportToCSV = (measurements, summary, settings) => {
  const headers = [
    'Kategoria',
    'Alakategoria',
    'Yksikkö',
    'Määrä',
    'Hukka %',
    'Kerrokset',
    'Tuottavuus (m²/h)',
    'Työtunnit',
    'Työkustannus (€)',
    'Materiaali (€/yks)',
    'Materiaalikulut (€)',
    'Yhteensä (€)',
    'Huomiot'
  ];

  const rows = measurements.map(m => [
    m.category,
    m.subcategory,
    m.unit,
    formatNumber(m.quantity),
    m.waste,
    m.layers,
    formatNumber(m.productivity),
    formatNumber(m.laborHours),
    formatNumber(m.laborCost),
    formatNumber(m.materialCostPerUnit),
    formatNumber(m.totalMaterialCost),
    formatNumber(m.totalCost),
    m.notes || ''
  ]);

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';')),
    '',
    'YHTEENVETO',
    `Työtunnit yhteensä;${formatNumber(summary.totalLaborHours)}`,
    `Työkustannukset;${formatNumber(summary.totalLaborCost)} €`,
    `Materiaali;${formatNumber(summary.totalMaterialCost)} €`,
    `Hind kokku (ALV 0%);${formatNumber(summary.totalPrice)} €`,
    `Hind kokku (sis. ALV ${settings.vatPercentage}%);${formatNumber(summary.totalPriceWithVat)} €`
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `maaralaskenta_${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportToPDF = (project, measurements, summary, settings) => {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text('MÄÄRÄ- JA KUSTANNUSLASKENTA', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(`Projekti: ${project.name || 'Nimetön projekti'}`, 20, 35);
  doc.text(`Päivämäärä: ${new Date().toLocaleDateString('fi-FI')}`, 20, 42);
  
  if (project.calculator) {
    doc.text(`Laskija: ${project.calculator}`, 20, 49);
  }
  
  const tableData = measurements.map(m => [
    m.category,
    m.subcategory,
    `${formatNumber(m.quantity)} ${m.unit}`,
    `${m.waste}%`,
    `${m.layers}x`,
    formatNumber(m.laborHours),
    formatCurrency(m.laborCost),
    formatCurrency(m.totalMaterialCost),
    formatCurrency(m.totalCost)
  ]);

  autoTable(doc, {
    startY: 60,
    head: [[
      'Kategoria',
      'Alakategoria',
      'Määrä',
      'Hukka',
      'Kerr.',
      'Työtunnit',
      'Työkulut',
      'Materiaali',
      'Yhteensä'
    ]],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [0, 82, 204] }
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  
  doc.setFontSize(14);
  doc.text('YHTEENVETO', 20, finalY);
  
  doc.setFontSize(10);
  let yPos = finalY + 10;
  
  const summaryLines = [
    `Työtunnit yhteensä: ${formatNumber(summary.totalLaborHours)} h`,
    `Työkustannukset: ${formatCurrency(summary.totalLaborCost)}`,
    `Materiaali: ${formatCurrency(summary.totalMaterialCost)}`,
    `Hind kokku (ALV 0%): ${formatCurrency(summary.totalPrice)}`,
    `Hind kokku (sis. ALV ${settings.vatPercentage}%): ${formatCurrency(summary.totalPriceWithVat)}`
  ];
  
  summaryLines.forEach(line => {
    doc.text(line, 20, yPos);
    yPos += 7;
  });
  
  doc.save(`maaralaskenta_${project.name || 'projekti'}_${Date.now()}.pdf`);
};