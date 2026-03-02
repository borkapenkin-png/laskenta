const STORAGE_KEY = 'rakenna_projects';
const PRESETS_KEY = 'rakenna_presets';
const SETTINGS_KEY = 'rakenna_settings';
const AUTOSAVE_KEY = 'rakenna_autosave';

// Schema version for future compatibility
const SCHEMA_VERSION = '2.0';

/**
 * Convert a File/Blob to base64 data URL
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Convert base64 data URL back to Blob
 */
export const base64ToBlob = (base64) => {
  try {
    const parts = base64.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (error) {
    console.error('Error converting base64 to blob:', error);
    return null;
  }
};

/**
 * Create a complete project data object for saving
 */
export const createProjectData = async (project, measurements, scale, pdfFile, currentPage, viewState = {}, settings = {}) => {
  let baseFileData = null;
  let baseFileName = null;
  let baseFileType = null;

  // Convert PDF file to base64 if exists
  if (pdfFile) {
    try {
      baseFileData = await fileToBase64(pdfFile);
      baseFileName = pdfFile.name;
      baseFileType = pdfFile.type;
    } catch (error) {
      console.error('Error converting PDF to base64:', error);
    }
  }

  return {
    // Schema version for compatibility
    schemaVersion: SCHEMA_VERSION,
    
    // Project metadata
    meta: {
      id: project.id || `project-${Date.now()}`,
      name: project.name || 'Nimetön projekti',
      createdAt: project.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    
    // Base file (PDF/image)
    baseFile: {
      data: baseFileData,
      name: baseFileName,
      type: baseFileType,
      pageIndex: currentPage || 1,
    },
    
    // Scale and calibration
    scale: scale ? {
      ratio: scale.ratio,
      pixelsPerMeter: scale.pixelsPerMeter,
      calibrationPoints: scale.calibrationPoints,
      realDistance: scale.realDistance,
    } : null,
    
    // All measurement objects
    objects: measurements.map(m => ({
      id: m.id,
      type: m.type,
      label: m.label,
      unit: m.unit,
      quantity: m.quantity,
      pricePerUnit: m.pricePerUnit,
      points: m.points,
      page: m.page || 1,
      // Wall-specific
      wallHeight: m.wallHeight,
      bothSides: m.bothSides,
      openings: m.openings,
      // Special type flags
      isPystykotelot: m.isPystykotelot,
      isKuivatilaRakennus: m.isKuivatilaRakennus,
      isPRHRakennus: m.isPRHRakennus,
      isKuivatilaAK: m.isKuivatilaAK,
      isMarkatilaAK: m.isMarkatilaAK,
      isPRHAK: m.isPRHAK,
      isKuivatilaPystykotelo: m.isKuivatilaPystykotelo,
      isPRHPystykotelo: m.isPRHPystykotelo,
      hasRankaKipsi: m.hasRankaKipsi,
      rankaType: m.rankaType,
      kipsiType: m.kipsiType,
      lagiPaneeli: m.lagiPaneeli,
      isCustom: m.isCustom,
      // Style properties
      color: m.color,
      strokeWidth: m.strokeWidth,
    })),
    
    // View state (zoom, pan position)
    viewState: {
      zoom: viewState.zoom || 1,
      panX: viewState.panX || 0,
      panY: viewState.panY || 0,
    },
    
    // Settings snapshot
    settings: {
      vatPercentage: settings.vatPercentage,
      defaultWallHeight: settings.defaultWallHeight,
    },
  };
};

/**
 * Parse loaded project data and extract components
 */
export const parseProjectData = (data) => {
  // Handle old schema versions
  if (!data.schemaVersion) {
    // Legacy format - convert to new format
    return {
      project: {
        id: data.id || `project-${Date.now()}`,
        name: data.name || 'Ladattu projekti',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      },
      measurements: data.measurements || [],
      scale: data.scale || null,
      baseFile: null,
      currentPage: 1,
      viewState: { zoom: 1, panX: 0, panY: 0 },
      settings: {},
      isLegacy: true,
    };
  }

  // New schema format
  return {
    project: {
      id: data.meta?.id || `project-${Date.now()}`,
      name: data.meta?.name || 'Ladattu projekti',
      createdAt: data.meta?.createdAt || new Date().toISOString(),
      updatedAt: data.meta?.updatedAt || new Date().toISOString(),
    },
    measurements: data.objects || [],
    scale: data.scale || null,
    baseFile: data.baseFile || null,
    currentPage: data.baseFile?.pageIndex || 1,
    viewState: data.viewState || { zoom: 1, panX: 0, panY: 0 },
    settings: data.settings || {},
    isLegacy: false,
  };
};

/**
 * Save project to localStorage (autosave)
 */
export const saveProject = (project) => {
  try {
    const projects = getProjects();
    const existingIndex = projects.findIndex(p => p.id === project.id);
    
    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.push(project);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return true;
  } catch (error) {
    console.error('Error saving project:', error);
    return false;
  }
};

/**
 * Save autosave data (without base64 file to avoid quota)
 */
export const saveAutosave = (project, measurements, scale, currentPage) => {
  try {
    const autosaveData = {
      schemaVersion: SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
      },
      measurements,
      scale,
      currentPage,
    };
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(autosaveData));
    return true;
  } catch (error) {
    console.error('Error saving autosave:', error);
    return false;
  }
};

/**
 * Load autosave data
 */
export const loadAutosave = () => {
  try {
    const data = localStorage.getItem(AUTOSAVE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error loading autosave:', error);
    return null;
  }
};

/**
 * Clear autosave
 */
export const clearAutosave = () => {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
    return true;
  } catch (error) {
    return false;
  }
};

