const STORAGE_KEY = 'rakenna_projects';
const PRESETS_KEY = 'rakenna_presets';
const SETTINGS_KEY = 'rakenna_settings';

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

export const exportProjectToJSON = (project) => {
  const dataStr = JSON.stringify(project, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name || 'project'}_${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export const importProjectFromJSON = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const project = JSON.parse(e.target.result);
        resolve(project);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};