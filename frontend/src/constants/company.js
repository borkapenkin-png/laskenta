// Company information - hardcoded, not editable
export const COMPANY = {
  name: "J&B Tasoitus ja Maalaus Oy",
  businessId: "2869245-9",
  address: "Sienitie 25",
  zipCity: "00760 Helsinki",
  phone: "+358 40 054 7270",
  email: "info@jbtasoitusmaalaus.fi",
  website: "https://www.jbtasoitusmaalaus.fi/"
};

// Brand colors
export const BRAND_COLORS = {
  teal: [74, 155, 173],    // #4A9BAD
  gray: [128, 128, 128],
  darkGray: [60, 60, 60],
  lightGray: [245, 247, 250]
};

// Default terms for tarjous
export const DEFAULT_TERMS = [
  "Tarjous perustuu esitettyihin suunnitelmiin ja laskettuihin määriin.",
  "Mahdolliset lisä- ja muutostyöt veloitetaan erikseen sovittavan tuntihinnan mukaisesti.",
  "Tarjous on voimassa valitun ajan tarjouksen päiväyksestä.",
  "Maksuehto: sovitun mukaisesti.",
  "Tilaajan vastuulla on kohteen suojaus ennen töiden alkua, ellei toisin sovita.",
  "Urakoitsija ei vastaa piilossa olevista vioista tai rakenteellisista ongelmista."
];

// Validity options (days)
export const VALIDITY_OPTIONS = [
  { value: 14, label: "14 päivää" },
  { value: 30, label: "30 päivää" },
  { value: 60, label: "60 päivää" }
];

// Payment term options (days)
export const PAYMENT_TERM_OPTIONS = [
  { value: 7, label: "7 pv netto" },
  { value: 14, label: "14 pv netto" },
  { value: 30, label: "30 pv netto" }
];

// VAT percentage
export const VAT_PERCENTAGE = 25.5;
