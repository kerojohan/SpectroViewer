import type { TimelineConfig, ThemeColors } from '../types';

/**
 * Renders an adaptive time-axis below the spectrogram.
 *
 * Uses a dedicated scroll-synced wrapper so it sits below
 * the main scrollViewport and is never clipped by overflow.
 */
export class Timeline {
  private wrapper: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private height: number;
  private config: Required<Pick<TimelineConfig, 'primaryColor' | 'secondaryColor' | 'fontColor' | 'fontSize' | 'fontFamily'>>;
  private scrollHandler: (() => void) | null = null;

  constructor(
    private parentWrapper: HTMLElement,
    private scrollViewport: HTMLElement,
    configInput: TimelineConfig | undefined,
    private theme: ThemeColors,
  ) {
    const cfg = configInput ?? {};
    this.height = cfg.height ?? 24;

    this.config = {
      primaryColor: cfg.primaryColor ?? theme.timelineLine,
      secondaryColor: cfg.secondaryColor ?? theme.timelineLine,
      fontColor: cfg.fontColor ?? theme.timelineText,
      fontSize: cfg.fontSize ?? 11,
      fontFamily: cfg.fontFamily ?? 'system-ui, -apple-system, sans-serif',
    };

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'sv-timeline-wrapper';
    Object.assign(this.wrapper.style, {
      overflowX: 'hidden',
      overflowY: 'hidden',
      height: `${this.height}px`,
      flexShrink: '0',
      position: 'relative',
      background: theme.timelineBackground ?? theme.background,
    });

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sv-timeline';
    Object.assign(this.canvas.style, {
      display: 'block',
      height: `${this.height}px`,
    });

    this.ctx = this.canvas.getContext('2d')!;
    this.wrapper.appendChild(this.canvas);
    this.parentWrapper.appendChild(this.wrapper);

    // Sync horizontal scroll with main viewport
    this.scrollHandler = () => {
      this.wrapper.scrollLeft = this.scrollViewport.scrollLeft;
    };
    this.scrollViewport.addEventListener('scroll', this.scrollHandler);
  }

  render(duration: number, pxPerSec: number): void {
    const totalWidth = Math.ceil(duration * pxPerSec);
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = totalWidth * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${totalWidth}px`;

    const ctx = this.ctx;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, totalWidth, this.height);

    const interval = this.pickInterval(pxPerSec);
    const subInterval = interval / 5;

    ctx.font = `${this.config.fontSize}px ${this.config.fontFamily}`;
    ctx.textBaseline = 'top';

    for (let t = 0; t <= duration; t += subInterval) {
      const x = Math.round(t * pxPerSec) + 0.5;
      const isMajor = Math.abs(t % interval) < 0.0001 || Math.abs(t % interval - interval) < 0.0001;

      ctx.beginPath();
      ctx.moveTo(x, 0);

      if (isMajor) {
        ctx.strokeStyle = this.config.primaryColor;
        ctx.lineWidth = 1;
        ctx.lineTo(x, this.height * 0.5);
        ctx.stroke();

        const label = this.formatTime(t);
        ctx.fillStyle = this.config.fontColor;
        ctx.fillText(label, x + 3, 2);
      } else {
        ctx.strokeStyle = this.config.secondaryColor;
        ctx.lineWidth = 0.5;
        ctx.lineTo(x, this.height * 0.3);
        ctx.stroke();
      }
    }

    // Sync scroll position after render
    this.wrapper.scrollLeft = this.scrollViewport.scrollLeft;
  }

  /** Choose a nice human-readable tick interval based on zoom level. */
  private pickInterval(pxPerSec: number): number {
    const intervals = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const minPixelGap = 80;
    for (const iv of intervals) {
      if (iv * pxPerSec >= minPixelGap) return iv;
    }
    return intervals[intervals.length - 1];
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) {
      const s = seconds.toFixed(seconds % 1 !== 0 && seconds < 10 ? 1 : 0);
      return `${s}s`;
    }
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  getHeight(): number {
    return this.height;
  }

  destroy(): void {
    if (this.scrollHandler) {
      this.scrollViewport.removeEventListener('scroll', this.scrollHandler);
    }
    this.wrapper.remove();
  }
}
