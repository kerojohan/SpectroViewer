import type { HoverConfig, ThemeColors } from '../types';

/**
 * Hover crosshair with time label that follows the pointer.
 */
export class HoverLine {
  private line: HTMLElement;
  private label: HTMLElement;
  private formatTime: (seconds: number) => string;
  private enabled: boolean;
  private destroyed = false;

  constructor(
    private interactionArea: HTMLElement,
    private scrollViewport: HTMLElement,
    private spectrogramHeight: number,
    private getDuration: () => number,
    private getPxPerSec: () => number,
    config: HoverConfig | undefined,
    theme: ThemeColors,
  ) {
    const cfg = config ?? {};
    this.enabled = cfg.enabled !== false;
    this.formatTime = cfg.formatTime ?? HoverLine.defaultFormat;

    this.line = document.createElement('div');
    this.line.className = 'sv-hover-line';
    Object.assign(this.line.style, {
      position: 'absolute',
      top: '0',
      height: `${spectrogramHeight}px`,
      width: '2px',
      background: cfg.color ?? theme.hoverLineColor,
      pointerEvents: 'none',
      zIndex: '100',
      opacity: '0',
      transition: 'opacity 0.1s',
    });

    this.label = document.createElement('div');
    this.label.className = 'sv-hover-label';
    Object.assign(this.label.style, {
      position: 'absolute',
      top: '0',
      padding: '2px 6px',
      background: cfg.labelBackground ?? theme.hoverLabelBg,
      color: cfg.labelColor ?? theme.hoverLabelText,
      fontSize: '11px',
      fontFamily: 'monospace',
      fontWeight: 'bold',
      borderRadius: '3px',
      pointerEvents: 'none',
      zIndex: '101',
      opacity: '0',
      transition: 'opacity 0.1s',
      whiteSpace: 'nowrap',
    });

    this.interactionArea.style.position = 'relative';
    this.interactionArea.appendChild(this.line);
    this.interactionArea.appendChild(this.label);

    if (this.enabled) this.bind();
  }

  private bind(): void {
    this.interactionArea.addEventListener('pointermove', this.onMove);
    this.interactionArea.addEventListener('pointerleave', this.onLeave);
  }

  private onMove = (e: PointerEvent): void => {
    if (!this.enabled || this.destroyed) return;

    const rect = this.interactionArea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scrollLeft = this.scrollViewport.scrollLeft;
    const totalWidth = this.interactionArea.scrollWidth;
    const actualX = x + scrollLeft;
    const duration = this.getDuration();
    const time = duration * (actualX / totalWidth);

    this.line.style.left = `${x}px`;
    this.line.style.opacity = '1';

    this.label.textContent = this.formatTime(Math.max(0, time));

    const labelWidth = this.label.offsetWidth || 60;
    if (x + labelWidth + 5 > rect.width) {
      this.label.style.left = `${x - labelWidth - 5}px`;
    } else {
      this.label.style.left = `${x + 5}px`;
    }
    this.label.style.opacity = '1';
  };

  private onLeave = (): void => {
    this.line.style.opacity = '0';
    this.label.style.opacity = '0';
  };

  static defaultFormat(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.onLeave();
  }

  destroy(): void {
    this.destroyed = true;
    this.interactionArea.removeEventListener('pointermove', this.onMove);
    this.interactionArea.removeEventListener('pointerleave', this.onLeave);
    this.line.remove();
    this.label.remove();
  }
}
