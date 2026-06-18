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
    fmtMonthYear,
    fmtTimeShort,
    eventStartDate
  } from '../lib/date';
  import { layoutWeek, type WeekLayout } from '../lib/monthLayout';
  import DayRibbon from './DayRibbon.svelte';

  let { events }: { events: CalEvent[] } = $props();

  const MAX_LANES = 3; // cap spanning-bar rows per week on the small screen

  let anchor = $state(new Date());
  let selected = $state(new Date());
  let wasAutoFollowing = $state(true);

  // Reset to "today" when the date rolls over while idle on the current day.
  $effect(() => {
    void clock.dayKey;
    const now = new Date();
    if (!sameDay(selected, now) && wasAutoFollowing) {
      anchor = now;
      selected = now;
    }
  });

  const labels = $derived(weekdayLabels(settings.weekStartsMonday));
  const selectedEvents = $derived(eventsForDay(events, selected));

  interface Week {
    days: Date[];
    layout: WeekLayout | null;
    shownLanes: number;
  }

  const weeks = $derived.by<Week[]>(() => {
    const grid = monthGrid(anchor, settings.weekStartsMonday);
    const out: Week[] = [];
    for (let w = 0; w < 6; w++) {
      const days = grid.slice(w * 7, w * 7 + 7);
      if (settings.showEventsInGrid) {
        const layout = layoutWeek(events, days);
        out.push({ days, layout, shownLanes: Math.min(layout.laneCount, MAX_LANES) });
      } else {
        out.push({ days, layout: null, shownLanes: 0 });
      }
    }
    return out;
  });

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

    <div class="weeks">
      {#each weeks as wk, wi (wi)}
        <div class="week" style="--lanes:{wk.shownLanes}">
          {#if wk.layout}
            <div class="bars">
              {#each wk.layout.bars.filter((b) => b.lane < MAX_LANES) as bar (bar.ev.id)}
                <div
                  class="bar"
                  class:cl={bar.continuesLeft}
                  class:cr={bar.continuesRight}
                  style="grid-column:{bar.colStart + 1} / span {bar.colSpan}; grid-row:{bar.lane +
                    1}; background:{bar.ev.color}"
                >
                  {bar.showTitle ? bar.ev.title || '(no title)' : ''}
                </div>
              {/each}
            </div>
          {/if}

          <div class="daygrid">
            {#each wk.days as day, i (dayKey(day))}
              {@const outside = day.getMonth() !== anchor.getMonth()}
              <button
                class="cell"
                class:outside
                class:today={isToday(day)}
                class:sel={sameDay(day, selected)}
                onclick={() => pick(day)}
              >
                <span class="num">{day.getDate()}</span>
                {#if wk.shownLanes > 0}<span class="spacer"></span>{/if}

                {#if wk.layout}
                  <span class="singles">
                    {#each wk.layout.singles[i].slice(0, settings.maxPerDay) as ev (ev.id)}
                      <span class="ev">
                        <i style="background:{ev.color}"></i>
                        <b>{fmtTimeShort(eventStartDate(ev))}</b>
                        <span class="evt">{ev.title || '(no title)'}</span>
                      </span>
                    {/each}
                    {#if wk.layout.singles[i].length > settings.maxPerDay}
                      <span class="more">+{wk.layout.singles[i].length - settings.maxPerDay} more</span>
                    {/if}
                  </span>
                {:else}
                  <span class="dots">
                    {#each dotColors(day) as c}<i style="background:{c}"></i>{/each}
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        </div>
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

  .weeks {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1 1 auto;
    min-height: 0;
  }
  .week {
    position: relative;
    flex: 1 1 0;
    min-height: 0;
  }
  .daygrid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
    height: 100%;
  }
  .cell {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 3px 4px 2px;
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
    color: var(--text);
    overflow: hidden;
    text-align: left;
  }
  .cell.outside {
    color: var(--text-faint);
    background: transparent;
  }
  .num {
    font-size: 0.78rem;
    font-weight: 600;
    align-self: flex-start;
    min-width: 1.5em;
    height: 1.5em;
    display: grid;
    place-items: center;
    border-radius: 50%;
  }
  .cell.today .num {
    background: var(--today);
    color: #1a1a1a;
  }
  .cell.sel {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  /* reserve vertical room so per-day singles start below the bar lanes */
  .spacer {
    flex: 0 0 auto;
    height: calc(var(--lanes) * 16px);
  }

  .singles {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }
  .ev {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 0.62rem;
    line-height: 1.25;
    white-space: nowrap;
  }
  .ev i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex: 0 0 auto;
  }
  .ev b {
    color: var(--text-dim);
    font-weight: 600;
    flex: 0 0 auto;
  }
  .ev .evt {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .more {
    font-size: 0.58rem;
    color: var(--text-faint);
    margin-top: 1px;
  }

  /* spanning multi-day / all-day bars, overlaid above the day cells */
  .bars {
    position: absolute;
    top: 22px;
    left: 0;
    right: 0;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
    grid-auto-rows: 14px;
    row-gap: 2px;
    pointer-events: none;
    z-index: 2;
  }
  .bar {
    margin: 0 3px;
    height: 14px;
    border-radius: 7px;
    font-size: 0.6rem;
    line-height: 14px;
    color: #fff;
    padding: 0 6px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);
  }
  .bar.cl {
    margin-left: 0;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  .bar.cr {
    margin-right: 0;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .dots {
    display: flex;
    gap: 3px;
    margin-top: 2px;
    flex-wrap: wrap;
  }
  .dots i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    display: inline-block;
  }
</style>
