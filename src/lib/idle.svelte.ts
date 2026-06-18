// Tracks user inactivity and fires a reset signal so the wall display returns
// to its useful default (Month view, today) after a stray tap. This fixes the
// "ambient display silently stuck on an arbitrary future day" failure mode.
const IDLE_MS = 90_000;

class Idle {
  /** Increments once each time the idle threshold is crossed. Watch in $effect. */
  resetToken = $state(0);
  private last = Date.now();
  private fired = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const bump = () => {
        this.last = Date.now();
        this.fired = false;
      };
      for (const e of ['pointerdown', 'keydown', 'touchstart', 'wheel']) {
        window.addEventListener(e, bump, { passive: true });
      }
      setInterval(() => this.check(), 5_000);
    }
  }

  private check() {
    if (!this.fired && Date.now() - this.last > IDLE_MS) {
      this.fired = true;
      this.resetToken++;
    }
  }
}

export const idle = new Idle();
