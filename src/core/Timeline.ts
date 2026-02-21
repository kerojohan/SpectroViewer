import type { TimelineConfig, ThemeColors } from '../types';

/**
 * Renders an adaptive time-axis below the spectrogram.
 *
 * Uses a single <canvas> that stretches to the full scroll-content width.
 * Re-rendered on zoom changes.
 */
export class Timeline {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private height: number;
  private config: Required<Pick<TimelineConfig, 'primaryColor' | 'secondaryColor' | 'fontColor' | 'fontSize' | 'fontFamily'>>;

  constructor(
    private scrollContent: HTMLElement,
    configInput: TimelineConfig | undefined,
    private theme: ThemeColors,
  ) {
    const cfg = configInput ?? {};
    this.height = cfg.height ?? 30;

    this.config = {
      primaryColor: cfg.primaryColor ?? theme.timelineLine,
      secondaryColor: cfg.secondaryColor ?? theme.timelineLine,
      fontColor: cfg.fontColor ?? theme.timelineText,
      fontSize: cfg.fontSize ?? 11,
      fontFamily: cfg.fontFamily ?? 'system-ui, -apple-system, sans-serif',
    };

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sv-timeline';
    Object.assign(this.canvas.style, {
      display: 'block',
      height: `${this.height}px`,
      width: '100%',
      background: theme.timelineBackground,
      borderTop: `1px solid ${theme.timelineLine}44`,
    });

    this.ctx = this.canvas.getContext('2d')!;
    this.scrollContent.appendChild(this.canvas);
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
    ctx.textBaseline = 'middle';

    for (let t = 0; t <= duration; t += subInterval) {
      const x = Math.round(t * pxPerSec) + 0.5;
      const isMajor = Math.abs(t % interval) < 0.0001 || Math.abs(t % interval - interval) < 0.0001;

      ctx.beginPath();
      ctx.moveTo(x, 0);

      if (isMajor) {
        ctx.strokeStyle = this.config.primaryColor;
        ctx.lineWidth = 1;
        ctx.lineTo(x, this.height * 0.45);
        ctx.stroke();

        const label = this.formatTime(t);
        ctx.fillStyle = this.config.fontColor;
        ctx.fillText(label, x + 4, this.height * 0.72);
      } else {
        ctx.strokeStyle = this.config.secondaryColor;
        ctx.lineWidth = 0.5;
        ctx.lineTo(x, this.height * 0.25);
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
    this.canvas.remove();
  }
}
