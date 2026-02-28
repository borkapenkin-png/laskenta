export const detectScale = (text) => {
  const scalePatterns = [
    /1\s*:\s*(\d+)/,
    /M\s*1\s*:\s*(\d+)/i,
    /MITTAKAAVA\s*1\s*:\s*(\d+)/i,
    /SCALE\s*1\s*:\s*(\d+)/i
  ];

  for (const pattern of scalePatterns) {
    const match = text.match(pattern);
    if (match) {
      const denominator = parseInt(match[1], 10);
      return {
        detected: true,
        scale: `1:${denominator}`,
        denominator
      };
    }
  }

  return { detected: false };
};

export const calculatePixelsPerMeter = (pdfScale, pdfWidth, actualWidth) => {
  return pdfWidth / actualWidth;
};

export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '0.00';
  return Number(value).toFixed(decimals);
};

export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0,00 €';
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
};