<script lang="ts">
  import { appData } from '../lib/data.svelte';
  import { settings } from '../lib/settings.svelte';
  import { wxInfo } from '../lib/weatherCodes';
  import { fmtWeekday } from '../lib/date';

  const wx = $derived(appData.weather);
  const unit = $derived(settings.units === 'imperial' ? '°F' : '°C');
  const speedUnit = $derived(settings.units === 'imperial' ? 'mph' : 'km/h');

  const round = (n: number) => Math.round(n);
  function hourLabel(iso: string): string {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(iso));
  }
</script>

<div class="weather">
  {#if !wx}
    <p class="loading">Loading weather…</p>
  {:else}
    {@const c = wx.current}
    {@const today = wx.daily[0]}
    {@const info = wxInfo(c.code, c.isDay)}
    <section class="hero">
      <div class="icon">{info.icon}</div>
      <div class="big">
        <div class="temp">{round(c.temp)}{unit}</div>
        <div class="cond">{info.label}</div>
        <div class="loc">{wx.label}</div>
      </div>
      <div class="stats">
        <div><span>Feels</span>{round(c.apparent)}{unit}</div>
        {#if today}<div><span>High</span>{round(today.tempMax)}{unit}</div>
        <div><span>Low</span>{round(today.tempMin)}{unit}</div>{/if}
        <div><span>Wind</span>{round(c.windSpeed)} {speedUnit}</div>
        <div><span>Humidity</span>{round(c.humidity)}%</div>
      </div>
    </section>

    <section class="scroll hourly">
      {#each wx.hourly.slice(0, 12) as h (h.time)}
        {@const hi = wxInfo(h.code)}
        <div class="hour">
          <div class="hl">{hourLabel(h.time)}</div>
          <div class="hi">{hi.icon}</div>
          <div class="ht">{round(h.temp)}°</div>
          {#if h.precipProb >= 10}<div class="pp">{round(h.precipProb)}%</div>{/if}
        </div>
      {/each}
    </section>

    <section class="daily">
      {#each wx.daily.slice(0, 7) as d, i (d.date)}
        {@const di = wxInfo(d.code)}
        <div class="day">
          <span class="dn">{i === 0 ? 'Today' : fmtWeekday(new Date(d.date + 'T12:00:00'))}</span>
          <span class="di">{di.icon}</span>
          {#if d.precipProb >= 10}<span class="dp">{round(d.precipProb)}%</span>{:else}<span class="dp"></span>{/if}
          <span class="dt"><b>{round(d.tempMax)}°</b> {round(d.tempMin)}°</span>
        </div>
      {/each}
    </section>
  {/if}
</div>

<style>
  .weather {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 4px 16px 8px;
    gap: 10px;
  }
  .loading {
    margin: auto;
    color: var(--text-faint);
  }
  .hero {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 16px;
    flex: 0 0 auto;
  }
  .icon {
    font-size: 3.4rem;
  }
  .temp {
    font-size: 3.2rem;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .cond {
    font-size: 1rem;
    color: var(--text-dim);
    margin-top: 2px;
  }
  .loc {
    font-size: 0.78rem;
    color: var(--text-faint);
  }
  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px 16px;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  .stats span {
    color: var(--text-faint);
    margin-right: 6px;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .hourly {
    display: flex;
    gap: 6px;
    flex: 0 0 auto;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .hour {
    flex: 0 0 auto;
    width: 52px;
    text-align: center;
    background: var(--bg-elev);
    border-radius: var(--radius-sm);
    padding: 7px 0;
  }
  .hl {
    font-size: 0.68rem;
    color: var(--text-dim);
  }
  .hi {
    font-size: 1.3rem;
    margin: 2px 0;
  }
  .ht {
    font-weight: 600;
    font-size: 0.85rem;
  }
  .pp {
    font-size: 0.62rem;
    color: var(--accent);
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
    grid-template-columns: 4em 1.6em 3em 1fr;
    align-items: center;
    gap: 10px;
    font-size: 0.9rem;
    padding: 2px 0;
  }
  .dn {
    color: var(--text-dim);
  }
  .di {
    font-size: 1.1rem;
    text-align: center;
  }
  .dp {
    font-size: 0.7rem;
    color: var(--accent);
    text-align: right;
  }
  .dt {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--text-faint);
  }
  .dt b {
    color: var(--text);
  }
</style>
