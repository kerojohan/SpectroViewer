import type {
  SpectrogramColorMap,
  SpectrogramData,
  SpectrogramRenderConfig,
  SpectrogramTileDescriptor,
  FrequencyEmphasis,
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
  private backgroundColor = getColormapBackground('magma');
  private prefetchMargin = 1200;
  private renderQueued = false;
  private tileIndex = new Map<string, SpectrogramTileDescriptor>();
  private frequencyEmphasis: FrequencyEmphasis | null = null;

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
    this.frequencyEmphasis = config?.frequencyEmphasis ?? null;
    const initialColormap = config?.colormap ?? 'magma';
    this.lut = buildColorLut(initialColormap);
    this.backgroundColor = getColormapBackground(initialColormap);

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
      background: this.backgroundColor,
    });
    Object.assign(this.container.style, {
      height: '100%',
      position: 'absolute',
      top: '0',
      left: '0',
      background: this.backgroundColor,
    });
  }

  load(data: SpectrogramData): void {
    this.data = data;
    this.clear();
    this.tileIndex = new Map(data.tiles.map((tile) => [tile.file, tile]));
    const colormap = data.colormap ?? 'magma';
    this.lut = buildColorLut(colormap);
    this.backgroundColor = getColormapBackground(colormap);
    this.prefetchMargin = Math.max(data.lazyMargin ?? this.prefetchMargin, this.prefetchMargin);
    this.applyBackgroundColor();

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
      background: this.backgroundColor || this.theme.background,
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

    this.refreshObserverAfterZoom();
    this.scheduleVisibleRender();
  }

  /**
   * After zoom, re-observe canvases whose rendered resolution no longer
   * matches the current zoom so they re-render when scrolled into view.
   */
  private refreshObserverAfterZoom(): void {
    if (!this.observer || !this.data) return;

    this.observer.disconnect();

    for (let i = 0; i < this.canvases.length; i++) {
      const canvas = this.canvases[i];
      const tile = this.data.tiles[i];
      if (!canvas || !tile) continue;

      const targetWidth = this.getRenderWidth(tile);
      const targetHeight = this.getRenderHeight(tile);
      const needsRender =
        canvas.dataset['rendered'] !== 'true' ||
        canvas.dataset['renderWidth'] !== String(targetWidth) ||
        canvas.dataset['renderHeight'] !== String(targetHeight);

      if (needsRender) {
        this.observer.observe(canvas);
      }
    }
  }

  getTotalWidth(): number {
    if (!this.data) return 0;
    return this.data.totalDuration * this.pxPerSec;
  }

  setColormap(colormap: SpectrogramColorMap): void {
    this.lut = buildColorLut(colormap);
    this.backgroundColor = getColormapBackground(colormap);
    this.applyBackgroundColor();

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

  getBackgroundColor(): string {
    return this.backgroundColor;
  }

  private async renderTile(canvas: HTMLCanvasElement, tile: SpectrogramTileDescriptor): Promise<void> {
    const targetWidth = this.getRenderWidth(tile);
    const targetHeight = this.getRenderHeight(tile);

    if (
      canvas.dataset['rendered'] === 'true'
      && canvas.dataset['renderWidth'] === String(targetWidth)
      && canvas.dataset['renderHeight'] === String(targetHeight)
    ) {
      return;
    }
    if (canvas.dataset['rendering'] === 'true') return;

    try {
      canvas.dataset['rendering'] = 'true';
      const raw = await this.getTileData(tile.file, tile.frames * tile.bins);
      if (!canvas.isConnected) return;

      const image = new ImageData(targetWidth, targetHeight);
      const pixels = new Uint32Array(image.data.buffer);
      const frameEdges = buildEdges(tile.frames, targetWidth);
      const binEdges = buildEdges(tile.bins, targetHeight);

      const emph = this.frequencyEmphasis;
      let emphBinStart = 0;
      let emphBinEnd = 0;
      let emphBoost = 1;
      if (emph) {
        const dMin = emph.dataMinHz ?? 0;
        const dMax = emph.dataMaxHz ?? 125000;
        const hzRange = dMax - dMin;
        emphBinStart = Math.max(0, Math.floor((1 - (emph.maxHz - dMin) / hzRange) * tile.bins));
        emphBinEnd = Math.min(tile.bins, Math.ceil((1 - (emph.minHz - dMin) / hzRange) * tile.bins));
        emphBoost = emph.boost ?? 1.5;
      }

      for (let y = 0; y < targetHeight; y += 1) {
        const binStart = binEdges[y];
        const binEnd = binEdges[y + 1];
        const boosted = emph && binStart < emphBinEnd && binEnd > emphBinStart;
        for (let x = 0; x < targetWidth; x += 1) {
          const frameStart = frameEdges[x];
          const frameEnd = frameEdges[x + 1];
          let value = maxPoolValue(raw, tile.bins, frameStart, frameEnd, binStart, binEnd);
          if (boosted) {
            value = Math.min(255, (value * emphBoost + 0.5) | 0);
          }
          const pixelBase = y * targetWidth + x;
          pixels[pixelBase] = this.lut[value];
        }
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = false;
      ctx.putImageData(image, 0, 0);
      canvas.dataset['rendered'] = 'true';
      canvas.dataset['renderWidth'] = String(targetWidth);
      canvas.dataset['renderHeight'] = String(targetHeight);
    } catch (err) {
      canvas.dataset['error'] = 'true';
      console.warn('[SpectroViewer] renderTile failed:', err);
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

  private applyBackgroundColor(): void {
    const background = this.backgroundColor || this.theme.background;
    this.wrapper.style.background = background;
    this.container.style.background = background;
    for (const canvas of this.canvases) {
      canvas.style.background = background;
    }
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

  private getRenderWidth(tile: SpectrogramTileDescriptor): number {
    const displayWidth = Math.max(1, Math.round(tile.duration * this.pxPerSec * window.devicePixelRatio));
    return Math.min(tile.frames, displayWidth);
  }

  private getRenderHeight(tile: SpectrogramTileDescriptor): number {
    const displayHeight = Math.max(1, Math.round(this.height * window.devicePixelRatio));
    return Math.min(tile.bins, displayHeight);
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

function getColormapBackground(colormap: SpectrogramColorMap): string {
  const [r, g, b] = getColorStops(colormap)[0];
  return `rgb(${r}, ${g}, ${b})`;
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
    case 'chiroptera':
      return [
        [1, 0, 5],
        [4, 1, 20],
        [6, 6, 45],
        [0, 100, 80],
        [180, 220, 0],
        [255, 160, 0],
        [255, 40, 20],
        [255, 40, 120],
        [255, 250, 255],
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

function buildEdges(sourceSize: number, targetSize: number): Uint32Array {
  const edges = new Uint32Array(targetSize + 1);
  for (let i = 0; i <= targetSize; i += 1) {
    edges[i] = Math.min(sourceSize, Math.floor(i * sourceSize / targetSize));
  }

  for (let i = 0; i < targetSize; i += 1) {
    if (edges[i + 1] <= edges[i]) {
      edges[i + 1] = Math.min(sourceSize, edges[i] + 1);
    }
  }

  return edges;
}

function maxPoolValue(
  raw: Uint8Array,
  bins: number,
  frameStart: number,
  frameEnd: number,
  binStart: number,
  binEnd: number,
): number {
  let maxValue = 0;

  for (let frame = frameStart; frame < frameEnd; frame += 1) {
    const rowBase = frame * bins;
    for (let bin = binStart; bin < binEnd; bin += 1) {
      const value = raw[rowBase + (bins - 1 - bin)];
      if (value > maxValue) {
        maxValue = value;
      }
    }
  }

  return maxValue;
}
