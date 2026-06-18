import type { RibbonLayout } from './themes';

export interface WeatherLocation {
  lat: number;
  lon: number;
  label: string;
}

export interface NightWindow {
  enabled: boolean;
  startHour: number; // 0-23, dim begins
  endHour: number; // 0-23, dim ends
}

interface PersistedSettings {
  theme: string;
  ribbonLayout: RibbonLayout;
  units: 'imperial' | 'metric';
  weekStartsMonday: boolean;
  hiddenCalendars: string[];
  weather: WeatherLocation | null;
  night: NightWindow;
}

const STORAGE_KEY = 'kiosk.settings.v1';

const DEFAULTS: PersistedSettings = {
  theme: 'midnight',
  ribbonLayout: 'right',
  units: 'imperial',
  weekStartsMonday: false,
  hiddenCalendars: [],
  weather: null,
  night: { enabled: true, startHour: 22, endHour: 7 }
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
  theme = $state(DEFAULTS.theme);
  ribbonLayout = $state<RibbonLayout>(DEFAULTS.ribbonLayout);
  units = $state<'imperial' | 'metric'>(DEFAULTS.units);
  weekStartsMonday = $state(DEFAULTS.weekStartsMonday);
  hiddenCalendars = $state<string[]>(DEFAULTS.hiddenCalendars);
  weather = $state<WeatherLocation | null>(DEFAULTS.weather);
  night = $state<NightWindow>(DEFAULTS.night);

  constructor() {
    const s = load();
    this.theme = s.theme;
    this.ribbonLayout = s.ribbonLayout;
    this.units = s.units;
    this.weekStartsMonday = s.weekStartsMonday;
    this.hiddenCalendars = s.hiddenCalendars;
    this.weather = s.weather;
    this.night = s.night;
  }

  save() {
    const data: PersistedSettings = {
      theme: this.theme,
      ribbonLayout: this.ribbonLayout,
      units: this.units,
      weekStartsMonday: this.weekStartsMonday,
      hiddenCalendars: this.hiddenCalendars,
      weather: this.weather,
      night: this.night
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage full / disabled — non-fatal */
    }
    this.applyToDocument();
  }

  setTheme(id: string) {
    this.theme = id;
    this.save();
  }

  toggleCalendar(id: string) {
    this.hiddenCalendars = this.hiddenCalendars.includes(id)
      ? this.hiddenCalendars.filter((c) => c !== id)
      : [...this.hiddenCalendars, id];
    this.save();
  }

  isNightNow(now = new Date()): boolean {
    if (!this.night.enabled) return false;
    const h = now.getHours();
    const { startHour, endHour } = this.night;
    // window may wrap past midnight (e.g. 22 -> 7)
    return startHour <= endHour ? h >= startHour && h < endHour : h >= startHour || h < endHour;
  }

  applyToDocument(now = new Date()) {
    const html = document.documentElement;
    html.setAttribute('data-theme', this.theme);
    html.setAttribute('data-night', this.isNightNow(now) ? 'on' : 'off');
  }
}

export const settings = new Settings();
