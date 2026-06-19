<script lang="ts">
  import type { CalEvent } from '../lib/types';
  import { settings } from '../lib/settings.svelte';
  import { clock } from '../lib/clock.svelte';
  import { idle } from '../lib/idle.svelte';
  import { ui } from '../lib/ui.svelte';
  import { textOn } from '../lib/color';
  import {
    rollingGrid,
    weekdayLabels,
    dayKey,
    isToday,
    sameDay,
    addDays,
    eventsForDay,
    fmtMonthRange
  } from '../lib/date';
  import { layoutWeek, type WeekLayout } from '../lib/monthLayout';
  import DayRibbon from './DayRibbon.svelte';

  let { events }: { events: CalEvent[] } = $props();

  const WEEKS = 4; // current week + next 3
  const MAX_LANES = 4; // spanning-bar rows per week

  let offsetWeeks = $state(0);
  let selected = $state(new Date());
  let following = $state(true);

  function resetToToday() {
    offsetWeeks = 0;
    selected = new Date();
    following = true;
  }

  $effect(() => {
    void clock.dayKey;
    if (following && !sameDay(selected, new Date())) resetToToday();
  });

  $effect(() => {
    void idle.resetToken;
    if (idle.resetToken > 0) resetToToday();
  });

  const labels = $derived(weekdayLabels(settings.weekStartsMonday));

  interface Week {
    days: Date[];
    layout: WeekLayout | null;
    shownLanes: number;
  }

  const grid = $derived.by(() => {
    void clock.dayKey;
    const base = addDays(new Date(), offsetWeeks * 7);
    return rollingGrid(base, WEEKS, settings.weekStartsMonday);
  });

  const weeks = $derived.by<Week[]>(() => {
    const out: Week[] = [];
    for (let w = 0; w < WEEKS; w++) {
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

  const rangeLabel = $derived(fmtMonthRange(grid[0], grid[grid.length - 1]));

  function dotColors(day: Date): string[] {
    return eventsForDay(events, day)
      .slice(0, 4)
      .map((e) => e.color);
  }

  function pick(day: Date) {
    selected = day;
    following = isToday(day) && offsetWeeks === 0;
  }

  function shiftWeek(delta: number) {
    offsetWeeks += delta;
    following = false;
  }

  function openEvent(e: MouseEvent, ev: CalEvent) {
    e.stopPropagation();
    ui.openEvent(ev);
  }
</script>

<div class="month" class:bottom={settings.ribbonLayout === 'bottom'}>
  <section class="grid-wrap">
    <header class="mhead">
      <button class="nav" aria-label="Previous week" onclick={() => shiftWeek(-1)}>‹</button>
      <h2>{rangeLabel}</h2>
      {#if offsetWeeks !== 0}
        <button class="today-btn" onclick={resetToToday}>Today</button>
      {/if}
      <button class="nav" aria-label="Next week" onclick={() => shiftWeek(1)}>›</button>
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
                <button
                  class="bar"
                  class:cl={bar.continuesLeft}
                  class:cr={bar.continuesRight}
                  style="grid-column:{bar.colStart + 1} / span {bar.colSpan}; grid-row:{bar.lane +
                    1}; background:{bar.ev.color}; color:{textOn(bar.ev.color)}"
                  onclick={(e) => openEvent(e, bar.ev)}
                >
                  {bar.showTitle ? bar.ev.title || '(no title)' : ''}
                </button>
              {/each}
            </div>
          {/if}

          <div class="daygrid">
            {#each wk.days as day, i (dayKey(day))}
              <div
                class="cell"
                class:today={isToday(day)}
                class:sel={sameDay(day, selected)}
                role="button"
                tabindex="0"
                onclick={() => pick(day)}
                onkeydown={(e) => e.key === 'Enter' && pick(day)}
              >
                <span class="num">{day.getDate()}</span>
                {#if wk.shownLanes > 0}<span class="spacer"></span>{/if}

                {#if wk.layout}
                  <span class="singles">
                    {#each wk.layout.singles[i].slice(0, settings.maxPerDay) as ev (ev.id)}
                      <button
                        class="ev"
                        style="background:{ev.color}; color:{textOn(ev.color)}"
                        onclick={(e) => openEvent(e, ev)}
                      >
                        {ev.title || '(no title)'}
                      </button>
                    {/each}
                    {#if wk.layout.singles[i].length > settings.maxPerDay}
                      <span class="more">{wk.layout.singles[i].length - settings.maxPerDay} more</span>
                    {/if}
                  </span>
                {:else}
                  <span class="dots">
                    {#each dotColors(day) as c}<i style="background:{c}"></i>{/each}
                  </span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </section>

  <DayRibbon day={selected} events={events} />
</div>

<style>
  .month {
    display: grid;
    grid-template-columns: 1fr 272px;
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
    justify-content: center;
    gap: 8px;
    padding: 2px 4px 6px;
  }
  .mhead h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  .nav {
    font-size: 1.7rem;
    line-height: 1;
    color: var(--text-dim);
    padding: 0 10px;
  }
  .today-btn {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--accent);
    background: var(--accent-soft);
    padding: 4px 10px;
    border-radius: 999px;
  }

  .dow {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    font-size: 0.72rem;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 0 0 4px;
  }
  .dow span {
    text-align: center;
  }

  /* continuous hairline grid (no card cells, no gaps) */
  .weeks {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    border-top: 1px solid var(--surface-line);
    border-left: 1px solid var(--surface-line);
    border-radius: 8px;
    overflow: hidden;
  }
  .week {
    position: relative;
    flex: 1 1 0;
    min-height: 0;
  }
  .daygrid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    height: 100%;
  }
  .cell {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 3px 3px 2px;
    background: var(--bg-elev);
    color: var(--text);
    border-right: 1px solid var(--surface-line);
    border-bottom: 1px solid var(--surface-line);
    overflow: hidden;
    text-align: left;
    cursor: pointer;
  }
  .cell.sel {
    background: var(--accent-soft);
  }
  .num {
    font-size: 0.92rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    align-self: center;
    width: 1.7em;
    height: 1.7em;
    display: grid;
    place-items: center;
    border-radius: 50%;
    margin-bottom: 1px;
  }
  .cell.today .num {
    background: var(--accent);
    color: #fff;
    font-weight: 600;
  }

  /* reserve room so single-day pills start below the spanning-bar lanes */
  .spacer {
    flex: 0 0 auto;
    height: calc(var(--lanes) * 21px);
  }

  .singles {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }
  .ev {
    display: block;
    width: 100%;
    text-align: left;
    font-size: 0.76rem;
    font-weight: 600;
    line-height: 19px;
    height: 19px;
    padding: 0 6px;
    border-radius: 5px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: clip;
  }
  .more {
    font-size: 0.68rem;
    color: var(--text-faint);
    padding: 0 4px;
    margin-top: 1px;
  }

  /* spanning multi-day / all-day bars — same pill style, continuous across days */
  .bars {
    position: absolute;
    top: 30px;
    left: 0;
    right: 0;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-auto-rows: 19px;
    row-gap: 2px;
    z-index: 2;
  }
  .bar {
    height: 19px;
    line-height: 19px;
    font-size: 0.76rem;
    font-weight: 600;
    text-align: left;
    padding: 0 6px;
    border-radius: 5px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: clip;
  }
  .bar.cl {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  .bar.cr {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .dots {
    display: flex;
    gap: 3px;
    margin-top: 2px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .dots i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
  }
</style>
