<script lang="ts">
  import { onMount } from 'svelte';
  import type { EmblaCarouselType } from 'embla-carousel';
  import { embla } from './lib/embla';
  import { appData } from './lib/data.svelte';
  import { settings } from './lib/settings.svelte';
  import { clock } from './lib/clock.svelte';
  import { fmtTime } from './lib/date';
  import type { CalEvent } from './lib/types';

  import MonthView from './components/MonthView.svelte';
  import WeekView from './components/WeekView.svelte';
  import WeatherView from './components/WeatherView.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import SettingsPanel from './components/SettingsPanel.svelte';
  import AuthBanner from './components/AuthBanner.svelte';

  let api = $state<EmblaCarouselType | null>(null);
  let selected = $state(0);
  let settingsOpen = $state(false);

  const views = ['Month', 'Week', 'Weather'];

  // Visible (non-hidden) events for the calendar views.
  const visibleEvents = $derived<CalEvent[]>(
    (appData.calendar?.events ?? []).filter(
      (e) => !settings.hiddenCalendars.includes(e.calendarId)
    )
  );

  function goTo(i: number) {
    api?.scrollTo(i);
  }

  onMount(() => {
    appData.start();
  });
</script>

<div class="app">
  <header class="topbar">
    <div class="clock">{fmtTime(clock.now)}</div>
    <div class="title">{views[selected]}</div>
    <div class="right">
      <StatusBar />
      <button class="icon" aria-label="Settings" onclick={() => (settingsOpen = true)}>⚙︎</button>
    </div>
  </header>

  {#if appData.authNeeded}
    <AuthBanner />
  {/if}

  <div
    class="embla"
    use:embla={{ onApi: (a) => (api = a), onSelect: (i) => (selected = i) }}
  >
    <div class="embla__container">
      <div class="embla__slide"><MonthView events={visibleEvents} /></div>
      <div class="embla__slide"><WeekView events={visibleEvents} /></div>
      <div class="embla__slide"><WeatherView /></div>
    </div>
  </div>

  <nav class="dots" aria-label="Views">
    {#each views as v, i (v)}
      <button
        class="dot"
        class:active={selected === i}
        aria-label={v}
        aria-current={selected === i}
        onclick={() => goTo(i)}
      ></button>
    {/each}
  </nav>
</div>

{#if settingsOpen}
  <SettingsPanel onClose={() => (settingsOpen = false)} />
{/if}

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg);
  }

  .topbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 8px 16px;
    flex: 0 0 auto;
  }
  .clock {
    font-size: 1.5rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.5px;
  }
  .title {
    font-size: 0.95rem;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  .right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
  }
  .icon {
    font-size: 1.3rem;
    color: var(--text-dim);
    padding: 4px 8px;
    border-radius: var(--radius-sm);
  }
  .icon:active {
    background: var(--bg-elev);
  }

  .embla {
    flex: 1 1 auto;
    overflow: hidden;
    min-height: 0;
  }
  .embla__container {
    display: flex;
    height: 100%;
  }
  .embla__slide {
    flex: 0 0 100%;
    min-width: 0;
    height: 100%;
  }

  .dots {
    display: flex;
    justify-content: center;
    gap: 10px;
    padding: 10px 0 14px;
    flex: 0 0 auto;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--surface-line);
    transition: background 0.2s, transform 0.2s;
  }
  .dot.active {
    background: var(--accent);
    transform: scale(1.3);
  }
</style>
