<script lang="ts">
  import type { CalEvent } from '../lib/types';
  import { fmtFullDate, fmtEventTime, isToday } from '../lib/date';

  let { day, events }: { day: Date; events: CalEvent[] } = $props();
</script>

<aside class="ribbon">
  <header>
    <span class="lbl">{isToday(day) ? 'Today' : ''}</span>
    <h3>{fmtFullDate(day)}</h3>
  </header>

  <div class="scroll list">
    {#if events.length === 0}
      <p class="empty">No events</p>
    {:else}
      {#each events as ev (ev.id)}
        <div class="item">
          <span class="bar" style="background:{ev.color}"></span>
          <div class="body">
            <div class="t">{ev.title || '(no title)'}</div>
            <div class="meta">
              {fmtEventTime(ev)}{#if ev.location} · {ev.location}{/if}
            </div>
          </div>
        </div>
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
    padding: 12px;
    min-height: 0;
  }
  header {
    margin-bottom: 8px;
    flex: 0 0 auto;
  }
  .lbl {
    font-size: 0.7rem;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-weight: 700;
  }
  h3 {
    margin: 2px 0 0;
    font-size: 1rem;
    font-weight: 600;
  }
  .list {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .empty {
    color: var(--text-faint);
    font-size: 0.9rem;
    margin: 6px 2px;
  }
  .item {
    display: flex;
    gap: 9px;
    align-items: stretch;
  }
  .bar {
    width: 4px;
    border-radius: 2px;
    flex: 0 0 auto;
  }
  .body {
    min-width: 0;
  }
  .t {
    font-size: 0.92rem;
    font-weight: 600;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    font-size: 0.74rem;
    color: var(--text-dim);
    margin-top: 1px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
