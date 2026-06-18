export interface CalendarMeta {
  id: string;
  summary: string;
  color: string;
}

export interface CalEvent {
  id: string;
  calendarId: string;
  title: string;
  start: string; // RFC3339 / ISO
  end: string; // RFC3339 / ISO
  allDay: boolean;
  location?: string;
  color: string;
}

export interface CalendarPayload {
  calendars: CalendarMeta[];
  events: CalEvent[];
  syncedAt: string;
  timeZone: string;
}

export interface WeatherCurrent {
  temp: number;
  apparent: number;
  code: number;
  isDay: boolean;
  windSpeed: number;
  humidity: number;
}

export interface WeatherHour {
  time: string;
  temp: number;
  code: number;
  precipProb: number;
}

export interface WeatherDay {
  date: string;
  tempMax: number;
  tempMin: number;
  code: number;
  precipProb: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherPayload {
  current: WeatherCurrent;
  hourly: WeatherHour[];
  daily: WeatherDay[];
  units: 'imperial' | 'metric';
  label: string;
  updatedAt: string;
}
