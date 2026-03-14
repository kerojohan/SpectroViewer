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
  private lastDuration = 0;
  private lastPxPerSec = 100;

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

    this.scrollHandler = () => {
      this.paintVisible();
    };
    this.scrollViewport.addEventListener('scroll', this.scrollHandler);
  }

  setBackground(bg: string): void {
    this.wrapper.style.background = bg;
  }

  render(duration: number, pxPerSec: number): void {
    this.lastDuration = duration;
    this.lastPxPerSec = pxPerSec;
    this.paintVisible();
  }

  /**
   * Render only the visible portion of the timeline into a
   * viewport-sized canvas, avoiding browser canvas dimension limits.
   */
  private paintVisible(): void {
    const duration = this.lastDuration;
    const pxPerSec = this.lastPxPerSec;
    if (!duration || !pxPerSec) return;

    const dpr = window.devicePixelRatio || 1;
    const viewportWidth = this.scrollViewport.clientWidth;
    const scrollLeft = this.scrollViewport.scrollLeft;
    const totalWidth = Math.ceil(duration * pxPerSec);
    const drawWidth = Math.min(viewportWidth, totalWidth);

    this.canvas.width = drawWidth * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${drawWidth}px`;

    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, drawWidth, this.height);

    const interval = this.pickInterval(pxPerSec);
    const subInterval = interval / 5;

    ctx.font = `${this.config.fontSize}px ${this.config.fontFamily}`;
    ctx.textBaseline = 'top';

    const startTime = Math.max(0, Math.floor((scrollLeft / pxPerSec) / subInterval - 1) * subInterval);
    const endTime = Math.min(duration, (scrollLeft + viewportWidth) / pxPerSec + subInterval);

    for (let t = startTime; t <= endTime; t += subInterval) {
      const x = Math.round(t * pxPerSec - scrollLeft) + 0.5;
      if (x < -50 || x > drawWidth + 50) continue;

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
