import presetDefaults from './presetDefaults.json';

const { toolPresets, maksueraPresets } = presetDefaults;

export const DEFAULT_TOOL_PRESETS = toolPresets;
export const DEFAULT_MAKSUERA_PRESETS = maksueraPresets;

export const createDefaultToolPresets = () => JSON.parse(JSON.stringify(DEFAULT_TOOL_PRESETS));
export const createDefaultMaksueraPresets = () => JSON.parse(JSON.stringify(DEFAULT_MAKSUERA_PRESETS));
