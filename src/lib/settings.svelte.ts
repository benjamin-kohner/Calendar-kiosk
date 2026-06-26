import type { RibbonLayout } from './themes';

export interface WeatherLocation {
  lat: number;
  lon: number;
  label: string;
}

interface PersistedSettings {
  title: string;
  themeMode: 'auto' | 'manual';
  dayTheme: string;
  nightTheme: string;
  manualTheme: string;
  nightDim: boolean;
  ribbonLayout: RibbonLayout;
  units: 'imperial' | 'metric';
  weekStartsMonday: boolean;
  hiddenCalendars: string[];
  useDeviceLocation: boolean;
  weather: WeatherLocation | null; // manual override location
  showEventsInGrid: boolean;
}

const STORAGE_KEY = 'kiosk.settings.v1';
export const SETTINGS_EVENT = 'kiosk:settings';

const DEFAULTS: PersistedSettings = {
  title: 'Calendar',
  themeMode: 'auto',
  dayTheme: 'paper',
  nightTheme: 'midnight',
  manualTheme: 'midnight',
  nightDim: true,
  ribbonLayout: 'right',
  units: 'imperial',
  weekStartsMonday: false,
  hiddenCalendars: [],
  useDeviceLocation: true,
  weather: null,
  showEventsInGrid: true
};

function load(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore corrupt storage */
  }
  return { ...DEFAULTS };
}

class Settings {
  title = $state(DEFAULTS.title);
  themeMode = $state<'auto' | 'manual'>(DEFAULTS.themeMode);
  dayTheme = $state(DEFAULTS.dayTheme);
  nightTheme = $state(DEFAULTS.nightTheme);
  manualTheme = $state(DEFAULTS.manualTheme);
  nightDim = $state(DEFAULTS.nightDim);
  ribbonLayout = $state<RibbonLayout>(DEFAULTS.ribbonLayout);
  units = $state<'imperial' | 'metric'>(DEFAULTS.units);
  weekStartsMonday = $state(DEFAULTS.weekStartsMonday);
  hiddenCalendars = $state<string[]>(DEFAULTS.hiddenCalendars);
  useDeviceLocation = $state(DEFAULTS.useDeviceLocation);
  weather = $state<WeatherLocation | null>(DEFAULTS.weather);
  showEventsInGrid = $state(DEFAULTS.showEventsInGrid);

  constructor() {
    const s = load();
    this.title = s.title;
    this.themeMode = s.themeMode;
    this.dayTheme = s.dayTheme;
    this.nightTheme = s.nightTheme;
    this.manualTheme = s.manualTheme;
    this.nightDim = s.nightDim;
    this.ribbonLayout = s.ribbonLayout;
    this.units = s.units;
    this.weekStartsMonday = s.weekStartsMonday;
    this.hiddenCalendars = s.hiddenCalendars;
    this.useDeviceLocation = s.useDeviceLocation;
    this.weather = s.weather;
    this.showEventsInGrid = s.showEventsInGrid;
  }

  save() {
    const data: PersistedSettings = {
      title: this.title,
      themeMode: this.themeMode,
      dayTheme: this.dayTheme,
      nightTheme: this.nightTheme,
      manualTheme: this.manualTheme,
      nightDim: this.nightDim,
      ribbonLayout: this.ribbonLayout,
      units: this.units,
      weekStartsMonday: this.weekStartsMonday,
      hiddenCalendars: this.hiddenCalendars,
      useDeviceLocation: this.useDeviceLocation,
      weather: this.weather,
      showEventsInGrid: this.showEventsInGrid
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage full / disabled — non-fatal */
    }
    // Let the theme controller re-evaluate (decoupled, avoids import cycle).
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  }

  toggleCalendar(id: string) {
    this.hiddenCalendars = this.hiddenCalendars.includes(id)
      ? this.hiddenCalendars.filter((c) => c !== id)
      : [...this.hiddenCalendars, id];
    this.save();
  }
}

export const settings = new Settings();
