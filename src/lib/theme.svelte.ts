import { settings, SETTINGS_EVENT } from './settings.svelte';

// Owns the <html data-theme>/<data-night> attributes. Picks a light theme by
// day and a dark theme by night, switching on the local sunrise/sunset times
// (sourced from the weather feed). Falls back to fixed hours until weather loads.
class ThemeController {
  private sunrise: Date | null = null;
  private sunset: Date | null = null;
  /** Exposed so views can reflect the current phase if needed. */
  isDay = $state(true);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener(SETTINGS_EVENT, () => this.apply());
    }
  }

  /** Update today's sunrise/sunset from the weather payload (local ISO strings). */
  setSolar(sunriseIso?: string, sunsetIso?: string) {
    this.sunrise = sunriseIso ? new Date(sunriseIso) : null;
    this.sunset = sunsetIso ? new Date(sunsetIso) : null;
    this.apply();
  }

  isDaytime(now = new Date()): boolean {
    if (this.sunrise && this.sunset && !isNaN(+this.sunrise) && !isNaN(+this.sunset)) {
      return now >= this.sunrise && now < this.sunset;
    }
    const h = now.getHours(); // fallback before weather is available
    return h >= 7 && h < 19;
  }

  apply(now = new Date()) {
    if (typeof document === 'undefined') return;
    const day = this.isDaytime(now);
    this.isDay = day;
    const theme =
      settings.themeMode === 'auto' ? (day ? settings.dayTheme : settings.nightTheme) : settings.manualTheme;
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    html.setAttribute('data-night', !day && settings.nightDim ? 'on' : 'off');
  }
}

export const themeController = new ThemeController();
