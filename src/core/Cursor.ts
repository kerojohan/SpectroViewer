import type { CursorConfig, ThemeColors } from '../types';

/**
 * Vertical playhead line that moves with the current playback time.
 */
export class Cursor {
  private el: HTMLElement;
  private pxPerSec: number;
  private currentTime = 0;

  constructor(
    private scrollContent: HTMLElement,
    private spectrogramHeight: number,
    config: CursorConfig | undefined,
    pxPerSec: number,
    theme: ThemeColors,
  ) {
    this.pxPerSec = pxPerSec;

    this.el = document.createElement('div');
    this.el.className = 'sv-cursor';

    const color = config?.color ?? theme.cursorColor;
    const width = config?.width ?? 2;

    Object.assign(this.el.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: `${width}px`,
      height: `${spectrogramHeight}px`,
      background: color,
      pointerEvents: 'none',
      zIndex: '30',
      transform: 'translateX(0px)',
      willChange: 'transform',
    });

    this.scrollContent.appendChild(this.el);
  }

  setTime(time: number): void {
    this.currentTime = time;
    const x = time * this.pxPerSec;
    this.el.style.transform = `translateX(${x}px)`;
  }

  getTime(): number {
    return this.currentTime;
  }

  updateZoom(pxPerSec: number): void {
    this.pxPerSec = pxPerSec;
    this.setTime(this.currentTime);
  }

  destroy(): void {
    this.el.remove();
  }
}
