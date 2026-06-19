<script lang="ts">
  import type { CalEvent } from '../lib/types';
  import {
    fmtTime,
    isToday,
    startOfDay,
    addDays,
    eventStartDate,
    eventEndDate,
    eventsForDay,
    fmtWeekdayShortDate
  } from '../lib/date';
  import { clock } from '../lib/clock.svelte';
  import { ui } from '../lib/ui.svelte';

  let { day, events }: { day: Date; events: CalEvent[] } = $props();

  const MAX_EVENTS = 40; // upcoming events to render (the panel scrolls)
  const DAY_SCAN = 90; // look ahead this many days for events

  // Forward-looking agenda from the selected day: that day's events first
  // (even if empty), then each following day that has events, grouped by day.
  const groups = $derived.by(() => {
    void clock.dayKey; // refresh Today/Tomorrow labels on midnight rollover
    const start = startOfDay(day);
    const out: { key: string; day: Date; events: CalEvent[] }[] = [];
    let count = 0;
    for (let i = 0; i < DAY_SCAN && count < MAX_EVENTS; i++) {
      const d = addDays(start, i);
      const evs = eventsForDay(events, d);
      if (i === 0 || evs.length) {
        out.push({ key: d.toISOString(), day: d, events: evs });
        count += evs.length;
      }
    }
    return out;
  });

  function dayLabel(d: Date): string {
    if (isToday(d)) return 'Today';
    if (isToday(addDays(d, -1))) return 'Tomorrow';
    return fmtWeekdayShortDate(d);
  }

  function timeRange(ev: CalEvent): string {
    if (ev.allDay) return 'All day';
    return `${fmtTime(eventStartDate(ev))} – ${fmtTime(eventEndDate(ev))}`;
  }

  // First ~120 chars of the description, HTML stripped & whitespace collapsed.
  function descSnippet(ev: CalEvent): string | null {
    if (!ev.description) return null;
    const text = ev.description
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return null;
    return text.length > 120 ? text.slice(0, 120).trimEnd() + '…' : text;
  }
</script>

<aside class="ribbon">
  <div class="scroll list">
    {#each groups as g (g.key)}
      <div class="day-label" class:today={isToday(g.day)}>{dayLabel(g.day)}</div>
      {#if g.events.length === 0}
        <p class="empty">No events</p>
      {:else}
        {#each g.events as ev (ev.id)}
          <button class="item" onclick={() => ui.openEvent(ev)}>
            <span class="bar" style="background:{ev.color}"></span>
            <span class="body">
              <span class="t">{ev.title || '(no title)'}</span>
              <span class="time">{timeRange(ev)}</span>
              {#if ev.location}
                <span class="loc"><span class="ic">📍</span>{ev.location}</span>
              {/if}
              {#if descSnippet(ev)}
                <span class="desc">{descSnippet(ev)}</span>
              {/if}
            </span>
          </button>
        {/each}
      {/if}
    {/each}
  </div>
</aside>

<style>
  .ribbon {
    display: flex;
    flex-direction: column;
    background: var(--bg-elev);
    border-radius: var(--radius);
    padding: 4px 14px 14px;
    min-height: 0;
  }
  .list {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .day-label {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--bg-elev);
    font-size: 0.74rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-faint);
    padding: 10px 2px 5px;
    border-bottom: 1px solid var(--surface-line);
  }
  .day-label.today {
    color: var(--accent);
  }
  .empty {
    color: var(--text-faint);
    font-size: 0.9rem;
    margin: 8px 2px 4px;
  }
  .item {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    text-align: left;
    padding: 10px 2px;
    border-radius: 6px;
  }
  .item:not(:last-child) {
    border-bottom: 1px solid var(--surface-line);
  }
  .item:active {
    background: var(--bg-elev-2);
  }
  .bar {
    width: 4px;
    align-self: stretch;
    border-radius: 2px;
    flex: 0 0 auto;
    min-height: 2.4em;
  }
  .body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .t {
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .time {
    font-size: 0.82rem;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
  .loc {
    font-size: 0.82rem;
    color: var(--text-dim);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .loc .ic {
    margin-right: 3px;
    font-size: 0.75rem;
  }
  .desc {
    font-size: 0.8rem;
    color: var(--text-faint);
    line-height: 1.4;
    margin-top: 1px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
