import type {
  SpectrogramColorMap,
  SpectrogramData,
  SpectrogramRenderConfig,
  SpectrogramTileDescriptor,
  ThemeColors,
} from '../types';

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
  private lut = buildColorLut('magma');
  private prefetchMargin = 1200;
  private renderQueued = false;
  private tileIndex = new Map<string, SpectrogramTileDescriptor>();

  constructor(
    private scrollContent: HTMLElement,
    private scrollViewport: HTMLElement,
    pxPerSec: number,
    height: number,
    private theme: ThemeColors,
    config?: SpectrogramRenderConfig,
  ) {
    this.pxPerSec = pxPerSec;
    this.height = height;
    this.prefetchMargin = config?.prefetchMargin ?? this.prefetchMargin;
    this.lut = buildColorLut(config?.colormap ?? 'magma');

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'sv-spectrogram-wrapper';

    this.container = document.createElement('div');
    this.container.className = 'sv-spectrogram-images';

    this.wrapper.appendChild(this.container);
    this.scrollContent.insertBefore(this.wrapper, this.scrollContent.firstChild);
    this.applyBaseStyles();
    this.scrollViewport.addEventListener('scroll', this.onViewportScroll, { passive: true });
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
    this.tileIndex = new Map(data.tiles.map((tile) => [tile.file, tile]));
    this.lut = buildColorLut(data.colormap ?? 'magma');
    this.prefetchMargin = Math.max(data.lazyMargin ?? this.prefetchMargin, this.prefetchMargin);

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
            const tile = this.tileIndex.get(canvas.dataset['tileFile'] ?? '');
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

    this.scheduleVisibleRender();
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

  setColormap(colormap: SpectrogramColorMap): void {
    this.lut = buildColorLut(colormap);

    if (!this.data) return;
    this.data.colormap = colormap;
    for (const canvas of this.canvases) {
      if (canvas.dataset['rendered'] !== 'true') continue;
      const tile = this.tileIndex.get(canvas.dataset['tileFile'] ?? '');
      if (tile) {
        canvas.dataset['rendered'] = 'false';
        void this.renderTile(canvas, tile);
      }
    }
    this.scheduleVisibleRender();
  }

  private async renderTile(canvas: HTMLCanvasElement, tile: SpectrogramTileDescriptor): Promise<void> {
    if (canvas.dataset['rendered'] === 'true' || canvas.dataset['rendering'] === 'true') return;

    try {
      canvas.dataset['rendering'] = 'true';
      const raw = await this.getTileData(tile.file, tile.frames * tile.bins);
      if (!canvas.isConnected) return;

      const image = new ImageData(tile.frames, tile.bins);
      const pixels = new Uint32Array(image.data.buffer);

      for (let frame = 0; frame < tile.frames; frame += 1) {
        const sourceBase = frame * tile.bins;
        for (let y = 0; y < tile.bins; y += 1) {
          const sourceBin = tile.bins - 1 - y;
          const value = raw[sourceBase + sourceBin];
          const pixelBase = y * tile.frames + frame;
          pixels[pixelBase] = this.lut[value];
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
    } finally {
      delete canvas.dataset['rendering'];
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
    this.scrollViewport.removeEventListener('scroll', this.onViewportScroll);
    this.clear();
    this.wrapper.remove();
  }

  private onViewportScroll = (): void => {
    this.scheduleVisibleRender();
  };

  private scheduleVisibleRender(): void {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.renderVisibleTiles();
    });
  }

  private renderVisibleTiles(): void {
    if (!this.data) return;

    const left = Math.max(0, this.scrollViewport.scrollLeft - this.prefetchMargin);
    const right = this.scrollViewport.scrollLeft + this.scrollViewport.clientWidth + this.prefetchMargin;

    this.data.tiles.forEach((tile, index) => {
      const tileLeft = tile.startTime * this.pxPerSec;
      const tileRight = tileLeft + tile.duration * this.pxPerSec;
      if (tileRight < left || tileLeft > right) return;

      const canvas = this.canvases[index];
      if (canvas) {
        void this.renderTile(canvas, tile);
      }
    });
  }
}

function buildColorLut(colormap: SpectrogramColorMap): Uint32Array {
  const stops = getColorStops(colormap);
  const lut = new Uint32Array(256);
  const segments = stops.length - 1;

  for (let i = 0; i < 256; i += 1) {
    const position = i / 255;
    const scaled = position * segments;
    const index = Math.min(segments - 1, Math.floor(scaled));
    const t = scaled - index;
    const start = stops[index];
    const end = stops[index + 1];
    const r = Math.round(start[0] + (end[0] - start[0]) * t);
    const g = Math.round(start[1] + (end[1] - start[1]) * t);
    const b = Math.round(start[2] + (end[2] - start[2]) * t);

    lut[i] = packRgba(r, g, b, 255);
  }

  return lut;
}

function getColorStops(colormap: SpectrogramColorMap): Array<[number, number, number]> {
  switch (colormap) {
    case 'inferno':
      return [
        [0, 0, 4],
        [31, 12, 72],
        [85, 15, 109],
        [136, 34, 106],
        [186, 54, 85],
        [227, 89, 51],
        [249, 140, 10],
        [252, 195, 65],
        [252, 255, 164],
      ];
    case 'viridis':
      return [
        [68, 1, 84],
        [72, 40, 120],
        [62, 74, 137],
        [49, 104, 142],
        [38, 130, 142],
        [31, 158, 137],
        [53, 183, 121],
        [109, 205, 89],
        [253, 231, 37],
      ];
    case 'plasma':
      return [
        [13, 8, 135],
        [75, 3, 161],
        [125, 3, 168],
        [168, 34, 150],
        [203, 70, 121],
        [229, 107, 93],
        [248, 148, 65],
        [253, 195, 40],
        [240, 249, 33],
      ];
    case 'turbo':
      return [
        [48, 18, 59],
        [50, 86, 164],
        [24, 141, 222],
        [32, 188, 169],
        [103, 219, 83],
        [181, 228, 41],
        [239, 196, 30],
        [248, 120, 34],
        [165, 24, 24],
      ];
    case 'gray':
      return [
        [0, 0, 0],
        [255, 255, 255],
      ];
    case 'gray-inverse':
      return [
        [255, 255, 255],
        [0, 0, 0],
      ];
    case 'magma':
    default:
      return [
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
  }
}

function packRgba(r: number, g: number, b: number, a: number): number {
  return r | (g << 8) | (b << 16) | (a << 24);
}
