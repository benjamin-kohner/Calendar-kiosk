<script lang="ts">
  import type { CalEvent } from '../lib/types';
  import { settings } from '../lib/settings.svelte';
  import { clock } from '../lib/clock.svelte';
  import {
    startOfWeek,
    addDays,
    dayKey,
    isToday,
    eventsForDay,
    fmtEventTime,
    fmtWeekday,
    fmtDayMonth
  } from '../lib/date';

  let { events }: { events: CalEvent[] } = $props();

  let offset = $state(0); // weeks from current

  // Follow date rollover when viewing the current week.
  $effect(() => {
    void clock.dayKey;
  });

  const days = $derived.by(() => {
    void clock.dayKey;
    const base = startOfWeek(addDays(new Date(), offset * 7), settings.weekStartsMonday);
    return Array.from({ length: 7 }, (_, i) => addDays(base, i));
  });

  const rangeLabel = $derived(`${fmtDayMonth(days[0])} – ${fmtDayMonth(days[6])}`);
</script>

<div class="week">
  <header class="whead">
    <button class="nav" aria-label="Previous week" onclick={() => (offset -= 1)}>‹</button>
    <h2>{rangeLabel}{#if offset === 0}<span class="now">This week</span>{/if}</h2>
    <button class="nav" aria-label="Next week" onclick={() => (offset += 1)}>›</button>
  </header>

  <div class="cols">
    {#each days as day (dayKey(day))}
      {@const evs = eventsForDay(events, day)}
      <div class="col" class:today={isToday(day)}>
        <div class="chead">
          <span class="dow">{fmtWeekday(day)}</span>
          <span class="dnum">{day.getDate()}</span>
        </div>
        <div class="scroll evs">
          {#each evs as ev (ev.id)}
            <div class="chip" style="border-left-color:{ev.color}">
              <span class="ct">{ev.title || '(no title)'}</span>
              <span class="cm">{fmtEventTime(ev)}</span>
            </div>
          {:else}
            <span class="none">·</span>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .week {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0 12px 8px;
  }
  .whead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 4px 8px;
  }
  .whead h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .now {
    font-size: 0.65rem;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }
  .nav {
    font-size: 1.6rem;
    line-height: 1;
    color: var(--text-dim);
    padding: 0 10px;
  }
  .nav:active {
    background: var(--bg-elev);
    border-radius: var(--radius-sm);
  }

  .cols {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    flex: 1 1 auto;
    min-height: 0;
  }
  .col {
    display: flex;
    flex-direction: column;
    background: var(--bg-elev);
    border-radius: var(--radius-sm);
    min-height: 0;
    overflow: hidden;
  }
  .col.today {
    outline: 2px solid var(--today);
    outline-offset: -2px;
  }
  .chead {
    text-align: center;
    padding: 5px 0 4px;
    border-bottom: 1px solid var(--surface-line);
    flex: 0 0 auto;
  }
  .dow {
    display: block;
    font-size: 0.6rem;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .dnum {
    font-size: 1rem;
    font-weight: 700;
  }
  .col.today .dnum {
    color: var(--today);
  }
  .evs {
    flex: 1 1 auto;
    min-height: 0;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .chip {
    background: var(--bg-elev-2);
    border-left: 3px solid var(--accent);
    border-radius: 4px;
    padding: 3px 4px;
    overflow: hidden;
  }
  .ct {
    display: block;
    font-size: 0.68rem;
    font-weight: 600;
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cm {
    font-size: 0.6rem;
    color: var(--text-dim);
  }
  .none {
    color: var(--text-faint);
    text-align: center;
    font-size: 0.8rem;
  }
</style>
