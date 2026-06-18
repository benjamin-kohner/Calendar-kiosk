<script lang="ts">
  import { appData } from '../lib/data.svelte';
  import { clock } from '../lib/clock.svelte';

  // Recompute relative freshness on each clock tick.
  const label = $derived.by(() => {
    void clock.now; // reactive dependency
    if (appData.calStatus === 'auth') return { text: 'Reconnect Google', cls: 'auth' };
    if (appData.calStatus === 'loading' && !appData.calendar) return { text: 'Loading…', cls: 'dim' };
    if (!appData.lastCalSync) return { text: 'No data', cls: 'warn' };
    const mins = Math.floor((Date.now() - appData.lastCalSync) / 60000);
    if (appData.calStatus === 'offline') return { text: 'Offline', cls: 'warn' };
    if (mins <= 1) return { text: 'Updated now', cls: 'ok' };
    if (mins < 60) return { text: `Updated ${mins}m ago`, cls: mins > 20 ? 'warn' : 'ok' };
    const hrs = Math.floor(mins / 60);
    return { text: `Updated ${hrs}h ago`, cls: 'warn' };
  });
</script>

<span class="status {label.cls}" title="Calendar sync status">
  <span class="pip"></span>{label.text}
</span>

<style>
  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    color: var(--text-faint);
  }
  .pip {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-faint);
  }
  .ok .pip,
  .status.ok {
    color: var(--text-dim);
  }
  .ok .pip {
    background: var(--good);
  }
  .warn {
    color: var(--today);
  }
  .warn .pip {
    background: var(--today);
  }
  .auth {
    color: var(--danger);
  }
  .auth .pip {
    background: var(--danger);
  }
</style>
