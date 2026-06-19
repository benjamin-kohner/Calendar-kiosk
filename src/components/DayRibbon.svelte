<script lang="ts">
  import type { CalEvent } from '../lib/types';
  import {
    fmtFullDate,
    fmtTime,
    isToday,
    sameDay,
    eventStartDate,
    eventEndDate
  } from '../lib/date';
  import { clock } from '../lib/clock.svelte';
  import { ui } from '../lib/ui.svelte';

  let { day, events }: { day: Date; events: CalEvent[] } = $props();

  // For "today", surface the next upcoming timed event (a warm, useful default).
  const nextUp = $derived.by<CalEvent | null>(() => {
    if (!isToday(day)) return null;
    const n = clock.now.getTime();
    const future = events
      .filter((e) => !e.allDay && eventStartDate(e).getTime() > n)
      .sort((a, b) => eventStartDate(a).getTime() - eventStartDate(b).getTime());
    return future[0] ?? null;
  });

  function timeRange(ev: CalEvent): string {
    if (ev.allDay) return 'All day';
    const s = eventStartDate(ev);
    const e = eventEndDate(ev);
    return `${fmtTime(s)} – ${fmtTime(e)}`;
  }

  // First ~120 chars of the description, with HTML stripped and whitespace
  // collapsed (Google descriptions can contain markup).
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
  <header>
    <span class="lbl">{isToday(day) ? 'Today' : ''}</span>
    <h3>{fmtFullDate(day)}</h3>
  </header>

  {#if isToday(day)}
    <div class="upnext" class:free={!nextUp}>
      {#if nextUp}
        <span class="k">Next · {fmtTime(eventStartDate(nextUp))}</span>
        <span class="v">{nextUp.title || '(no title)'}</span>
      {:else}
        <span class="k">Nothing else scheduled today</span>
      {/if}
    </div>
  {/if}

  <div class="scroll list">
    {#if events.length === 0}
      <p class="empty">{isToday(day) ? 'No events today' : 'No events'}</p>
    {:else}
      {#each events as ev (ev.id)}
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
  </div>
</aside>

<style>
  .ribbon {
    display: flex;
    flex-direction: column;
    background: var(--bg-elev);
    border-radius: var(--radius);
    padding: 14px;
    min-height: 0;
  }
  header {
    flex: 0 0 auto;
  }
  .lbl {
    font-size: 0.74rem;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-weight: 700;
  }
  h3 {
    margin: 2px 0 0;
    font-size: 1.1rem;
    font-weight: 600;
  }
  .upnext {
    margin: 10px 0 4px;
    padding: 8px 10px;
    background: var(--accent-soft);
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .upnext.free {
    background: var(--bg-elev-2);
  }
  .upnext .k {
    font-size: 0.7rem;
    color: var(--accent);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .upnext.free .k {
    color: var(--text-faint);
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
  }
  .upnext .v {
    font-size: 0.95rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .list {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    margin-top: 6px;
  }
  .empty {
    color: var(--text-faint);
    font-size: 0.95rem;
    margin: 6px 2px;
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
    /* full title, wrapping up to two lines before truncating */
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
