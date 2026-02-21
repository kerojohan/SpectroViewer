import type { Region, RegionOptions, RegionsConfig, ThemeColors } from '../types';
import { EventEmitter } from '../core/EventEmitter';

interface RegionEvents {
  created: [region: Region];
  updated: [region: Region];
  removed: [region: Region];
  clicked: [region: Region, event: MouseEvent];
  selected: [region: Region | null];
  'drag-start': [region: Region];
  'drag-end': [region: Region];
}

interface RegionInternal extends Region {
  _el: HTMLElement;
  _handleLeft: HTMLElement;
  _handleRight: HTMLElement;
  _contentEl: HTMLElement | null;
}

/**
 * Region layer: creates, manages, and renders draggable/resizable
 * time-range annotations on the spectrogram.
 */
export class RegionsLayer extends EventEmitter<RegionEvents> {
  private regions = new Map<string, RegionInternal>();
  private selectedId: string | null = null;
  private dragSelectionEnabled = false;
  private dragState: {
    type: 'move' | 'resize-left' | 'resize-right' | 'create';
    region?: RegionInternal;
    startX: number;
    origStart: number;
    origEnd: number;
  } | null = null;
  private config: Required<Pick<RegionsConfig, 'color' | 'selectedColor' | 'draggable' | 'resizable' | 'minLength' | 'dragSelectionColor'>>;
  private pxPerSec: number;

  constructor(
    private scrollContent: HTMLElement,
    private scrollViewport: HTMLElement,
    private spectrogramHeight: number,
    private getDuration: () => number,
    pxPerSec: number,
    configInput: RegionsConfig | undefined,
    private theme: ThemeColors,
  ) {
    super();
    this.pxPerSec = pxPerSec;

    const cfg = configInput ?? {};
    this.config = {
      color: cfg.color ?? theme.regionColor,
      selectedColor: cfg.selectedColor ?? theme.regionSelectedColor,
      draggable: cfg.draggable !== false,
      resizable: cfg.resizable !== false,
      minLength: cfg.minLength ?? 0.01,
      dragSelectionColor: cfg.dragSelectionColor ?? theme.regionColor,
    };

    if (cfg.dragSelection) this.enableDragSelection();

    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
  }

  addRegion(opts: RegionOptions): Region {
    if (this.regions.has(opts.id)) {
      this.removeRegion(opts.id);
    }

    const el = document.createElement('div');
    el.className = 'sv-region';
    el.dataset.regionId = opts.id;

    const handleLeft = document.createElement('div');
    handleLeft.className = 'sv-region-handle sv-region-handle-left';
    const handleRight = document.createElement('div');
    handleRight.className = 'sv-region-handle sv-region-handle-right';

    el.appendChild(handleLeft);
    el.appendChild(handleRight);

    let contentEl: HTMLElement | null = null;
    if (opts.content) {
      contentEl = document.createElement('div');
      contentEl.className = 'sv-region-content';
      if (typeof opts.content === 'string') {
        contentEl.innerHTML = opts.content;
      } else {
        contentEl.appendChild(opts.content);
      }
      el.appendChild(contentEl);
    }

    const region: RegionInternal = {
      ...opts,
      color: opts.color ?? this.config.color,
      selectedColor: opts.selectedColor ?? this.config.selectedColor,
      draggable: opts.draggable ?? this.config.draggable,
      resizable: opts.resizable ?? this.config.resizable,
      minLength: opts.minLength ?? this.config.minLength,
      selected: false,
      _el: el,
      _handleLeft: handleLeft,
      _handleRight: handleRight,
      _contentEl: contentEl,
      remove: () => this.removeRegion(opts.id),
      setOptions: (o) => this.updateRegion(opts.id, o),
      setContent: (c) => this.setRegionContent(opts.id, c),
    };

    this.applyRegionStyles(region);
    this.bindRegionEvents(region);

    this.scrollContent.appendChild(el);
    this.regions.set(opts.id, region);

    return region;
  }

