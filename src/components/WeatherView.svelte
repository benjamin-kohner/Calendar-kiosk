<script lang="ts">
  import { appData } from '../lib/data.svelte';
  import { settings } from '../lib/settings.svelte';
  import { wxInfo } from '../lib/weatherCodes';
  import { fmtWeekday, fmtTime } from '../lib/date';
  import WeatherIcon from './WeatherIcon.svelte';

  const wx = $derived(appData.weather);
  const unit = $derived(settings.units === 'imperial' ? '°' : '°');
  const tempUnit = $derived(settings.units === 'imperial' ? '°F' : '°C');
  const speedUnit = $derived(settings.units === 'imperial' ? 'mph' : 'km/h');

  const round = (n: number) => Math.round(n);
  const hourLabel = (iso: string) =>
    new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(iso));
  const clockTime = (iso: string) => (iso ? fmtTime(new Date(iso)) : '');

  function uvLabel(uv: number): string {
    if (uv < 3) return 'Low';
    if (uv < 6) return 'Moderate';
    if (uv < 8) return 'High';
    if (uv < 11) return 'Very High';
    return 'Extreme';
  }

  // Temperature range across the visible week, for the forecast range-bars.
  const span = $derived.by(() => {
    const days = wx?.daily?.slice(0, 7) ?? [];
    if (!days.length) return { min: 0, max: 1 };
    const min = Math.min(...days.map((d) => d.tempMin));
    const max = Math.max(...days.map((d) => d.tempMax));
    return { min, max: max === min ? min + 1 : max };
  });

  const heroColor = $derived.by(() => {
    if (!wx) return 'var(--text-dim)';
    const c = wx.current.code;
    if (c <= 2) return wx.current.isDay ? '#f4b740' : '#c7d2e6';
    return 'var(--text-dim)';
  });
</script>

<div class="weather">
  {#if !wx}
    <p class="loading">Loading weather…</p>
  {:else}
    {@const c = wx.current}
    {@const today = wx.daily[0]}
    {@const info = wxInfo(c.code, c.isDay)}

    <!-- LEFT: hero current conditions -->
    <section class="hero">
      <div class="hero-icon" style="color:{heroColor}">
        <WeatherIcon code={c.code} isDay={c.isDay} size="5.5rem" />
      </div>
      <div class="temp">{round(c.temp)}{unit}</div>
      <div class="cond">{info.label}</div>
      <div class="loc">{wx.label}</div>

      <div class="hilo">
        {#if today}
          <span class="hi">H {round(today.tempMax)}{unit}</span>
          <span class="lo">L {round(today.tempMin)}{unit}</span>
        {/if}
        <span class="feels">Feels {round(c.apparent)}{unit}</span>
      </div>

      <div class="sun">
        {#if today}
          <span>↑ {clockTime(today.sunrise)}</span>
          <span>↓ {clockTime(today.sunset)}</span>
        {/if}
      </div>
    </section>

    <!-- RIGHT: hourly + multi-day -->
    <section class="right">
      <div class="hourly">
        {#each wx.hourly.slice(0, 8) as h (h.time)}
          <div class="hour">
            <div class="hl">{hourLabel(h.time)}</div>
            <div class="hi-ic"><WeatherIcon code={h.code} size="1.5rem" /></div>
            <div class="ht">{round(h.temp)}°</div>
            <div class="hp" class:on={h.precipProb >= 10}>
              {h.precipProb >= 10 ? round(h.precipProb) + '%' : ''}
            </div>
          </div>
        {/each}
      </div>

      <div class="stats-row">
        <span><b>{round(c.windSpeed)}</b> {speedUnit} wind</span>
        <span><b>{round(c.humidity)}%</b> humidity</span>
        {#if today}<span>UV <b>{round(today.uvMax)}</b> · {uvLabel(today.uvMax)}</span>{/if}
        <span class="units">{tempUnit}</span>
      </div>

      <div class="daily">
        {#each wx.daily.slice(0, 7) as d, i (d.date)}
          {@const left = ((d.tempMin - span.min) / (span.max - span.min)) * 100}
          {@const width = ((d.tempMax - d.tempMin) / (span.max - span.min)) * 100}
          <div class="day" class:today={i === 0}>
            <span class="dn">{i === 0 ? 'Today' : fmtWeekday(new Date(d.date + 'T12:00:00'))}</span>
            <span class="di"><WeatherIcon code={d.code} size="1.4rem" /></span>
            <span class="dpp">{d.precipProb >= 10 ? round(d.precipProb) + '%' : ''}</span>
            <span class="dlo">{round(d.tempMin)}°</span>
            <span class="track">
              <span class="fill" style="left:{left}%; width:{Math.max(width, 6)}%"></span>
            </span>
            <span class="dhi">{round(d.tempMax)}°</span>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .weather {
    display: grid;
    grid-template-columns: 38% 1fr;
    height: 100%;
    padding: 6px 18px 12px;
    gap: 18px;
  }
  .loading {
    grid-column: 1 / -1;
    margin: auto;
    color: var(--text-faint);
  }

  /* ---- hero ---- */
  .hero {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    border-right: 1px solid var(--surface-line);
    padding-right: 16px;
  }
  .hero-icon {
    margin-bottom: 2px;
  }
  .temp {
    font-size: 4.6rem;
    font-weight: 700;
    line-height: 0.95;
    font-variant-numeric: tabular-nums;
  }
  .cond {
    font-size: 1.25rem;
    color: var(--text-dim);
    margin-top: 4px;
  }
  .loc {
    font-size: 0.95rem;
    color: var(--text-faint);
    margin-top: 2px;
  }
  .hilo {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 14px;
    font-size: 1rem;
    font-variant-numeric: tabular-nums;
  }
  .hilo .lo {
    color: var(--text-dim);
  }
  .hilo .feels {
    color: var(--text-faint);
  }
  .sun {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    font-size: 0.85rem;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }

  /* ---- right ---- */
  .right {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .hourly {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 6px;
    flex: 0 0 auto;
  }
  .hour {
    text-align: center;
    background: var(--bg-elev);
    border-radius: var(--radius-sm);
    padding: 8px 0 6px;
  }
  .hl {
    font-size: 0.75rem;
    color: var(--text-dim);
  }
  .hi-ic {
    margin: 3px 0;
    color: var(--text);
  }
  .ht {
    font-weight: 600;
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }
  .hp {
    font-size: 0.68rem;
    color: var(--accent);
    min-height: 0.9em;
  }

  .stats-row {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    margin: 12px 2px;
    font-size: 0.85rem;
    color: var(--text-dim);
  }
  .stats-row b {
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .stats-row .units {
    margin-left: auto;
    color: var(--text-faint);
  }

  .daily {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
  }
  .day {
    display: grid;
    grid-template-columns: 3.4em 1.6em 2.4em 2em 1fr 2em;
    align-items: center;
    gap: 10px;
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }
  .day.today .dn {
    color: var(--accent);
    font-weight: 700;
  }
  .dn {
    color: var(--text-dim);
  }
  .di {
    text-align: center;
    color: var(--text);
  }
  .dpp {
    font-size: 0.72rem;
    color: var(--accent);
    text-align: right;
  }
  .dlo {
    color: var(--text-faint);
    text-align: right;
  }
  .track {
    position: relative;
    height: 6px;
    background: var(--surface-line);
    border-radius: 3px;
  }
  .fill {
    position: absolute;
    top: 0;
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, #6cb6ff, #ffd479);
  }
  .dhi {
    font-weight: 600;
    text-align: right;
  }
</style>