export const getProjects = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading projects:', error);
    return [];
  }
};

export const deleteProject = (projectId) => {
  try {
    const projects = getProjects();
    const filtered = projects.filter(p => p.id !== projectId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    return false;
  }
};

export const savePresets = (presets) => {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    return true;
  } catch (error) {
    console.error('Error saving presets:', error);
    return false;
  }
};

export const getPresets = () => {
  try {
    const data = localStorage.getItem(PRESETS_KEY);
    return data ? JSON.parse(data) : getDefaultPresets();
  } catch (error) {
    console.error('Error loading presets:', error);
    return getDefaultPresets();
  }
};

export const saveSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
};

export const getSettings = () => {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : getDefaultSettings();
  } catch (error) {
    console.error('Error loading settings:', error);
    return getDefaultSettings();
  }
};

export const getDefaultSettings = () => ({
  hourlyRate: 45,
  vatPercentage: 25.5,
  defaultDoorArea: 2.1,
  defaultWindowArea: 1.5,
  defaultWallHeight: 2.6
});

export const getDefaultPresets = () => [
  {
    id: 'preset-1',
    name: 'Maalaus seinät 2x',
    category: 'Maalaus',
    subcategory: 'Seinät',
    unit: 'm²',
    waste: 5,
    layers: 2,
    productivity: 8,
    materialCost: 2.5,
    wallHeight: 2.6,
    bothSides: false
  },
  {
    id: 'preset-2',
    name: 'Maalaus katot 2x',
    category: 'Maalaus',
    subcategory: 'Katot',
    unit: 'm²',
    waste: 5,
    layers: 2,
    productivity: 6,
    materialCost: 3.0,
    wallHeight: null,
    bothSides: false
  },
  {
    id: 'preset-3',
    name: 'Ylitasoitus',
    category: 'Tasoitus',
    subcategory: 'Seinät',
    unit: 'm²',
    waste: 10,
    layers: 1,
    productivity: 5,
    materialCost: 4.0,
    wallHeight: 2.6,
    bothSides: false
  },
  {
    id: 'preset-4',
    name: 'Nauhoitus + metallikulmat',
    category: 'Tasoitus',
    subcategory: 'Seinät',
    unit: 'jm',
    waste: 5,
    layers: 1,
    productivity: 10,
    materialCost: 1.5,
    wallHeight: null,
    bothSides: false
  },
  {
    id: 'preset-5',
    name: 'Julkisivurappaus',
    category: 'Rappaus',
    subcategory: 'Julkisivu',
    unit: 'm²',
    waste: 15,
    layers: 1,
    productivity: 4,
    materialCost: 12.0,
    wallHeight: 3.0,
    bothSides: false
  }
];

/**
 * Export project to JSON file (with base64 PDF included)
 */
export const exportProjectToJSON = async (projectData) => {
  try {
    const dataStr = JSON.stringify(projectData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    const projectName = projectData.meta?.name || projectData.name || 'project';
    link.download = `${projectName.replace(/[^a-zA-Z0-9äöåÄÖÅ]/g, '_')}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Error exporting project:', error);
    return false;
  }
};

/**
 * Import project from JSON file
 */
export const importProjectFromJSON = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch (error) {
        reject(new Error('Virheellinen projektitiedosto'));
      }
    };
    reader.onerror = () => reject(new Error('Tiedoston lukeminen epäonnistui'));
    reader.readAsText(file);
  });
};

/**
 * Validate project data
 */
export const validateProjectData = (data) => {
  const errors = [];
  
  if (!data) {
    errors.push('Projektitiedosto on tyhjä');
    return { valid: false, errors };
  }
  
  // Check for measurements/objects
  const hasObjects = data.objects?.length > 0 || data.measurements?.length > 0;
  if (!hasObjects) {
    errors.push('Projektissa ei ole mittauksia');
  }
  
  // Check base file
  if (data.schemaVersion && !data.baseFile?.data) {
    errors.push('Pohjakuva puuttuu - PDF tarvitsee ladata erikseen');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: errors.filter(e => e.includes('puuttuu')),
  };
};

// ==========================================
// KOONTITARJOUS (Summary Offer) Functions
// ==========================================

const TARJOUS_SNAPSHOTS_KEY = 'rakenna_tarjous_snapshots';

/**
 * Save a tarjous snapshot to localStorage
 */
export const saveTarjousSnapshot = (snapshot) => {
  try {
    const snapshots = getTarjousSnapshots();
    const newSnapshot = {
      id: `tarjous-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...snapshot,
    };
    snapshots.push(newSnapshot);
    localStorage.setItem(TARJOUS_SNAPSHOTS_KEY, JSON.stringify(snapshots));
    return newSnapshot;
  } catch (error) {
    console.error('Error saving tarjous snapshot:', error);
    return null;
  }
};

/**
 * Get all tarjous snapshots from localStorage
 */
export const getTarjousSnapshots = () => {
  try {
    const data = localStorage.getItem(TARJOUS_SNAPSHOTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading tarjous snapshots:', error);
    return [];
  }
};

/**
 * Delete a tarjous snapshot by ID
 */
export const deleteTarjousSnapshot = (snapshotId) => {
  try {
    const snapshots = getTarjousSnapshots();
    const filtered = snapshots.filter(s => s.id !== snapshotId);
    localStorage.setItem(TARJOUS_SNAPSHOTS_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting tarjous snapshot:', error);
    return false;
  }
};

/**
 * Clear all tarjous snapshots
 */
export const clearTarjousSnapshots = () => {
  try {
    localStorage.removeItem(TARJOUS_SNAPSHOTS_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing tarjous snapshots:', error);
    return false;
  }
};
