import type { FrequencyGridConfig, FrequencyAxisConfig, FrequencyBandHighlight, ThemeColors } from '../types';
import { FrequencyAxis } from './FrequencyAxis';

/**
 * Renders horizontal guide lines across the spectrogram at specific
 * frequency values. The lines scroll horizontally with the spectrogram
 * and adapt when the zoom level changes.
 */
export class FrequencyGrid {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private color: string;
  private opacity: number;
  private lineWidth: number;
  private dashPattern: [number, number] | null;
  private showLabels: boolean;
  private formatLabel: (hz: number) => string;
  private lines: 'auto' | number[];
  private highlightBands: FrequencyBandHighlight[];

  private minHz: number;
  private maxHz: number;
  private labelCount: number;
  private currentWidth = 0;
  private scrollViewport: HTMLElement | null = null;
  private scrollHandler: (() => void) | null = null;

  constructor(
    private parent: HTMLElement,
    config: FrequencyGridConfig | undefined,
    freqAxisConfig: FrequencyAxisConfig | undefined,
    private spectrogramHeight: number,
    private theme: ThemeColors,
  ) {
    const cfg = config ?? {};
    const freqCfg = freqAxisConfig ?? {};

    this.color = cfg.color ?? theme.freqGridLine;
    this.opacity = cfg.opacity ?? 0.35;
    this.lineWidth = cfg.lineWidth ?? 1;
    this.dashPattern = cfg.dashPattern === undefined ? [4, 4] : cfg.dashPattern;
    this.showLabels = cfg.showLabels ?? true;
    this.formatLabel = cfg.formatLabel ?? freqCfg.formatLabel ?? FrequencyAxis.defaultFormat;
    this.lines = cfg.lines ?? 'auto';
    this.highlightBands = cfg.highlightBands ?? [];

    this.minHz = freqCfg.min ?? 0;
    this.maxHz = freqCfg.max ?? 125000;
    this.labelCount = freqCfg.labelCount ?? 6;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sv-freq-grid';
    Object.assign(this.canvas.style, {
      position: 'sticky',
      left: '0',
      top: '0',
      width: '100%',
      height: `${spectrogramHeight}px`,
      pointerEvents: 'none',
      zIndex: '5',
    });

    this.ctx = this.canvas.getContext('2d')!;
    parent.appendChild(this.canvas);
  }

  /** Resolve which Hz values to draw. */
  private resolveLines(): number[] {
    if (Array.isArray(this.lines)) {
      return [...this.lines].sort((a, b) => a - b);
    }
    const step = (this.maxHz - this.minHz) / (this.labelCount - 1);
    const vals: number[] = [];
    for (let i = 0; i < this.labelCount; i++) {
      vals.push(this.minHz + step * i);
    }
    return vals;
  }

  /** Convert a frequency value to a Y pixel position (top = maxHz, bottom = minHz). */
  private hzToY(hz: number): number {
    const ratio = (hz - this.minHz) / (this.maxHz - this.minHz);
    return this.spectrogramHeight * (1 - ratio);
  }

  /** Full render – call after zoom changes or initial load. */
  render(contentWidth: number): void {
    this.currentWidth = contentWidth;
    this.paintGrid();
  }

