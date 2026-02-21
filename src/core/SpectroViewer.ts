import type {
  SpectroViewerOptions,
  SpectroViewerEvents,
  SpectrogramData,
  RegionOptions,
  Region,
  ThemeColors,
  FrequencyAxisConfig,
  ScrollConfig,
} from '../types';

import { EventEmitter } from './EventEmitter';
import { resolveTheme } from '../themes';
import { SpectrogramLayer } from '../layers/SpectrogramLayer';
import { RegionsLayer } from '../layers/RegionsLayer';
import { Timeline } from './Timeline';
import { FrequencyAxis } from './FrequencyAxis';
import { FrequencyGrid } from './FrequencyGrid';
import { Cursor } from './Cursor';
import { HoverLine } from './HoverLine';
import { ScrollManager } from './ScrollManager';
import { MediaSync } from '../plugins/MediaSync';
import { injectStyles } from '../styles';

/**
 * **SpectroViewer** – Lightweight spectrogram viewer with regions,
 * timeline, and media synchronization.
 *
 * ```ts
 * const viewer = SpectroViewer.create({ container: '#viewer', height: 400 });
 * viewer.loadSpectrogram({ files: [...], totalDuration: 120 });
 * viewer.syncMedia(document.querySelector('video'));
 * ```
 */
export class SpectroViewer extends EventEmitter<SpectroViewerEvents> {
  // -- DOM structure --------------------------------------------------------
  private root: HTMLElement;
  private wrapper: HTMLElement;
  private scrollViewport: HTMLElement;
  private scrollContent: HTMLElement;

  // -- Sub-components -------------------------------------------------------
  private spectrogramLayer!: SpectrogramLayer;
  private regionsLayer: RegionsLayer | null = null;
  private timeline: Timeline | null = null;
  private freqAxis: FrequencyAxis | null = null;
  private freqGrid: FrequencyGrid | null = null;
  private cursor: Cursor | null = null;
  private hoverLine: HoverLine | null = null;
  private scrollManager!: ScrollManager;
  private mediaSync: MediaSync | null = null;

  // -- State ----------------------------------------------------------------
  private theme: ThemeColors;
  private pxPerSec: number;
  private spectrogramHeight: number;
  private _duration = 0;
  private _currentTime = 0;
  private _playing = false;
  private _destroyed = false;

  // -- CSS injection guard --------------------------------------------------
  private static stylesInjected = false;

