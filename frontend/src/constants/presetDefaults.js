const DEFAULT_TOOL_PRESETS = {
  line: {
    groups: [
      {
        name: 'Kotelot',
        items: [
          { id: 'line-1', name: 'Kuivatila kotelot rakennus', price: 35, unit: 'jm', constructionType: 'kuivatilaKotelo', hasOptions: true },
          { id: 'line-2', name: 'Kuivatila kotelot tasoitus ja maalaus', price: 45, unit: 'jm' },
          { id: 'line-3', name: 'PRH Kotelo rakennus', price: 35, unit: 'jm', constructionType: 'prhKotelo', hasOptions: true },
        ]
      },
      {
        name: 'Sein?',
        items: [
          { id: 'line-seina-1', name: 'Kipsiotsa rakennus', price: 20, unit: 'jm', constructionType: 'kipsiotsa', hasOptions: true, isKipsiRakennus: true },
        ]
      },
    ]
  },
  wall: {
    groups: [
      {
        name: 'Maalaus ja tasoitus',
        items: [
          { id: 'wall-1', name: 'Huoltomaalaus', price: 10, unit: 'm?' },
          { id: 'wall-2', name: 'Kipsisein? tasoitus ja maalaus', price: 20, unit: 'm?' },
          { id: 'wall-3', name: 'Verkkotus, tasoitus ja maalaus', price: 30, unit: 'm?' },
          { id: 'wall-4', name: 'Tapetointi', price: 20, unit: 'm?' },
          { id: 'wall-5', name: 'Mikrotsementi', price: 85, unit: 'm?' },
        ]
      },
      {
        name: 'Sein? rakennus',
        items: [
          { id: 'wall-seina-1', name: 'Kipsisein? rakennus', price: 25, unit: 'm?', constructionType: 'kipsiseina', hasOptions: true, isKipsiRakennus: true },
        ]
      },
    ]
  },
  rectangle: {
    groups: [
      {
        name: 'Katto',
        items: [
          { id: 'rect-1', name: 'Kipsikatto tasoitus ja maalaus', price: 20, unit: 'm?' },
          { id: 'rect-2', name: 'MT Kipsikatto tasoitus ja maalaus', price: 40, unit: 'm?' },
          { id: 'rect-3', name: 'AK huoltomaalaus', price: 10, unit: 'm?' },
          { id: 'rect-4', name: 'Katto verkotus, tasoitus ja maalaus', price: 30, unit: 'm?' },
        ]
      },
      {
        name: 'Lattia',
        items: [
          { id: 'rect-5', name: 'P?lysidonta', price: 2.5, unit: 'm?' },
          { id: 'rect-6', name: 'Lattiamaalaus/lakkaus', price: 14, unit: 'm?' },
          { id: 'rect-7', name: 'Lattiapinnoitus', price: 45, unit: 'm?' },
        ]
      },
      {
        name: 'Alakatto rakennus',
        items: [
          { id: 'rect-8', name: 'Kuivatila AK rakennus', price: 35, unit: 'm?', constructionType: 'kuivatilaAK', hasOptions: true },
          { id: 'rect-9', name: 'M?rk?tila AK rakennus', price: 35, unit: 'm?', constructionType: 'markatilaAK', hasOptions: true },
          { id: 'rect-10', name: 'PRH AK rakennus', price: 35, unit: 'm?', constructionType: 'prhAK', hasOptions: true },
        ]
      },
    ]
  },
  polygon: {
    groups: [
      {
        name: 'Katto',
        items: [
          { id: 'poly-1', name: 'Kipsikatto tasoitus ja maalaus', price: 20, unit: 'm?' },
          { id: 'poly-2', name: 'MT Kipsikatto tasoitus ja maalaus', price: 40, unit: 'm?' },
          { id: 'poly-3', name: 'AK huoltomaalaus', price: 10, unit: 'm?' },
          { id: 'poly-4', name: 'Katto verkotus, tasoitus ja maalaus', price: 30, unit: 'm?' },
        ]
      },
      {
        name: 'Lattia',
        items: [
          { id: 'poly-5', name: 'P?lysidonta', price: 2.5, unit: 'm?' },
          { id: 'poly-6', name: 'Lattiamaalaus/lakkaus', price: 14, unit: 'm?' },
          { id: 'poly-7', name: 'Lattiapinnoitus', price: 45, unit: 'm?' },
        ]
      },
      {
        name: 'Alakatto rakennus',
        items: [
          { id: 'poly-8', name: 'Kuivatila AK rakennus', price: 35, unit: 'm?', constructionType: 'kuivatilaAK', hasOptions: true },
          { id: 'poly-9', name: 'M?rk?tila AK rakennus', price: 35, unit: 'm?', constructionType: 'markatilaAK', hasOptions: true },
          { id: 'poly-10', name: 'PRH AK rakennus', price: 35, unit: 'm?', constructionType: 'prhAK', hasOptions: true },
        ]
      },
    ]
  },
  count: {
    groups: [
      {
        name: 'Ovet ja ikkunat',
        items: [
          { id: 'count-1', name: 'Oven maalaus yhelt? puolelta', price: 90, unit: 'kpl' },
          { id: 'count-1b', name: 'Oven maalaus molemmilta puolelta', price: 180, unit: 'kpl' },
          { id: 'count-2', name: 'Sis?ikkuna sis?puolelta', price: 70, unit: 'kpl' },
          { id: 'count-2b', name: 'Sis?ikkuna molemmilta puolelta', price: 140, unit: 'kpl' },
          { id: 'count-2c', name: 'Sis? molemmin puolelta ja ulkoikkuna sis?puolelta', price: 240, unit: 'kpl' },
        ]
      },
      {
        name: 'Pystykotelot rakennus',
        items: [
          { id: 'count-3', name: 'Kuivatila pystykotelo rakennus', price: 35, unit: 'kpl', constructionType: 'kuivatilaPystykotelo', hasOptions: true },
          { id: 'count-4', name: 'PRH pystykotelo rakennus', price: 35, unit: 'kpl', constructionType: 'prhPystykotelo', hasOptions: true },
          { id: 'count-5', name: 'Pystykotelot tasoitus ja maalaus', price: 45, unit: 'kpl', isPystykotelot: true },
        ]
      },
    ]
  }
};

