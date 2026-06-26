<script lang="ts">
  import { settings } from '../lib/settings.svelte';
  import { appData } from '../lib/data.svelte';
  import { THEMES, DARK_THEMES, LIGHT_THEMES, RIBBON_LAYOUTS } from '../lib/themes';

  let { onClose }: { onClose: () => void } = $props();

  const calendars = $derived(appData.calendar?.calendars ?? []);

  let lat = $state(String(settings.weather?.lat ?? ''));
  let lon = $state(String(settings.weather?.lon ?? ''));
  let label = $state(settings.weather?.label ?? '');

  const geoText = $derived(
    {
      idle: 'Not requested yet',
      locating: 'Locating…',
      ok: 'Using device location ✓',
      denied: 'Permission denied — using manual/default',
      unavailable: 'Unavailable — using manual/default'
    }[appData.geoStatus]
  );

  function saveWeather() {
    const la = parseFloat(lat);
    const lo = parseFloat(lon);
    if (Number.isFinite(la) && Number.isFinite(lo)) {
      settings.weather = { lat: la, lon: lo, label: label || 'Home' };
      settings.save();
      appData.refreshWeather();
    }
  }

  function setUnits(u: 'imperial' | 'metric') {
    settings.units = u;
    settings.save();
    appData.refreshWeather();
  }

  function toggleDeviceLocation(on: boolean) {
    settings.useDeviceLocation = on;
    settings.save();
    if (on) appData.detectLocation();
    else appData.refreshWeather();
  }
</script>

