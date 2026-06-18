import type { CalEvent } from './types';

export const DAY_MS = 86_400_000;

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

export function isToday(d: Date): boolean {
  return sameDay(d, new Date());
}

/** Monday/Sunday-aware start of the week containing `d`. */
export function startOfWeek(d: Date, weekStartsMonday: boolean): Date {
  const x = startOfDay(d);
  const dow = x.getDay(); // 0 = Sun
  const offset = weekStartsMonday ? (dow + 6) % 7 : dow;
  return addDays(x, -offset);
}

/** 6x7 grid of dates covering the month containing `d`. */
export function monthGrid(d: Date, weekStartsMonday: boolean): Date[] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const gridStart = startOfWeek(first, weekStartsMonday);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function weekdayLabels(weekStartsMonday: boolean): string[] {
  const base = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return weekStartsMonday ? [...base.slice(1), base[0]] : base;
}

// ---- Event parsing ----

/** Local Date for an event's start. All-day uses date-only (midnight local). */
export function eventStartDate(ev: CalEvent): Date {
  return ev.allDay ? new Date(ev.start + 'T00:00:00') : new Date(ev.start);
}

export function eventEndDate(ev: CalEvent): Date {
  return ev.allDay ? new Date(ev.end + 'T00:00:00') : new Date(ev.end);
}

/** Does the event touch the given calendar day? Handles multi-day spans. */
export function eventOnDay(ev: CalEvent, day: Date): boolean {
  const ds = startOfDay(day).getTime();
  const de = ds + DAY_MS;
  const s = eventStartDate(ev).getTime();
  // All-day end dates are exclusive in Google; timed ends are inclusive instants.
  const e = ev.allDay ? eventEndDate(ev).getTime() : eventEndDate(ev).getTime();
  return s < de && e > ds;
}

/** Events that touch `day`, sorted: all-day first, then by start time. */
export function eventsForDay(events: CalEvent[], day: Date): CalEvent[] {
  return events
    .filter((ev) => eventOnDay(ev, day))
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return eventStartDate(a).getTime() - eventStartDate(b).getTime();
    });
}

// ---- Formatting ----

const f = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, opts);

export const fmtTime = (d: Date) => f({ hour: 'numeric', minute: '2-digit' }).format(d);
export const fmtMonthYear = (d: Date) => f({ month: 'long', year: 'numeric' }).format(d);
export const fmtWeekday = (d: Date) => f({ weekday: 'short' }).format(d);
export const fmtWeekdayLong = (d: Date) => f({ weekday: 'long' }).format(d);
export const fmtDayMonth = (d: Date) => f({ day: 'numeric', month: 'short' }).format(d);
export const fmtFullDate = (d: Date) => f({ weekday: 'long', month: 'long', day: 'numeric' }).format(d);

export function fmtEventTime(ev: CalEvent): string {
  if (ev.allDay) return 'All day';
  return fmtTime(eventStartDate(ev));
}