  private applyRegionStyles(r: RegionInternal): void {
    const left = r.start * this.pxPerSec;
    const width = (r.end - r.start) * this.pxPerSec;
    const color = r.selected ? (r.selectedColor ?? this.config.selectedColor) : (r.color ?? this.config.color);

    Object.assign(r._el.style, {
      position: 'absolute',
      top: '0',
      left: `${left}px`,
      width: `${width}px`,
      height: `${this.spectrogramHeight}px`,
      background: color,
      cursor: r.draggable ? 'grab' : 'pointer',
      zIndex: '20',
      boxSizing: 'border-box',
    });

    const handleBase: Partial<CSSStyleDeclaration> = {
      position: 'absolute',
      top: '0',
      width: '5px',
      height: '100%',
      cursor: 'ew-resize',
      zIndex: '21',
      background: 'transparent',
    };

    Object.assign(r._handleLeft.style, { ...handleBase, left: '0' });
    Object.assign(r._handleRight.style, { ...handleBase, right: '0' });

    if (!r.resizable) {
      r._handleLeft.style.display = 'none';
      r._handleRight.style.display = 'none';
    }

    if (r._contentEl) {
      Object.assign(r._contentEl.style, {
        position: 'relative',
        overflow: 'visible',
        pointerEvents: 'none',
        padding: '0',
        height: '100%',
      });
    }
  }

