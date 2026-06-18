import { settings } from './settings.svelte';

// A single shared heartbeat. Drives the live clock, midnight rollover, and
// re-evaluates the night-dim window. Designed to run for months without drift:
// it reads Date.now() fresh each tick rather than counting intervals.
class Clock {
  now = $state(new Date());
  /** Day key (YYYY-MM-DD) — changes trigger reactive rollover in views. */
  dayKey = $state(toDayKey(new Date()));

  constructor() {
    // 15s cadence: smooth enough for a clock, cheap enough for 24/7.
    setInterval(() => this.tick(), 15_000);
  }

  private tick() {
    const d = new Date();
    this.now = d;
    const key = toDayKey(d);
    if (key !== this.dayKey) this.dayKey = key; // midnight rollover
    settings.applyToDocument(d); // re-check night dim window
  }
}

function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const clock = new Clock();
