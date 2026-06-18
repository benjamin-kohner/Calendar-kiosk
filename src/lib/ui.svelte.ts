import type { CalEvent } from './types';

// Small global UI state: the currently-open event-detail popover.
class UI {
  event = $state<CalEvent | null>(null);

  openEvent(ev: CalEvent) {
    this.event = ev;
  }

  close() {
    this.event = null;
  }
}

export const ui = new UI();
