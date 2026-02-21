import type { ScrollConfig, ThemeColors } from '../types';

/**
 * Manages horizontal scrolling of the spectrogram viewport.
 *
 * - Auto-scroll: keeps the cursor visible during playback.
 * - Auto-center: re-centers the view on the cursor while scrolling.
 * - Programmatic `scrollToTime()` with smooth animation.
 */
export class ScrollManager {
  autoScroll: boolean;
  autoCenter: boolean;
  private isUserScrolling = false;
  private userScrollTimer: ReturnType<typeof setTimeout> | null = null;

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
   * Called on every `timeupdate` to keep the cursor in view during playback.
   */
  followCursor(cursorX: number, isPlaying: boolean): void {
    if (!isPlaying || this.isUserScrolling) return;

    const vw = this.viewport.clientWidth;
    const sl = this.viewport.scrollLeft;

    if (this.autoCenter) {
      const target = cursorX - vw / 2;
      if (Math.abs(this.viewport.scrollLeft - target) > 2) {
        this.viewport.scrollLeft = target;
      }
    } else if (this.autoScroll) {
      const rightEdge = sl + vw;
      const margin = vw * 0.1;
      if (cursorX > rightEdge - margin || cursorX < sl) {
        this.viewport.scrollLeft = cursorX - margin;
      }
    }
  }

  scrollToTime(time: number, pxPerSec: number, center: boolean, smooth = true): void {
    const x = time * pxPerSec;
    const vw = this.viewport.clientWidth;
    const target = center ? Math.max(0, x - vw / 2) : Math.max(0, x - vw * 0.1);
    this.viewport.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'instant' });
  }

  getScrollLeft(): number {
    return this.viewport.scrollLeft;
  }

  /** Detect manual user scrolls so we don't fight the user during playback. */
  private onUserScroll = (): void => {
    this.isUserScrolling = true;
    if (this.userScrollTimer) clearTimeout(this.userScrollTimer);
    this.userScrollTimer = setTimeout(() => {
      this.isUserScrolling = false;
    }, 800);
  };

  destroy(): void {
    this.viewport.removeEventListener('scroll', this.onUserScroll);
    if (this.userScrollTimer) clearTimeout(this.userScrollTimer);
  }
}
