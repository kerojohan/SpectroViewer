import type { SpectrogramData, SpectrogramTileDescriptor, ThemeColors } from '../types';

/**
 * Renders spectrogram data tiles into canvases inside the scroll container.
 * Supports lazy loading via IntersectionObserver and zoom-aware resizing.
 */
export class SpectrogramLayer {
  private wrapper: HTMLElement;
  private container: HTMLElement;
  private observer: IntersectionObserver | null = null;
  private canvases: HTMLCanvasElement[] = [];
  private data: SpectrogramData | null = null;
  private pxPerSec: number;
  private height: number;
  private tileCache = new Map<string, Uint8Array>();
  private pendingLoads = new Map<string, Promise<Uint8Array>>();
  private lut = buildMagmaLut();

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
      height: '100%',
      position: 'absolute',
      top: '0',
      left: '0',
    });
  }

  load(data: SpectrogramData): void {
    this.data = data;
    this.clear();

    const totalDuration = data.totalDuration;
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
            const canvas = entry.target as HTMLCanvasElement;
            const tile = this.data?.tiles.find((item) => item.file === canvas.dataset['tileFile']);
            if (tile) {
              void this.renderTile(canvas, tile);
            }
            this.observer?.unobserve(canvas);
          }
        },
        { root: this.scrollViewport, rootMargin: `${lazyMargin}px`, threshold: 0 },
      );
    }

    for (const tile of data.tiles) {
      const canvas = this.createCanvas(tile, lazyLoad);
      this.container.appendChild(canvas);
      this.canvases.push(canvas);
      if (lazyLoad) {
        this.observer?.observe(canvas);
      } else {
        void this.renderTile(canvas, tile);
      }
    }
  }

  private createCanvas(tile: SpectrogramTileDescriptor, lazy: boolean): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const width = tile.duration * this.pxPerSec;
    const left = tile.startTime * this.pxPerSec;

    Object.assign(canvas.style, {
      height: '100%',
      width: `${width}px`,
      left: `${left}px`,
      top: '0',
      position: 'absolute',
      objectFit: 'fill',
      background: this.theme.background,
      display: 'block',
    });

    canvas.dataset['tileFile'] = tile.file;
    canvas.dataset['frames'] = String(tile.frames);
    canvas.dataset['bins'] = String(tile.bins);

    if (lazy) {
      canvas.dataset['pending'] = 'true';
    }
    return canvas;
  }

  /** Recalculate widths when zoom changes. */
  updateZoom(pxPerSec: number): void {
    this.pxPerSec = pxPerSec;
    if (!this.data) return;

    const totalDuration = this.data.totalDuration;
    const totalWidth = totalDuration * pxPerSec;

    this.wrapper.style.width = `${totalWidth}px`;
    this.container.style.width = `${totalWidth}px`;

    this.data.tiles.forEach((tile, i) => {
      const canvas = this.canvases[i];
      if (canvas) {
        canvas.style.left = `${tile.startTime * pxPerSec}px`;
        canvas.style.width = `${tile.duration * pxPerSec}px`;
      }
    });
  }

  getTotalWidth(): number {
    if (!this.data) return 0;
    return this.data.totalDuration * this.pxPerSec;
  }

  private async renderTile(canvas: HTMLCanvasElement, tile: SpectrogramTileDescriptor): Promise<void> {
    if (canvas.dataset['rendered'] === 'true') return;

    try {
      const raw = await this.getTileData(tile.file, tile.frames * tile.bins);
      if (!canvas.isConnected) return;

      const image = new ImageData(tile.frames, tile.bins);
      const pixels = image.data;

      for (let frame = 0; frame < tile.frames; frame += 1) {
        const sourceBase = frame * tile.bins;
        for (let y = 0; y < tile.bins; y += 1) {
          const sourceBin = tile.bins - 1 - y;
          const value = raw[sourceBase + sourceBin];
          const pixelBase = (y * tile.frames + frame) * 4;
          const lutBase = value * 4;

          pixels[pixelBase] = this.lut[lutBase];
          pixels[pixelBase + 1] = this.lut[lutBase + 1];
          pixels[pixelBase + 2] = this.lut[lutBase + 2];
          pixels[pixelBase + 3] = 255;
        }
      }

      canvas.width = tile.frames;
      canvas.height = tile.bins;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = false;
      ctx.putImageData(image, 0, 0);
      canvas.dataset['rendered'] = 'true';
    } catch {
      canvas.dataset['error'] = 'true';
    }
  }

  private async getTileData(url: string, expectedBytes: number): Promise<Uint8Array> {
    const cached = this.tileCache.get(url);
    if (cached) return cached;

    const pending = this.pendingLoads.get(url);
    if (pending) return pending;

    const loadPromise = fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load tile: ${response.status}`);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength !== expectedBytes) {
          throw new Error(`Unexpected tile size for ${url}`);
        }
        this.tileCache.set(url, bytes);
        this.pendingLoads.delete(url);
        return bytes;
      })
      .catch((error) => {
        this.pendingLoads.delete(url);
        throw error;
      });

    this.pendingLoads.set(url, loadPromise);
    return loadPromise;
  }

  private clear(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.canvases = [];
    this.container.innerHTML = '';
  }

  destroy(): void {
    this.clear();
    this.wrapper.remove();
  }
}

function buildMagmaLut(): Uint8ClampedArray {
  const stops: Array<[number, number, number]> = [
    [0, 0, 4],
    [28, 16, 68],
    [79, 18, 123],
    [129, 37, 129],
    [181, 54, 122],
    [229, 80, 100],
    [251, 135, 97],
    [254, 194, 135],
    [252, 253, 191],
  ];

  const lut = new Uint8ClampedArray(256 * 4);
  const segments = stops.length - 1;

  for (let i = 0; i < 256; i += 1) {
    const position = i / 255;
    const scaled = position * segments;
    const index = Math.min(segments - 1, Math.floor(scaled));
    const t = scaled - index;
    const start = stops[index];
    const end = stops[index + 1];
    const base = i * 4;

    lut[base] = Math.round(start[0] + (end[0] - start[0]) * t);
    lut[base + 1] = Math.round(start[1] + (end[1] - start[1]) * t);
    lut[base + 2] = Math.round(start[2] + (end[2] - start[2]) * t);
    lut[base + 3] = 255;
  }

  return lut;
}
