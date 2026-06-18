<script lang="ts">
  import { ui } from '../lib/ui.svelte';
  import { fmtFullDate, fmtTime, eventStartDate, eventEndDate, sameDay } from '../lib/date';

  const ev = $derived(ui.event);

  function when(): string {
    if (!ev) return '';
    const s = eventStartDate(ev);
    if (ev.allDay) {
      const e = eventEndDate(ev);
      const lastDay = new Date(e.getTime() - 1);
      if (sameDay(s, lastDay)) return `All day · ${fmtFullDate(s)}`;
      return `${fmtFullDate(s)} – ${fmtFullDate(lastDay)}`;
    }
    const e = eventEndDate(ev);
    const date = fmtFullDate(s);
    if (sameDay(s, e)) return `${date} · ${fmtTime(s)} – ${fmtTime(e)}`;
    return `${fmtTime(s)} ${date} – ${fmtTime(e)} ${fmtFullDate(e)}`;
  }
</script>

{#if ev}
  <div class="backdrop" onclick={() => ui.close()} role="presentation"></div>
  <div class="card" role="dialog" aria-label="Event details">
    <button class="x" aria-label="Close" onclick={() => ui.close()}>✕</button>
    <div class="accent" style="background:{ev.color}"></div>
    <h2>{ev.title || '(no title)'}</h2>
    <p class="when">{when()}</p>
    {#if ev.location}<p class="row"><span class="ic">📍</span>{ev.location}</p>{/if}
    {#if ev.calendarName}
      <p class="row"><span class="dot" style="background:{ev.color}"></span>{ev.calendarName}</p>
    {/if}
    {#if ev.description}<p class="desc">{ev.description}</p>{/if}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 50;
  }
  .card {
    position: fixed;
    z-index: 51;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(440px, 88vw);
    max-height: 80vh;
    overflow-y: auto;
    background: var(--bg-elev);
    border-radius: var(--radius);
    padding: 22px 24px;
    box-shadow: var(--shadow);
  }
  .accent {
    width: 40px;
    height: 5px;
    border-radius: 3px;
    margin-bottom: 12px;
  }
  .x {
    position: absolute;
    top: 12px;
    right: 14px;
    font-size: 1.1rem;
    color: var(--text-dim);
    padding: 4px 8px;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 1.4rem;
    font-weight: 700;
    line-height: 1.2;
  }
  .when {
    margin: 0 0 12px;
    color: var(--text);
    font-size: 1rem;
    font-variant-numeric: tabular-nums;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0;
    color: var(--text-dim);
    font-size: 0.95rem;
  }
  .ic {
    font-size: 0.9rem;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex: 0 0 auto;
  }
  .desc {
    margin: 14px 0 0;
    padding-top: 14px;
    border-top: 1px solid var(--surface-line);
    color: var(--text-dim);
    font-size: 0.92rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
