import type { ScrollConfig, ThemeColors } from '../types';

/**
 * Manages horizontal scrolling of the spectrogram viewport.
 *
 * - Auto-scroll: keeps the cursor visible during playback.
 * - Auto-center: re-centers the view on the cursor with smooth lerp.
 * - Programmatic `scrollToTime()` with smooth animation.
 */
export class ScrollManager {
  autoScroll: boolean;
  autoCenter: boolean;
  private isUserScrolling = false;
  private userScrollTimer: ReturnType<typeof setTimeout> | null = null;
  private isProgrammaticScroll = false;
  private lerpTarget: number | null = null;

  constructor(
    private viewport: HTMLElement,
    config: ScrollConfig | undefined,
    private theme: ThemeColors,
  ) {
    this.autoScroll = config?.autoScroll !== false;
    this.autoCenter = config?.autoCenter !== false;
    this.applyScrollbarStyles();
    this.viewport.addEventListener('scroll', this.onUserScroll, { passive: true });
  }

  private applyScrollbarStyles(): void {
    Object.assign(this.viewport.style, {
      scrollbarWidth: 'thin',
      scrollbarColor: `${this.theme.scrollbarThumb} ${this.theme.scrollbarTrack}`,
    });
  }

  /**
   * Called on every rAF tick to keep the cursor in view during playback.
   * Uses linear interpolation for butter-smooth auto-center.
   */
  followCursor(cursorX: number, isPlaying: boolean): void {
    if (!isPlaying || this.isUserScrolling) {
      this.lerpTarget = null;
      return;
    }

    const vw = this.viewport.clientWidth;

    if (this.autoCenter) {
      const target = cursorX - vw / 2;
      this.lerpTarget = target;
      const current = this.viewport.scrollLeft;
      const diff = target - current;

      if (Math.abs(diff) < 0.5) return;

      // Lerp factor: higher = snappier, lower = smoother.
      // 0.12 gives ~8 frames to converge — smooth but responsive.
      const next = current + diff * 0.12;
      this.setScrollLeft(next);
    } else if (this.autoScroll) {
      const sl = this.viewport.scrollLeft;
      const rightEdge = sl + vw;
      const margin = vw * 0.1;
      if (cursorX > rightEdge - margin || cursorX < sl) {
        this.setScrollLeft(cursorX - margin);
      }
    }
  }

  /**
   * Set scrollLeft without triggering user-scroll detection.
   */
  private setScrollLeft(value: number): void {
    this.isProgrammaticScroll = true;
    this.viewport.scrollLeft = value;
  }

  scrollToTime(time: number, pxPerSec: number, center: boolean, smooth = true): void {
    const x = time * pxPerSec;
    const vw = this.viewport.clientWidth;
    const target = center ? Math.max(0, x - vw / 2) : Math.max(0, x - vw * 0.1);
    this.isProgrammaticScroll = true;
    this.viewport.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'instant' });
  }

  getScrollLeft(): number {
    return this.viewport.scrollLeft;
  }

  /** Detect manual user scrolls so we don't fight the user during playback. */
  private onUserScroll = (): void => {
    if (this.isProgrammaticScroll) {
      this.isProgrammaticScroll = false;
      return;
    }

    this.isUserScrolling = true;
    this.lerpTarget = null;
    if (this.userScrollTimer) clearTimeout(this.userScrollTimer);
    this.userScrollTimer = setTimeout(() => {
      this.isUserScrolling = false;
    }, 600);
  };

  destroy(): void {
    this.viewport.removeEventListener('scroll', this.onUserScroll);
    if (this.userScrollTimer) clearTimeout(this.userScrollTimer);
  }
}
