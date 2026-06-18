import type { CalendarPayload, WeatherPayload } from './types';
import { settings, type WeatherLocation } from './settings.svelte';
import { themeController } from './theme.svelte';

const CAL_CACHE = 'kiosk.cache.calendar.v1';
const WX_CACHE = 'kiosk.cache.weather.v1';
const GEO_CACHE = 'kiosk.cache.geo.v1';
const CAL_POLL_MS = 5 * 60 * 1000; // 5 min
const WX_POLL_MS = 15 * 60 * 1000; // 15 min

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

type Health = 'ok' | 'stale' | 'offline' | 'auth' | 'loading';

class AppData {
  calendar = $state<CalendarPayload | null>(readCache<CalendarPayload>(CAL_CACHE));
  weather = $state<WeatherPayload | null>(readCache<WeatherPayload>(WX_CACHE));
  calStatus = $state<Health>(this.calendar ? 'stale' : 'loading');
  wxStatus = $state<Health>(this.weather ? 'stale' : 'loading');
  lastCalSync = $state<number | null>(this.calendar ? Date.parse(this.calendar.syncedAt) : null);
  authNeeded = $state(false);
  detected = $state<{ lat: number; lon: number } | null>(
    readCache<{ lat: number; lon: number }>(GEO_CACHE)
  );
  geoStatus = $state<'idle' | 'locating' | 'ok' | 'denied' | 'unavailable'>('idle');

  start() {
    // Seed the theme controller from cached weather so first paint is correct.
    const d0 = this.weather?.daily?.[0];
    if (d0) themeController.setSolar(d0.sunrise, d0.sunset);

    this.detectLocation();
    this.refreshCalendar();
    this.refreshWeather();
    setInterval(() => this.refreshCalendar(), CAL_POLL_MS);
    setInterval(() => this.refreshWeather(), WX_POLL_MS);
    // Re-fetch when the tablet regains connectivity.
    window.addEventListener('online', () => {
      this.refreshCalendar();
      this.refreshWeather();
    });
  }

  /** Ask the device for its location (used for weather + sunrise/sunset). */
  detectLocation() {
    if (!settings.useDeviceLocation || !('geolocation' in navigator)) {
      if (!('geolocation' in navigator)) this.geoStatus = 'unavailable';
      return;
    }
    this.geoStatus = 'locating';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.detected = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        this.geoStatus = 'ok';
        writeCache(GEO_CACHE, this.detected);
        this.refreshWeather();
      },
      (err) => {
        this.geoStatus = err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable';
        // Fall back to manual/env location; weather still loads.
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 6 * 60 * 60 * 1000 }
    );
  }

  /** The location weather should use, honoring the device-location preference. */
  private resolveLocation(): WeatherLocation | null {
    if (settings.useDeviceLocation && this.detected) {
      return { lat: this.detected.lat, lon: this.detected.lon, label: 'Current location' };
    }
    return settings.weather; // manual override (or null -> backend env default)
  }

  async refreshCalendar() {
    try {
      const res = await fetch('/api/calendar', { cache: 'no-store' });
      if (res.status === 401 || res.status === 412) {
        this.authNeeded = true;
        this.calStatus = 'auth';
        return;
      }
      if (!res.ok) throw new Error(`calendar ${res.status}`);
      const data = (await res.json()) as CalendarPayload;
      this.calendar = data;
      this.lastCalSync = Date.parse(data.syncedAt);
      this.calStatus = 'ok';
      this.authNeeded = false;
      writeCache(CAL_CACHE, data);
    } catch {
      // Keep last-known data on screen; mark stale/offline.
      this.calStatus = this.calendar ? (navigator.onLine ? 'stale' : 'offline') : 'offline';
    }
  }

  async refreshWeather() {
    const loc = this.resolveLocation();
    const params = new URLSearchParams({ units: settings.units });
    if (loc) {
      params.set('lat', String(loc.lat));
      params.set('lon', String(loc.lon));
      params.set('label', loc.label);
    }
    try {
      const res = await fetch(`/api/weather?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`weather ${res.status}`);
      const data = (await res.json()) as WeatherPayload;
      this.weather = data;
      this.wxStatus = 'ok';
      writeCache(WX_CACHE, data);
      // Feed sunrise/sunset to the day/night theme switcher.
      const today = data.daily?.[0];
      if (today) themeController.setSolar(today.sunrise, today.sunset);
    } catch {
      this.wxStatus = this.weather ? 'stale' : 'offline';
    }
  }
}

export const appData = new AppData();
