import type { SpectrogramData, SpectrogramFileDescriptor, ThemeColors } from '../types';

/**
 * Renders pre-generated spectrogram image segments inside the scroll container.
 * Supports lazy loading via IntersectionObserver and zoom-aware resizing.
 */
export class SpectrogramLayer {
  private wrapper: HTMLElement;
  private container: HTMLElement;
  private observer: IntersectionObserver | null = null;
  private images: HTMLImageElement[] = [];
  private data: SpectrogramData | null = null;
  private pxPerSec: number;
  private height: number;

  constructor(
    private scrollContent: HTMLElement,
    private scrollViewport: HTMLElement,
    pxPerSec: number,
    height: number,
    private theme: ThemeColors,
  ) {
    this.pxPerSec = pxPerSec;
    this.height = height;

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'sv-spectrogram-wrapper';

    this.container = document.createElement('div');
    this.container.className = 'sv-spectrogram-images';

    this.wrapper.appendChild(this.container);
    this.scrollContent.insertBefore(this.wrapper, this.scrollContent.firstChild);
    this.applyBaseStyles();
  }

  private applyBaseStyles(): void {
    Object.assign(this.wrapper.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      height: `${this.height}px`,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '1',
    });
    Object.assign(this.container.style, {
      display: 'flex',
      height: '100%',
      position: 'absolute',
      top: '0',
      left: '0',
    });
  }

  load(data: SpectrogramData): void {
    this.data = data;
    this.clear();

    const totalDuration = data.totalDuration ?? data.files.reduce((s, f) => s + f.duration, 0);
    const totalWidth = totalDuration * this.pxPerSec;

    this.wrapper.style.width = `${totalWidth}px`;
    this.container.style.width = `${totalWidth}px`;

    const lazyLoad = data.lazyLoad !== false;
    const lazyMargin = data.lazyMargin ?? 300;

    if (lazyLoad) {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            if (src && !img.src) {
              img.src = src;
            }
            this.observer?.unobserve(img);
          }
        },
        { root: this.scrollViewport, rootMargin: `${lazyMargin}px`, threshold: 0 },
      );
    }

    for (const file of data.files) {
      const img = this.createImage(file, lazyLoad);
      this.container.appendChild(img);
      this.images.push(img);
      if (lazyLoad) this.observer?.observe(img);
    }
  }

  private createImage(file: SpectrogramFileDescriptor, lazy: boolean): HTMLImageElement {
    const img = document.createElement('img');
    const w = file.duration * this.pxPerSec;

    Object.assign(img.style, {
      height: '100%',
      width: `${w}px`,
      objectFit: 'fill',
      background: this.theme.background,
      display: 'block',
      flexShrink: '0',
    });

    img.draggable = false;
    img.alt = '';

    if (lazy) {
      img.dataset.src = file.url;
    } else {
      img.src = file.url;
    }
    return img;
  }

  /** Recalculate widths when zoom changes. */
  updateZoom(pxPerSec: number): void {
    this.pxPerSec = pxPerSec;
    if (!this.data) return;

    const totalDuration = this.data.totalDuration ?? this.data.files.reduce((s, f) => s + f.duration, 0);
    const totalWidth = totalDuration * pxPerSec;

    this.wrapper.style.width = `${totalWidth}px`;
    this.container.style.width = `${totalWidth}px`;

    this.data.files.forEach((file, i) => {
      const img = this.images[i];
      if (img) {
        img.style.width = `${file.duration * pxPerSec}px`;
      }
    });
  }

  getTotalWidth(): number {
    if (!this.data) return 0;
    const d = this.data.totalDuration ?? this.data.files.reduce((s, f) => s + f.duration, 0);
    return d * this.pxPerSec;
  }

  private clear(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.images = [];
    this.container.innerHTML = '';
  }

  destroy(): void {
    this.clear();
    this.wrapper.remove();
  }
}
