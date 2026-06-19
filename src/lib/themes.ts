export interface Theme {
  id: string;
  name: string;
  swatch: string; // representative accent for the picker
  bg: string;
  dark: boolean; // dark themes suit night; light themes suit day
}

export const THEMES: Theme[] = [
  { id: 'midnight', name: 'Midnight', swatch: '#5b8cff', bg: '#0f1319', dark: true },
  { id: 'graphite', name: 'Graphite', swatch: '#d4a373', bg: '#1a1a1d', dark: true },
  { id: 'forest', name: 'Forest', swatch: '#4ade80', bg: '#0c1410', dark: true },
  { id: 'dusk', name: 'Dusk', swatch: '#b794f6', bg: '#14101f', dark: true },
  { id: 'paper', name: 'Cloud', swatch: '#2f6feb', bg: '#eceff4', dark: false },
  { id: 'daylight', name: 'Daylight', swatch: '#2563eb', bg: '#e9eef6', dark: false }
];

export const DARK_THEMES = THEMES.filter((t) => t.dark);
export const LIGHT_THEMES = THEMES.filter((t) => !t.dark);

// Layout presets for the Month view ribbon placement.
export type RibbonLayout = 'right' | 'bottom';
export const RIBBON_LAYOUTS: { id: RibbonLayout; name: string }[] = [
  { id: 'right', name: 'Ribbon on right' },
  { id: 'bottom', name: 'Ribbon on bottom' }
];