  /**
   * Paint the grid using the viewport width instead of the full content
   * width. The canvas uses `position: sticky` so it stays within the
   * visible area while the content scrolls underneath.
   */
  private paintGrid(): void {
    const dpr = window.devicePixelRatio || 1;
    const h = this.spectrogramHeight;
    const viewport = this.parent.parentElement;
    const drawWidth = viewport ? viewport.clientWidth : Math.min(this.currentWidth, 4000);

    this.canvas.width = drawWidth * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${drawWidth}px`;
    this.canvas.style.height = `${h}px`;

    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, drawWidth, h);

    this.paintHighlightBands(ctx, drawWidth, h);

    const values = this.resolveLines();

    ctx.strokeStyle = this.color;
    ctx.globalAlpha = this.opacity;
    ctx.lineWidth = this.lineWidth;
    if (this.dashPattern) {
      ctx.setLineDash(this.dashPattern);
    } else {
      ctx.setLineDash([]);
    }

    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'bottom';

    for (const hz of values) {
      if (hz <= this.minHz || hz >= this.maxHz) continue;

      const y = Math.round(this.hzToY(hz)) + 0.5;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(drawWidth, y);
      ctx.stroke();

      if (this.showLabels) {
        ctx.setLineDash([]);
        ctx.globalAlpha = this.opacity + 0.25;
        const label = this.formatLabel(hz);
        const labelW = ctx.measureText(label).width;

        ctx.fillStyle = this.theme.background;
        ctx.fillRect(4, y - 14, labelW + 6, 14);

        ctx.fillStyle = this.theme.freqGridLabel;
        ctx.fillText(label, 7, y - 2);

        ctx.globalAlpha = this.opacity;
        if (this.dashPattern) ctx.setLineDash(this.dashPattern);
      }
    }

    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  private paintHighlightBands(ctx: CanvasRenderingContext2D, drawWidth: number, h: number): void {
    for (const band of this.highlightBands) {
      const yTop = Math.round(this.hzToY(Math.min(band.maxHz, this.maxHz)));
      const yBottom = Math.round(this.hzToY(Math.max(band.minHz, this.minHz)));
      const bandHeight = yBottom - yTop;
      if (bandHeight <= 0) continue;

      const fillColor = band.fillColor ?? 'rgba(255, 200, 40, 0.07)';
      const borderColor = band.borderColor ?? 'rgba(255, 200, 40, 0.6)';
      const borderWidth = band.borderWidth ?? 1.5;

      ctx.save();

      ctx.globalAlpha = 1;
      ctx.fillStyle = fillColor;
      ctx.fillRect(0, yTop, drawWidth, bandHeight);

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.setLineDash([]);

      if (band.minHz > this.minHz) {
        ctx.beginPath();
        ctx.moveTo(0, yBottom + 0.5);
        ctx.lineTo(drawWidth, yBottom + 0.5);
        ctx.stroke();
      }
      if (band.maxHz < this.maxHz) {
        ctx.beginPath();
        ctx.moveTo(0, yTop + 0.5);
        ctx.lineTo(drawWidth, yTop + 0.5);
        ctx.stroke();
      }

      if (band.label) {
        const labelColor = band.labelColor ?? borderColor;
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.textBaseline = 'top';
        const labelW = ctx.measureText(band.label).width;
        const labelX = drawWidth - labelW - 12;
        const labelY = yTop + 4;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(labelX - 4, labelY - 1, labelW + 8, 16);

        ctx.fillStyle = labelColor;
        ctx.fillText(band.label, labelX, labelY);
      }

      ctx.restore();
    }
  }

  /** Update when zoom level changes (new content width). */
  updateZoom(contentWidth: number): void {
    this.render(contentWidth);
  }

  /** Update grid configuration dynamically. */
  update(config: Partial<FrequencyGridConfig>): void {
    if (config.lines !== undefined) this.lines = config.lines;
    if (config.color !== undefined) this.color = config.color;
    if (config.opacity !== undefined) this.opacity = config.opacity;
    if (config.lineWidth !== undefined) this.lineWidth = config.lineWidth;
    if (config.dashPattern !== undefined) this.dashPattern = config.dashPattern;
    if (config.showLabels !== undefined) this.showLabels = config.showLabels;
    if (config.formatLabel !== undefined) this.formatLabel = config.formatLabel;
    if (config.highlightBands !== undefined) this.highlightBands = config.highlightBands;
    if (this.currentWidth > 0) this.render(this.currentWidth);
  }

  /** Update frequency range (when frequency axis changes). */
  updateFrequencyRange(min: number, max: number, labelCount?: number): void {
    this.minHz = min;
    this.maxHz = max;
    if (labelCount !== undefined) this.labelCount = labelCount;
    if (this.currentWidth > 0) this.render(this.currentWidth);
  }

  destroy(): void {
    this.canvas.remove();
  }
}