  private constructor(private opts: SpectroViewerOptions) {
    super();

    if (!SpectroViewer.stylesInjected) {
      injectStyles();
      SpectroViewer.stylesInjected = true;
    }

    this.theme = resolveTheme(opts.theme);
    this.pxPerSec = opts.pixelsPerSecond ?? 100;
    this.spectrogramHeight = opts.height ?? 400;
    if (opts.duration) this._duration = opts.duration;

    // --- Resolve container ---
    const container = typeof opts.container === 'string'
      ? document.querySelector<HTMLElement>(opts.container)
      : opts.container;
    if (!container) throw new Error(`[SpectroViewer] Container not found: ${opts.container}`);

    // --- Build DOM tree ---
    this.root = document.createElement('div');
    this.root.className = 'sv-root';
    this.root.style.setProperty('--sv-bg', this.theme.background);
    this.root.style.setProperty('--sv-scrollbar-thumb', this.theme.scrollbarThumb);
    Object.assign(this.root.style, {
      background: this.theme.background,
      color: this.theme.text,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    });

    // Frequency axis (left side – built first so it precedes the scroll area)
    if (opts.frequencyAxis !== false) {
      this.freqAxis = new FrequencyAxis(
        this.root,
        typeof opts.frequencyAxis === 'object' ? opts.frequencyAxis : undefined,
        this.spectrogramHeight,
        this.theme,
      );
    }

    // Scroll wrapper (right side)
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'sv-wrapper';
    Object.assign(this.wrapper.style, {
      flex: '1',
      minWidth: '0',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    });

    // The viewport that scrolls horizontally
    this.scrollViewport = document.createElement('div');
    this.scrollViewport.className = 'sv-scroll-viewport';
    Object.assign(this.scrollViewport.style, {
      overflowX: 'auto',
      overflowY: 'hidden',
      position: 'relative',
      flex: '1',
    });

    // The content div that expands to full duration width
    this.scrollContent = document.createElement('div');
    this.scrollContent.className = 'sv-scroll-content';
    Object.assign(this.scrollContent.style, {
      position: 'relative',
      minHeight: `${this.spectrogramHeight}px`,
      display: 'flex',
      flexDirection: 'column',
    });

    this.scrollViewport.appendChild(this.scrollContent);
    this.wrapper.appendChild(this.scrollViewport);
    this.root.appendChild(this.wrapper);
    container.appendChild(this.root);

    // --- Initialize sub-components ---
    this.scrollManager = new ScrollManager(
      this.scrollViewport,
      typeof opts.scroll === 'object' ? opts.scroll : undefined,
      this.theme,
    );

    this.spectrogramLayer = new SpectrogramLayer(
      this.scrollContent,
      this.scrollViewport,
      this.pxPerSec,
      this.spectrogramHeight,
      this.theme,
    );

    // Frequency grid (horizontal lines over the spectrogram)
    if (opts.frequencyGrid !== false) {
      this.freqGrid = new FrequencyGrid(
        this.scrollContent,
        typeof opts.frequencyGrid === 'object' ? opts.frequencyGrid : undefined,
        typeof opts.frequencyAxis === 'object' ? opts.frequencyAxis : undefined,
        this.spectrogramHeight,
        this.theme,
      );
    }

    if (opts.timeline !== false) {
      this.timeline = new Timeline(
        this.wrapper,
        this.scrollViewport,
        typeof opts.timeline === 'object' ? opts.timeline : undefined,
        this.theme,
      );
    }

    if (opts.cursor !== false) {
      this.cursor = new Cursor(
        this.scrollContent,
        this.spectrogramHeight,
        typeof opts.cursor === 'object' ? opts.cursor : undefined,
        this.pxPerSec,
        this.theme,
      );
    }

    if (opts.hover !== false) {
      this.hoverLine = new HoverLine(
        this.scrollContent,
        this.scrollViewport,
        this.spectrogramHeight,
        () => this._duration,
        () => this.pxPerSec,
        typeof opts.hover === 'object' ? opts.hover : undefined,
        this.theme,
      );
    }

    if (opts.regions !== false) {
      this.regionsLayer = new RegionsLayer(
        this.scrollContent,
        this.scrollViewport,
        this.spectrogramHeight,
        () => this._duration,
        this.pxPerSec,
        typeof opts.regions === 'object' ? opts.regions : undefined,
        this.theme,
      );
      this.wireRegionEvents();
    }

    // Emit click-to-seek on scrollContent
    this.scrollContent.addEventListener('click', this.onContentClick);

    // Listen to viewport scroll
    this.scrollViewport.addEventListener('scroll', () => {
      this.emit('scroll', this.scrollViewport.scrollLeft);
    });
  }

  /** Factory method – preferred entry point. */
  static create(opts: SpectroViewerOptions): SpectroViewer {
    return new SpectroViewer(opts);
  }

  // =========================================================================
  // Spectrogram data
  // =========================================================================

  loadSpectrogram(data: SpectrogramData): void {
    const totalDuration = data.totalDuration ?? data.files.reduce((s, f) => s + f.duration, 0);
    this._duration = totalDuration;

    this.spectrogramLayer.load(data);
    this.updateContentWidth();

    const contentWidth = Math.ceil(totalDuration * this.pxPerSec);
    this.freqGrid?.render(contentWidth);

    if (this.timeline) {
      this.timeline.render(totalDuration, this.pxPerSec);
    }

    this.emit('ready');
  }

  // =========================================================================
  // Media synchronization
  // =========================================================================

  syncMedia(media: HTMLMediaElement): void {
    if (this.mediaSync) this.mediaSync.destroy();

    this.mediaSync = new MediaSync(
      (time) => this.onTimeUpdate(time),
      () => { this._playing = true; this.emit('play'); },
      () => { this._playing = false; this.emit('pause'); },
      () => { this._playing = false; this.emit('finish'); },
      (dur) => {
        if (!this._duration || Math.abs(this._duration - dur) > 0.01) {
          this._duration = dur;
          this.updateContentWidth();
          const cw = Math.ceil(dur * this.pxPerSec);
          this.freqGrid?.render(cw);
          if (this.timeline) this.timeline.render(dur, this.pxPerSec);
        }
      },
    );
    this.mediaSync.attach(media);
  }

  // =========================================================================
  // Playback controls
  // =========================================================================

  play(): void { this.mediaSync?.play(); }
  pause(): void { this.mediaSync?.pause(); }
  playPause(): void { this.mediaSync?.playPause(); }

  setTime(time: number): void {
    if (this.mediaSync) {
      this.mediaSync.setTime(time);
    }
    this.onTimeUpdate(time);
  }

