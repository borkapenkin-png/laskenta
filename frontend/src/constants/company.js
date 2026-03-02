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

// Default terms for tarjous - Professional construction offer terms
export const DEFAULT_TERMS = [
  "Tarjous perustuu kohteesta saatuihin tietoihin, piirustuksiin sekä urakoitsijan tekemiin havaintoihin tarjouksen laadintahetkellä.",
  "Urakkahinta sisältää sovitut maalaus- ja tasoitustyöt tarjouksen mukaisessa laajuudessa. Mahdolliset lisä- ja muutostyöt toteutetaan tilaajan erillisellä hyväksynnällä ja laskutetaan erikseen sovituin perustein.",
  "Urakkaan sisältyy normaalit työnaikaiset suojaukset ja siisteys. Erityissuojaukset, työskentely käytössä olevissa tiloissa, ilta- tai viikonlopputyöt hinnoitellaan erikseen.",
  "Tilaaja vastaa työalueen esteettömyydestä sekä sähkön ja veden saatavuudesta sovitusti.",
  "Urakoitsija myöntää työlle YSE:n mukaisten periaatteiden mukaisen takuun, ellei toisin sovita. Tavanomainen takuuaika maalaus- ja tasoitustöille on kaksi (2) vuotta työn valmistumisesta.",
  "Takuu kattaa työn suorituksessa ilmenevät virheet, jotka johtuvat urakoitsijan työvirheestä tai materiaalin virheellisestä käsittelystä.",
  "Takuu ei kata rakenteellisesta liikkeestä, alustan elämisestä, kosteusrasituksesta, rakennuksen painumisesta tai muista urakoitsijasta riippumattomista syistä johtuvia halkeamia, irtoamisia tai pintavaurioita.",
  "Maksuehto sovitun mukaisesti. Viivästyskorko korkolain mukaisesti.",
  "Tarjous on voimassa valitun ajan päiväyksestä.",
  "Mahdolliset erimielisyydet pyritään ratkaisemaan ensisijaisesti neuvottelemalla."
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
