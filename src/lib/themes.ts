export interface Theme {
  id: string;
  name: string;
  swatch: string; // representative accent for the picker
  bg: string;
}

export const THEMES: Theme[] = [
  { id: 'midnight', name: 'Midnight', swatch: '#58a6ff', bg: '#0d1117' },
  { id: 'graphite', name: 'Graphite', swatch: '#d4a373', bg: '#1a1a1d' },
  { id: 'forest', name: 'Forest', swatch: '#4ade80', bg: '#0c1410' },
  { id: 'dusk', name: 'Dusk', swatch: '#b794f6', bg: '#14101f' },
  { id: 'paper', name: 'Paper', swatch: '#c2410c', bg: '#f5f2eb' }
];

// Layout presets for the Month view ribbon placement.
export type RibbonLayout = 'right' | 'bottom';
export const RIBBON_LAYOUTS: { id: RibbonLayout; name: string }[] = [
  { id: 'right', name: 'Ribbon on right' },
  { id: 'bottom', name: 'Ribbon on bottom' }
];
