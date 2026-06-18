<script lang="ts">
  import type { CalEvent } from '../lib/types';
  import { fmtFullDate, fmtEventTime, fmtTime, isToday, eventStartDate } from '../lib/date';
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
            <span class="meta">{fmtEventTime(ev)}{#if ev.location}{' · '}{ev.location}{/if}</span>
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
    gap: 8px;
    margin-top: 8px;
  }
  .empty {
    color: var(--text-faint);
    font-size: 0.95rem;
    margin: 6px 2px;
  }
  .item {
    display: flex;
    gap: 9px;
    align-items: stretch;
    text-align: left;
    padding: 2px;
    border-radius: 6px;
  }
  .item:active {
    background: var(--bg-elev-2);
  }
  .bar {
    width: 4px;
    border-radius: 2px;
    flex: 0 0 auto;
  }
  .body {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .t {
    font-size: 0.98rem;
    font-weight: 600;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    font-size: 0.8rem;
    color: var(--text-dim);
    margin-top: 1px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
