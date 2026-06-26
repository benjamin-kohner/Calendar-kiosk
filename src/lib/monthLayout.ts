import type { CalEvent } from './types';
import { startOfDay, eventStartDate, eventEndDate, DAY_MS } from './date';

// Computes how to render events inside the month grid: multi-day / all-day
// events become horizontal "bars" that span columns (with lane stacking so
// overlapping bars don't collide), while single-day timed events are listed
// per day. Layout is done one week-row at a time so bars clip at week edges.

interface Coverage {
  startMs: number;
  endExclMs: number;
}

function coverage(ev: CalEvent): Coverage {
  const startMs = startOfDay(eventStartDate(ev)).getTime();
  if (ev.allDay) {
    let endExclMs = startOfDay(eventEndDate(ev)).getTime(); // end date is exclusive
    if (endExclMs <= startMs) endExclMs = startMs + DAY_MS;
    return { startMs, endExclMs };
  }
  const endDayMs = startOfDay(eventEndDate(ev)).getTime();
  return { startMs, endExclMs: endDayMs + DAY_MS }; // include the end day
}

/** True for events drawn as spanning bars (all-day, or covering >1 day). */
export function isBarEvent(ev: CalEvent): boolean {
  const c = coverage(ev);
  return ev.allDay || c.endExclMs - c.startMs > DAY_MS;
}

export interface Bar {
  ev: CalEvent;
  lane: number;
  colStart: number; // 0-6
  colSpan: number; // 1-7
  continuesLeft: boolean;
  continuesRight: boolean;
  showTitle: boolean;
}

export interface WeekLayout {
  bars: Bar[];
  laneCount: number;
  singles: CalEvent[][]; // indexed by day-of-week 0-6
}

export function layoutWeek(events: CalEvent[], weekDays: Date[]): WeekLayout {
  const weekStart = startOfDay(weekDays[0]).getTime();
  const weekEndExcl = startOfDay(weekDays[6]).getTime() + DAY_MS;

  const candidates = events
    .filter(isBarEvent)
    .map((ev) => ({ ev, c: coverage(ev) }))
    .filter(({ c }) => c.startMs < weekEndExcl && c.endExclMs > weekStart)
    .sort(
      (a, b) =>
        a.c.startMs - b.c.startMs || b.c.endExclMs - b.c.startMs - (a.c.endExclMs - a.c.startMs)
    );

  const bars: Bar[] = [];
  const laneEnds: number[] = []; // exclusive column index each lane is free after
  for (const { ev, c } of candidates) {
    const segStart = Math.max(c.startMs, weekStart);
    const segEndExcl = Math.min(c.endExclMs, weekEndExcl);
    const colStart = Math.round((segStart - weekStart) / DAY_MS);
    const colSpan = Math.max(1, Math.round((segEndExcl - segStart) / DAY_MS));

    let lane = laneEnds.findIndex((end) => end <= colStart);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = colStart + colSpan;

    bars.push({
      ev,
      lane,
      colStart,
      colSpan,
      continuesLeft: c.startMs < weekStart,
      continuesRight: c.endExclMs > weekEndExcl,
      showTitle: c.startMs >= weekStart || colStart === 0
    });
  }

  const singles: CalEvent[][] = weekDays.map(() => []);
  for (const ev of events) {
    if (isBarEvent(ev)) continue;
    const idx = Math.round((startOfDay(eventStartDate(ev)).getTime() - weekStart) / DAY_MS);
    if (idx >= 0 && idx < 7) singles[idx].push(ev);
  }
  for (const arr of singles) {
    arr.sort((a, b) => eventStartDate(a).getTime() - eventStartDate(b).getTime());
  }

  return { bars, laneCount: laneEnds.length, singles };
}

// Pixel sizes mirrored from MonthView's .ev / .more / .singles CSS, used to
// figure out how many single-day events actually fit in a day cell's
// measured height instead of capping at a fixed count.
const ITEM_H = 19;
const ITEM_GAP = 2;
const MORE_H = 16;

export interface DaySlots {
  shown: CalEvent[];
  overflow: number;
}

/** How many ITEM_H-tall rows (with ITEM_GAP between them) fit in `height`. */
function rowsThatFit(height: number): number {
  if (height <= 0) return 0;
  return Math.max(0, Math.floor((height + ITEM_GAP) / (ITEM_H + ITEM_GAP)));
}

/** Splits a day's single-events list into what fits in `availableHeight` px,
 * reserving room for a "+N more" label only when not everything fits. */
export function fitSingles(events: CalEvent[], availableHeight: number): DaySlots {
  const full = rowsThatFit(availableHeight);
  if (events.length <= full) return { shown: events, overflow: 0 };

  const itemCap = rowsThatFit(availableHeight - MORE_H - ITEM_GAP);
  return { shown: events.slice(0, itemCap), overflow: events.length - itemCap };
}
