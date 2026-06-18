import EmblaCarousel, { type EmblaOptionsType, type EmblaCarouselType } from 'embla-carousel';

interface EmblaActionParams {
  options?: EmblaOptionsType;
  onApi?: (api: EmblaCarouselType) => void;
  onSelect?: (index: number) => void;
}

// Svelte action: turns a node into an Embla carousel viewport.
export function embla(node: HTMLElement, params: EmblaActionParams = {}) {
  const api = EmblaCarousel(node, {
    loop: false,
    align: 'start',
    dragFree: false,
    duration: 22, // snappy, home-screen-like
    ...params.options
  });

  const handleSelect = () => params.onSelect?.(api.selectedScrollSnap());
  api.on('select', handleSelect);
  params.onApi?.(api);
  handleSelect();

  return {
    destroy() {
      api.off('select', handleSelect);
      api.destroy();
    }
  };
}