const DEFAULT_MAKSUERA_PRESETS = [
  {
    id: 'yse-6',
    name: 'YSE-6 (balanced)',
    isDefault: false,
    rows: [
      { selite: 'Ty?maan k?ynnistys', percent: 10 },
      { selite: 'Valmistelut', percent: 15 },
      { selite: 'Pohjaty?t', percent: 20 },
      { selite: 'Pintaty?t', percent: 25 },
      { selite: 'Viimeistely', percent: 20 },
      { selite: 'Luovutus / virheet korjattu', percent: 10 },
    ]
  },
  {
    id: 'yse-8',
    name: 'YSE-8 (detailed)',
    isDefault: false,
    rows: [
      { selite: 'Aloitus', percent: 10 },
      { selite: 'Suojaukset', percent: 12 },
      { selite: 'Tasoitusvaihe 1', percent: 13 },
      { selite: 'Tasoitusvaihe 2', percent: 13 },
      { selite: 'Pohjamaalaus', percent: 14 },
      { selite: 'Pintamaalaus', percent: 14 },
      { selite: 'Viimeistely', percent: 14 },
      { selite: 'Vastaanotto', percent: 10 },
    ]
  }
];

export const createDefaultToolPresets = () => JSON.parse(JSON.stringify(DEFAULT_TOOL_PRESETS));
export const createDefaultMaksueraPresets = () => JSON.parse(JSON.stringify(DEFAULT_MAKSUERA_PRESETS));
export { DEFAULT_TOOL_PRESETS, DEFAULT_MAKSUERA_PRESETS };