  private bindRegionEvents(r: RegionInternal): void {
    r._el.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();

      const target = e.target as HTMLElement;
      const rect = this.scrollViewport.getBoundingClientRect();
      const startX = e.clientX - rect.left + this.scrollViewport.scrollLeft;

      if (r.resizable && target === r._handleLeft) {
        this.dragState = { type: 'resize-left', region: r, startX, origStart: r.start, origEnd: r.end };
      } else if (r.resizable && target === r._handleRight) {
        this.dragState = { type: 'resize-right', region: r, startX, origStart: r.start, origEnd: r.end };
      } else if (r.draggable) {
        this.dragState = { type: 'move', region: r, startX, origStart: r.start, origEnd: r.end };
        r._el.style.cursor = 'grabbing';
      }

      if (this.dragState) {
        this.emit('drag-start', r);
      }
    });

    r._el.addEventListener('click', (e: MouseEvent) => {
      if (this.dragState) return;
      e.stopPropagation();
      this.selectRegion(r.id);
      this.emit('clicked', r, e);
    });
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragState) return;
    e.preventDefault();

    const rect = this.scrollViewport.getBoundingClientRect();
    const currentX = e.clientX - rect.left + this.scrollViewport.scrollLeft;
    const deltaTime = (currentX - this.dragState.startX) / this.pxPerSec;
    const duration = this.getDuration();
    const minLen = this.dragState.region?.minLength ?? this.config.minLength;

    if (this.dragState.type === 'create') {
      // Handled in drag-selection flow
      return;
    }

    const r = this.dragState.region!;

    if (this.dragState.type === 'move') {
      const len = this.dragState.origEnd - this.dragState.origStart;
      let newStart = this.dragState.origStart + deltaTime;
      newStart = Math.max(0, Math.min(duration - len, newStart));
      r.start = newStart;
      r.end = newStart + len;
    } else if (this.dragState.type === 'resize-left') {
      r.start = Math.max(0, Math.min(r.end - minLen, this.dragState.origStart + deltaTime));
    } else if (this.dragState.type === 'resize-right') {
      r.end = Math.min(duration, Math.max(r.start + minLen, this.dragState.origEnd + deltaTime));
    }

    this.applyRegionStyles(r);
  };

  private onPointerUp = (): void => {
    if (!this.dragState) return;
    const r = this.dragState.region;
    this.dragState = null;

    if (r) {
      r._el.style.cursor = r.draggable ? 'grab' : 'pointer';
      this.emit('drag-end', r);
      this.emit('updated', r);
    }
  };

  // -- Drag selection (create new regions by dragging on the spectrogram) ---

  enableDragSelection(): void {
    if (this.dragSelectionEnabled) return;
    this.dragSelectionEnabled = true;
    this.scrollContent.addEventListener('pointerdown', this.onDragSelectionStart);
  }

  disableDragSelection(): void {
    this.dragSelectionEnabled = false;
    this.scrollContent.removeEventListener('pointerdown', this.onDragSelectionStart);
    this.scrollContent.style.cursor = '';
  }

  private dragSelectionPreview: HTMLElement | null = null;
  private dragSelectionStartTime = 0;

  private onDragSelectionStart = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.sv-region')) return;

    const rect = this.scrollViewport.getBoundingClientRect();
    const x = e.clientX - rect.left + this.scrollViewport.scrollLeft;
    const time = x / this.pxPerSec;
    this.dragSelectionStartTime = time;

    this.dragSelectionPreview = document.createElement('div');
    this.dragSelectionPreview.className = 'sv-region sv-region-preview';
    Object.assign(this.dragSelectionPreview.style, {
      position: 'absolute',
      top: '0',
      height: `${this.spectrogramHeight}px`,
      background: this.config.dragSelectionColor,
      zIndex: '19',
      pointerEvents: 'none',
      left: `${x}px`,
      width: '0px',
    });
    this.scrollContent.appendChild(this.dragSelectionPreview);

    const onMove = (ev: PointerEvent) => {
      if (!this.dragSelectionPreview) return;
      const cx = ev.clientX - rect.left + this.scrollViewport.scrollLeft;
      const minX = Math.min(x, cx);
      const maxX = Math.max(x, cx);
      this.dragSelectionPreview.style.left = `${minX}px`;
      this.dragSelectionPreview.style.width = `${maxX - minX}px`;
    };

    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);

      if (this.dragSelectionPreview) {
        this.dragSelectionPreview.remove();
        this.dragSelectionPreview = null;
      }

      const cx = ev.clientX - rect.left + this.scrollViewport.scrollLeft;
      const endTime = cx / this.pxPerSec;
      const start = Math.max(0, Math.min(this.dragSelectionStartTime, endTime));
      const end = Math.min(this.getDuration(), Math.max(this.dragSelectionStartTime, endTime));

      if (end - start >= this.config.minLength) {
        const id = `region-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const region = this.addRegion({
          id,
          start,
          end,
          color: this.config.color,
          draggable: this.config.draggable,
          resizable: this.config.resizable,
        });
        this.emit('created', region);
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  // -- Public API -----------------------------------------------------------

  getRegion(id: string): Region | undefined {
    return this.regions.get(id);
  }

  getRegions(): Region[] {
    return [...this.regions.values()];
  }

  removeRegion(id: string): void {
    const r = this.regions.get(id);
    if (!r) return;
    r._el.remove();
    this.regions.delete(id);
    if (this.selectedId === id) {
      this.selectedId = null;
      this.emit('selected', null as any);
    }
    this.emit('removed', r);
  }

  clearRegions(): void {
    for (const r of this.regions.values()) {
      r._el.remove();
    }
    this.regions.clear();
    this.selectedId = null;
  }

  updateRegion(id: string, opts: Partial<RegionOptions>): void {
    const r = this.regions.get(id);
    if (!r) return;
    if (opts.start !== undefined) r.start = opts.start;
    if (opts.end !== undefined) r.end = opts.end;
    if (opts.color !== undefined) r.color = opts.color;
    if (opts.selectedColor !== undefined) r.selectedColor = opts.selectedColor;
    if (opts.draggable !== undefined) r.draggable = opts.draggable;
    if (opts.resizable !== undefined) r.resizable = opts.resizable;
    if (opts.data !== undefined) r.data = opts.data;
    if (opts.content !== undefined) this.setRegionContent(id, opts.content as string | HTMLElement);
    this.applyRegionStyles(r);
  }

  private setRegionContent(id: string, content: string | HTMLElement): void {
    const r = this.regions.get(id);
    if (!r) return;

    if (r._contentEl) {
      r._contentEl.remove();
      r._contentEl = null;
    }

    const el = document.createElement('div');
    el.className = 'sv-region-content';
    if (typeof content === 'string') {
      el.innerHTML = content;
    } else {
      el.appendChild(content);
    }
    Object.assign(el.style, {
      position: 'relative',
      overflow: 'visible',
      pointerEvents: 'none',
      padding: '0',
      height: '100%',
    });
    r._el.appendChild(el);
    r._contentEl = el;
  }

  selectRegion(id: string | null): void {
    if (this.selectedId) {
      const prev = this.regions.get(this.selectedId);
      if (prev) {
        prev.selected = false;
        this.applyRegionStyles(prev);
      }
    }

    this.selectedId = id;

    if (id) {
      const r = this.regions.get(id);
      if (r) {
        r.selected = true;
        this.applyRegionStyles(r);
        this.emit('selected', r);
        return;
      }
    }
    this.emit('selected', null as any);
  }

  getSelectedRegion(): Region | null {
    return this.selectedId ? this.regions.get(this.selectedId) ?? null : null;
  }

  updateZoom(pxPerSec: number): void {
    this.pxPerSec = pxPerSec;
    for (const r of this.regions.values()) {
      this.applyRegionStyles(r);
    }
  }

  destroy(): void {
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
    this.disableDragSelection();
    this.clearRegions();
    this.removeAllListeners();
  }
}
