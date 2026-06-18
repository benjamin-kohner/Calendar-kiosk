<script lang="ts">
  // Themeable inline-SVG weather icons (inherit `color` via currentColor),
  // replacing platform-inconsistent emoji. One glyph per WMO code group.
  let { code, isDay = true, size = '1em' }: { code: number; isDay?: boolean; size?: string } =
    $props();

  type Kind =
    | 'sun'
    | 'moon'
    | 'cloud-sun'
    | 'cloud-moon'
    | 'cloud'
    | 'fog'
    | 'drizzle'
    | 'rain'
    | 'sleet'
    | 'snow'
    | 'thunder';

  const kind = $derived<Kind>(classify(code, isDay));

  function classify(c: number, day: boolean): Kind {
    if (c === 0) return day ? 'sun' : 'moon';
    if (c === 1 || c === 2) return day ? 'cloud-sun' : 'cloud-moon';
    if (c === 3) return 'cloud';
    if (c === 45 || c === 48) return 'fog';
    if (c >= 51 && c <= 57) return 'drizzle';
    if ((c >= 61 && c <= 65) || (c >= 80 && c <= 82)) return 'rain';
    if (c === 66 || c === 67) return 'sleet';
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
    if (c >= 95) return 'thunder';
    return day ? 'sun' : 'moon';
  }
</script>

<svg
  class="wx-icon"
  style="width:{size};height:{size}"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.5"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if kind === 'sun'}
    <circle cx="12" cy="12" r="4.4" fill="currentColor" stroke="none" />
    <g>
      <line x1="12" y1="1.8" x2="12" y2="4.2" />
      <line x1="12" y1="19.8" x2="12" y2="22.2" />
      <line x1="1.8" y1="12" x2="4.2" y2="12" />
      <line x1="19.8" y1="12" x2="22.2" y2="12" />
      <line x1="4.9" y1="4.9" x2="6.6" y2="6.6" />
      <line x1="17.4" y1="17.4" x2="19.1" y2="19.1" />
      <line x1="4.9" y1="19.1" x2="6.6" y2="17.4" />
      <line x1="17.4" y1="6.6" x2="19.1" y2="4.9" />
    </g>
  {:else if kind === 'moon'}
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.4 6.4 0 0 0 10.5 10.5Z" fill="currentColor" stroke="none" />
  {:else if kind === 'cloud'}
    <path
      d="M7.2 19h9.3a4 4 0 0 0 .5-7.97 5.5 5.5 0 0 0-10.55-1.2A3.8 3.8 0 0 0 7.2 19Z"
      fill="currentColor"
      stroke="none"
      opacity="0.92"
    />
  {:else if kind === 'cloud-sun' || kind === 'cloud-moon'}
    {#if kind === 'cloud-sun'}
      <circle cx="8" cy="7.5" r="3" fill="currentColor" stroke="none" />
      <g opacity="0.9">
        <line x1="8" y1="1.6" x2="8" y2="3" />
        <line x1="2.2" y1="7.5" x2="3.6" y2="7.5" />
        <line x1="3.8" y1="3.3" x2="4.8" y2="4.3" />
        <line x1="12.2" y1="3.3" x2="11.2" y2="4.3" />
      </g>
    {:else}
      <path d="M11 6.4A4.2 4.2 0 1 1 6 2.3a3.4 3.4 0 0 0 5 4.1Z" fill="currentColor" stroke="none" />
    {/if}
    <path
      d="M8.4 20h8.1a3.6 3.6 0 0 0 .4-7.18 4.9 4.9 0 0 0-9.4-1A3.4 3.4 0 0 0 8.4 20Z"
      fill="currentColor"
      stroke="none"
    />
  {:else if kind === 'fog'}
    <path
      d="M7.4 13.5h9a3.6 3.6 0 0 0 .4-7.18 4.9 4.9 0 0 0-9.4-1A3.4 3.4 0 0 0 7.4 13.5Z"
      fill="currentColor"
      stroke="none"
      opacity="0.92"
    />
    <line x1="5" y1="17.5" x2="19" y2="17.5" opacity="0.8" />
    <line x1="7" y1="20.5" x2="17" y2="20.5" opacity="0.6" />
  {:else}
    <!-- precipitation types share a cloud + drops/flakes/bolt -->
    <path
      d="M7.4 15h9a3.6 3.6 0 0 0 .4-7.18 4.9 4.9 0 0 0-9.4-1A3.4 3.4 0 0 0 7.4 15Z"
      fill="currentColor"
      stroke="none"
      opacity="0.92"
    />
    {#if kind === 'drizzle'}
      <line x1="9" y1="18" x2="8.2" y2="20" />
      <line x1="14" y1="18" x2="13.2" y2="20" />
    {:else if kind === 'rain'}
      <line x1="8.5" y1="18" x2="7.5" y2="21" />
      <line x1="12" y1="18" x2="11" y2="21" />
      <line x1="15.5" y1="18" x2="14.5" y2="21" />
    {:else if kind === 'sleet'}
      <line x1="9" y1="18" x2="8.2" y2="20.5" />
      <circle cx="14" cy="19.6" r="0.9" fill="currentColor" stroke="none" />
    {:else if kind === 'snow'}
      <circle cx="9" cy="18.6" r="1" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="20.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="18.6" r="1" fill="currentColor" stroke="none" />
    {:else if kind === 'thunder'}
      <path d="M13 17l-3 4h2.4l-1 3 3.6-4.4H14.5L15.6 17Z" fill="currentColor" stroke="none" />
    {/if}
  {/if}
</svg>

<style>
  .wx-icon {
    display: inline-block;
    vertical-align: middle;
    flex: 0 0 auto;
  }
</style>