<div class="backdrop" onclick={onClose} role="presentation"></div>
<div class="panel scroll" role="dialog" aria-label="Settings">
  <header>
    <h2>Settings</h2>
    <button class="x" aria-label="Close" onclick={onClose}>✕</button>
  </header>

  <section>
    <h3>Calendar title</h3>
    <input
      placeholder="e.g. Ben &amp; Kel's Calendar"
      bind:value={settings.title}
      onchange={() => settings.save()}
    />
  </section>

  <section>
    <h3>Theme</h3>
    <div class="seg">
      <button
        class:active={settings.themeMode === 'auto'}
        onclick={() => {
          settings.themeMode = 'auto';
          settings.save();
        }}>Auto day / night</button>
      <button
        class:active={settings.themeMode === 'manual'}
        onclick={() => {
          settings.themeMode = 'manual';
          settings.save();
        }}>Manual</button>
    </div>

    {#if settings.themeMode === 'auto'}
      <p class="hint">Switches automatically at local sunrise &amp; sunset.</p>
      <h4>Day theme</h4>
      <div class="themes">
        {#each LIGHT_THEMES as t (t.id)}
          <button
            class="swatch"
            class:active={settings.dayTheme === t.id}
            style="background:{t.bg};color:{t.swatch}"
            onclick={() => {
              settings.dayTheme = t.id;
              settings.save();
            }}>● <span>{t.name}</span></button>
        {/each}
      </div>
      <h4>Night theme</h4>
      <div class="themes">
        {#each DARK_THEMES as t (t.id)}
          <button
            class="swatch"
            class:active={settings.nightTheme === t.id}
            style="background:{t.bg};color:{t.swatch}"
            onclick={() => {
              settings.nightTheme = t.id;
              settings.save();
            }}>● <span>{t.name}</span></button>
        {/each}
      </div>
      <label class="row">
        <input
          type="checkbox"
          bind:checked={settings.nightDim}
          onchange={() => settings.save()}
        /> Dim screen further at night
      </label>
    {:else}
      <div class="themes">
        {#each THEMES as t (t.id)}
          <button
            class="swatch"
            class:active={settings.manualTheme === t.id}
            style="background:{t.bg};color:{t.swatch}"
            onclick={() => {
              settings.manualTheme = t.id;
              settings.save();
            }}>● <span>{t.name}</span></button>
        {/each}
      </div>
    {/if}
  </section>

  <section>
    <h3>Month view</h3>
    <label class="row">
      <input
        type="checkbox"
        bind:checked={settings.showEventsInGrid}
        onchange={() => settings.save()}
      /> Show events on the calendar grid
    </label>
    <h4>Agenda ribbon</h4>
    <div class="seg">
      {#each RIBBON_LAYOUTS as l (l.id)}
        <button
          class:active={settings.ribbonLayout === l.id}
          onclick={() => {
            settings.ribbonLayout = l.id;
            settings.save();
          }}>{l.name}</button>
      {/each}
    </div>
  </section>

  <section>
    <h3>Week starts</h3>
    <div class="seg">
      <button
        class:active={!settings.weekStartsMonday}
        onclick={() => {
          settings.weekStartsMonday = false;
          settings.save();
        }}>Sunday</button>
      <button
        class:active={settings.weekStartsMonday}
        onclick={() => {
          settings.weekStartsMonday = true;
          settings.save();
        }}>Monday</button>
    </div>
  </section>

  <section>
    <h3>Units</h3>
    <div class="seg">
      <button class:active={settings.units === 'imperial'} onclick={() => setUnits('imperial')}
        >°F / mph</button>
      <button class:active={settings.units === 'metric'} onclick={() => setUnits('metric')}
        >°C / km/h</button>
    </div>
  </section>

  {#if calendars.length}
    <section>
      <h3>Calendars</h3>
      <div class="cals">
        {#each calendars as c (c.id)}
          <button
            class="cal"
            class:off={settings.hiddenCalendars.includes(c.id)}
            onclick={() => settings.toggleCalendar(c.id)}
          >
            <i style="background:{c.color}"></i>
            <span>{c.summary}</span>
            <em>{settings.hiddenCalendars.includes(c.id) ? 'Hidden' : 'Shown'}</em>
          </button>
        {/each}
      </div>
    </section>
  {/if}

  <section>
    <h3>Weather location</h3>
    <label class="row">
      <input
        type="checkbox"
        bind:checked={settings.useDeviceLocation}
        onchange={(e) => toggleDeviceLocation(e.currentTarget.checked)}
      /> Use this device's location
    </label>
    <p class="hint">{geoText}</p>
    {#if !settings.useDeviceLocation}
      <div class="loc-fields">
        <input placeholder="Latitude" bind:value={lat} inputmode="decimal" />
        <input placeholder="Longitude" bind:value={lon} inputmode="decimal" />
        <input placeholder="Label (e.g. Home)" bind:value={label} />
        <button class="save" onclick={saveWeather}>Save location</button>
      </div>
    {/if}
  </section>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 40;
  }
  .panel {
    position: fixed;
    top: 0;
    right: 0;
    height: 100%;
    width: min(360px, 88vw);
    background: var(--bg-elev);
    z-index: 41;
    padding: 16px 18px 28px;
    box-shadow: var(--shadow);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  header h2 {
    margin: 0;
    font-size: 1.2rem;
  }
  .x {
    font-size: 1.1rem;
    color: var(--text-dim);
    padding: 6px 10px;
  }
  section {
    padding: 12px 0;
    border-top: 1px solid var(--surface-line);
  }
  h3 {
    margin: 0 0 8px;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--text-faint);
  }
  h4 {
    margin: 12px 0 6px;
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--text-dim);
  }
  .themes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .swatch {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    border-radius: var(--radius-sm);
    border: 2px solid transparent;
    font-size: 0.85rem;
  }
  .swatch span {
    color: var(--text);
    mix-blend-mode: difference;
  }
  .swatch.active {
    border-color: var(--accent);
  }
  .seg {
    display: flex;
    gap: 6px;
  }
  .seg button {
    flex: 1;
    padding: 9px;
    border-radius: var(--radius-sm);
    background: var(--bg-elev-2);
    color: var(--text-dim);
    font-size: 0.85rem;
  }
  .seg button.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }
  .cals {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cal {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: var(--bg-elev-2);
    text-align: left;
  }
  .cal i {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex: 0 0 auto;
  }
  .cal span {
    flex: 1;
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cal em {
    font-size: 0.68rem;
    color: var(--text-faint);
    font-style: normal;
  }
  .cal.off {
    opacity: 0.5;
  }
  .loc-fields {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin-top: 8px;
  }
  input {
    background: var(--bg-elev-2);
    border: 1px solid var(--surface-line);
    border-radius: var(--radius-sm);
    color: var(--text);
    padding: 9px 10px;
    font-size: 0.9rem;
    font-family: inherit;
    width: 100%;
  }
  input[type='checkbox'] {
    width: auto;
  }
  .save {
    background: var(--accent-soft);
    color: var(--accent);
    padding: 9px;
    border-radius: var(--radius-sm);
    font-weight: 600;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.9rem;
    margin-top: 10px;
  }
  .hint {
    font-size: 0.72rem;
    color: var(--text-faint);
    margin: 8px 0 0;
  }
</style>