  get currentTime(): number { return this._currentTime; }
  get duration(): number { return this._duration; }
  get isPlaying(): boolean { return this._playing; }

  setPlaybackRate(rate: number): void { this.mediaSync?.setPlaybackRate(rate); }

  // =========================================================================
  // Zoom
  // =========================================================================

  zoom(pxPerSec: number): void {
    this.pxPerSec = pxPerSec;
    this.spectrogramLayer.updateZoom(pxPerSec);
    this.cursor?.updateZoom(pxPerSec);
    this.regionsLayer?.updateZoom(pxPerSec);
    this.updateContentWidth();

    const contentWidth = Math.ceil(this._duration * pxPerSec);
    this.freqGrid?.updateZoom(contentWidth);

    if (this.timeline) {
      this.timeline.render(this._duration, pxPerSec);
    }

    this.emit('zoom', pxPerSec);
  }

  getZoom(): number { return this.pxPerSec; }

  // =========================================================================
  // Scroll
  // =========================================================================

  scrollToTime(time: number, opts?: { center?: boolean; smooth?: boolean }): void {
    this.scrollManager.scrollToTime(time, this.pxPerSec, opts?.center ?? true, opts?.smooth);
  }

  setAutoScroll(enabled: boolean): void { this.scrollManager.autoScroll = enabled; }
  setAutoCenter(enabled: boolean): void { this.scrollManager.autoCenter = enabled; }

  // =========================================================================
  // Regions
  // =========================================================================

  addRegion(opts: RegionOptions): Region {
    if (!this.regionsLayer) throw new Error('[SpectroViewer] Regions are disabled');
    return this.regionsLayer.addRegion(opts);
  }

  removeRegion(id: string): void { this.regionsLayer?.removeRegion(id); }
  clearRegions(): void { this.regionsLayer?.clearRegions(); }
  getRegion(id: string): Region | undefined { return this.regionsLayer?.getRegion(id); }
  getRegions(): Region[] { return this.regionsLayer?.getRegions() ?? []; }
  selectRegion(id: string | null): void { this.regionsLayer?.selectRegion(id); }
  getSelectedRegion(): Region | null { return this.regionsLayer?.getSelectedRegion() ?? null; }

  enableDragSelection(): void { this.regionsLayer?.enableDragSelection(); }
  disableDragSelection(): void { this.regionsLayer?.disableDragSelection(); }

  // =========================================================================
  // Frequency axis
  // =========================================================================

  updateFrequencyAxis(config: Partial<FrequencyAxisConfig>): void {
    this.freqAxis?.update(config);
  }

  // =========================================================================
  // Internals
  // =========================================================================

  private onTimeUpdate(time: number): void {
    this._currentTime = time;
    this.cursor?.setTime(time);
    this.scrollManager.followCursor(time * this.pxPerSec, this._playing);
    this.emit('timeupdate', time);
  }

  private onContentClick = (e: MouseEvent): void => {
    if ((e.target as HTMLElement).closest('.sv-region')) return;
    const rect = this.scrollViewport.getBoundingClientRect();
    const x = e.clientX - rect.left + this.scrollViewport.scrollLeft;
    const time = Math.max(0, Math.min(this._duration, x / this.pxPerSec));
    this.setTime(time);
  };

  private updateContentWidth(): void {
    const w = Math.ceil(this._duration * this.pxPerSec);
    this.scrollContent.style.width = `${w}px`;
  }

  private wireRegionEvents(): void {
    if (!this.regionsLayer) return;
    const fwd = (local: string, viewerEvent: keyof SpectroViewerEvents) => {
      this.regionsLayer!.on(local as any, (...args: any[]) => {
        (this.emit as any)(viewerEvent, ...args);
      });
    };
    fwd('created', 'region:created');
    fwd('updated', 'region:updated');
    fwd('removed', 'region:removed');
    fwd('clicked', 'region:clicked');
    fwd('selected', 'region:selected');
    fwd('drag-start', 'region:drag-start');
    fwd('drag-end', 'region:drag-end');
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this.mediaSync?.destroy();
    this.hoverLine?.destroy();
    this.cursor?.destroy();
    this.regionsLayer?.destroy();
    this.freqGrid?.destroy();
    this.spectrogramLayer.destroy();
    this.timeline?.destroy();
    this.freqAxis?.destroy();
    this.scrollManager.destroy();

    this.scrollContent.removeEventListener('click', this.onContentClick);
    this.root.remove();
    this.removeAllListeners();

    this.emit('destroy');
  }
}
