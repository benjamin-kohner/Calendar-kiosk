<script lang="ts">
  import type { CalEvent } from '../lib/types';
  import { settings } from '../lib/settings.svelte';
  import { clock } from '../lib/clock.svelte';
  import {
    monthGrid,
    weekdayLabels,
    dayKey,
    isToday,
    sameDay,
    eventsForDay,
    fmtMonthYear
  } from '../lib/date';
  import DayRibbon from './DayRibbon.svelte';

  let { events }: { events: CalEvent[] } = $props();

  // Anchor = any date within the displayed month. Selected = focused day.
  let anchor = $state(new Date());
  let selected = $state(new Date());

  // Reset to "today" when the date rolls over while idle.
  $effect(() => {
    void clock.dayKey;
    const now = new Date();
    if (!sameDay(selected, now) && wasAutoFollowing) {
      anchor = now;
      selected = now;
    }
  });
  let wasAutoFollowing = $state(true);

  const grid = $derived(monthGrid(anchor, settings.weekStartsMonday));
  const labels = $derived(weekdayLabels(settings.weekStartsMonday));
  const selectedEvents = $derived(eventsForDay(events, selected));

  function dotColors(day: Date): string[] {
    return eventsForDay(events, day)
      .slice(0, 4)
      .map((e) => e.color);
  }

  function pick(day: Date) {
    selected = day;
    wasAutoFollowing = isToday(day);
    if (day.getMonth() !== anchor.getMonth()) anchor = new Date(day);
  }

  function shiftMonth(delta: number) {
    anchor = new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
    wasAutoFollowing = false;
  }
</script>

<div class="month" class:bottom={settings.ribbonLayout === 'bottom'}>
  <section class="grid-wrap">
    <header class="mhead">
      <button class="nav" aria-label="Previous month" onclick={() => shiftMonth(-1)}>‹</button>
      <h2>{fmtMonthYear(anchor)}</h2>
      <button class="nav" aria-label="Next month" onclick={() => shiftMonth(1)}>›</button>
    </header>

    <div class="dow">
      {#each labels as l (l)}<span>{l}</span>{/each}
    </div>

    <div class="grid">
      {#each grid as day (dayKey(day))}
        {@const outside = day.getMonth() !== anchor.getMonth()}
        <button
          class="cell"
          class:outside
          class:today={isToday(day)}
          class:sel={sameDay(day, selected)}
          onclick={() => pick(day)}
        >
          <span class="num">{day.getDate()}</span>
          <span class="dots">
            {#each dotColors(day) as c}<i style="background:{c}"></i>{/each}
          </span>
        </button>
      {/each}
    </div>
  </section>

  <DayRibbon day={selected} events={selectedEvents} />
</div>

<style>
  .month {
    display: grid;
    grid-template-columns: 1fr 240px;
    height: 100%;
    gap: 10px;
    padding: 0 12px 8px;
  }
  .month.bottom {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }

  .grid-wrap {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .mhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 4px 6px;
  }
  .mhead h2 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 600;
  }
  .nav {
    font-size: 1.6rem;
    line-height: 1;
    color: var(--text-dim);
    padding: 0 10px;
    border-radius: var(--radius-sm);
  }
  .nav:active {
    background: var(--bg-elev);
  }

  .dow {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    font-size: 0.65rem;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 0 2px 4px;
  }
  .dow span {
    text-align: center;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-auto-rows: 1fr;
    gap: 3px;
    flex: 1 1 auto;
    min-height: 0;
  }
  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 4px 0 2px;
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
    color: var(--text);
    overflow: hidden;
  }
  .cell.outside {
    color: var(--text-faint);
    background: transparent;
  }
  .cell.today .num {
    background: var(--today);
    color: #1a1a1a;
  }
  .cell.sel {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .num {
    font-size: 0.9rem;
    font-weight: 600;
    width: 1.6em;
    height: 1.6em;
    display: grid;
    place-items: center;
    border-radius: 50%;
  }
  .dots {
    display: flex;
    gap: 3px;
    margin-top: 2px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .dots i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    display: inline-block;
  }
</style>
