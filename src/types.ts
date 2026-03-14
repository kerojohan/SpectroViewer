// ---------------------------------------------------------------------------
// SpectroViewer – Public type definitions
// ---------------------------------------------------------------------------

export interface SpectrogramTileDescriptor {
  /** Tile URL, already rewritten by the API to a fetchable endpoint. */
  file: string;
  /** Time offset in seconds where this tile begins. */
  startTime: number;
  /** End time in seconds for this tile. */
  endTime: number;
  /** Duration in seconds covered by this tile. */
  duration: number;
  /** Number of time frames encoded in the tile. */
  frames: number;
  /** Number of frequency bins encoded in the tile. */
  bins: number;
}

export interface SpectrogramTileFormat {
  encoding: 'raw' | 'zstd';
  dtype: 'uint8';
  layout: 'time-major';
  endianness?: 'little' | 'big';
}

export type SpectrogramColorMap =
  | 'magma'
  | 'inferno'
  | 'viridis'
  | 'plasma'
  | 'turbo'
  | 'gray'
  | 'gray-inverse'
  | 'chiroptera';

export interface FrequencyEmphasis {
  /** Lower frequency bound in Hz. */
  minHz: number;
  /** Upper frequency bound in Hz. */
  maxHz: number;
  /** Intensity multiplier applied to values in this range (default `1.5`). */
  boost?: number;
  /** Minimum frequency of the data in Hz (default `0`). */
  dataMinHz?: number;
  /** Maximum frequency of the data in Hz (default `125000`). */
  dataMaxHz?: number;
}

export interface SpectrogramRenderConfig {
  /** Client-side palette used to colorize uint8 values. */
  colormap?: SpectrogramColorMap;
  /** Extra pixels rendered beyond the viewport during scroll/seek. */
  prefetchMargin?: number;
  /** Boost signal intensity in a specific frequency range. */
  frequencyEmphasis?: FrequencyEmphasis;
}

/** Payload passed to `viewer.loadSpectrogram()` in the v2 data-tile format. */
export interface SpectrogramData {
  format: 'spectrogram-v2';
  version: number;
  audioFile?: string;
  sampleRate: number;
  fftSize: number;
  hopLength: number;
  window?: string;
  freqMin: number;
  freqMax: number;
  bins: number;
  dbMin: number;
  dbMax: number;
  tileDuration: number;
  framesPerTile?: number;
  bytesPerTile?: number;
  height?: number;
  minPixelsPerSecond?: number;
  totalDuration: number;
  tileFormat: SpectrogramTileFormat;
  tiles: SpectrogramTileDescriptor[];
  colormap?: SpectrogramColorMap;
  /** Enable lazy-loading via IntersectionObserver (default `true`). */
  lazyLoad?: boolean;
  /** Pre-load margin in pixels for lazy loading (default `300`). */
  lazyMargin?: number;
}

// -- Regions ----------------------------------------------------------------

export interface RegionOptions {
  id: string;
  start: number;
  end: number;
  color?: string;
  selectedColor?: string;
  draggable?: boolean;
  resizable?: boolean;
  /** Minimum region duration in seconds (default `0.01`). */
  minLength?: number;
  /** Arbitrary data attached to the region. */
  data?: Record<string, unknown>;
  /** HTML string or element injected inside the region. */
  content?: string | HTMLElement;
}

export interface Region extends RegionOptions {
  /** Remove this region from the viewer. */
  remove(): void;
  /** Update region properties. */
  setOptions(opts: Partial<RegionOptions>): void;
  /** Update the content element. */
  setContent(content: string | HTMLElement): void;
  /** Whether this region is currently selected. */
  selected: boolean;
}

// -- Configuration ----------------------------------------------------------

export interface TimelineConfig {
  height?: number;
  primaryColor?: string;
  secondaryColor?: string;
  fontColor?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface FrequencyAxisConfig {
  /** Minimum frequency in Hz (default `0`). */
  min?: number;
  /** Maximum frequency in Hz. */
  max?: number;
  /**
   * `'auto'` generates evenly-spaced labels.
   * An array provides explicit values in Hz.
   */
  labels?: 'auto' | number[];
  /** Number of labels when `labels` is `'auto'` (default `6`). */
  labelCount?: number;
  /** Width reserved for the axis in pixels (default `55`). */
  width?: number;
  /** Format function: receives Hz, returns display string. */
  formatLabel?: (hz: number) => string;
}

export interface FrequencyBandHighlight {
  /** Lower bound in Hz. */
  minHz: number;
  /** Upper bound in Hz. */
  maxHz: number;
  /** Fill color for the band (default `'rgba(255, 200, 40, 0.07)'`). */
  fillColor?: string;
  /** Border line color (default `'rgba(255, 200, 40, 0.6)'`). */
  borderColor?: string;
  /** Border line width (default `1.5`). */
  borderWidth?: number;
  /** Optional label shown inside the band. */
  label?: string;
  /** Label color (default matches borderColor). */
  labelColor?: string;
}

export interface FrequencyGridConfig {
  /** Explicit Hz values to draw lines at, or `'auto'` to derive from freq axis. */
  lines?: 'auto' | number[];
  /** Line color (default from theme). */
  color?: string;
  /** Line opacity 0–1 (default `0.35`). */
  opacity?: number;
  /** Line width in CSS pixels (default `1`). */
  lineWidth?: number;
  /** Dash pattern `[dash, gap]` or `null` for solid (default `[4, 4]`). */
  dashPattern?: [number, number] | null;
  /** Show frequency labels next to lines (default `true`). */
  showLabels?: boolean;
  /** Custom label formatter. */
  formatLabel?: (hz: number) => string;
  /** Highlighted frequency band(s) rendered as a tinted overlay. */
  highlightBands?: FrequencyBandHighlight[];
}

export interface CursorConfig {
  color?: string;
  width?: number;
}

export interface HoverConfig {
  enabled?: boolean;
  color?: string;
  labelBackground?: string;
  labelColor?: string;
  showTime?: boolean;
  /** Custom time formatter for the hover label. */
  formatTime?: (seconds: number) => string;
}

export interface ScrollConfig {
  autoScroll?: boolean;
  autoCenter?: boolean;
}

export interface RegionsConfig {
  /** Default color for new regions. */
  color?: string;
  /** Default selected color. */
  selectedColor?: string;
  draggable?: boolean;
  resizable?: boolean;
  /** Allow creating regions by dragging on the spectrogram. */
  dragSelection?: boolean;
  /** Color used for drag-selection preview. */
  dragSelectionColor?: string;
  /** Minimum length in seconds for new regions. */
  minLength?: number;
}

export type ThemeName = 'dark' | 'light';

export interface ThemeColors {
  background: string;
  text: string;
  textMuted: string;
  timelineBackground: string;
  timelineText: string;
  timelineLine: string;
  freqAxisBackground: string;
  freqAxisText: string;
  freqAxisHighlight: string;
  freqGridLine: string;
  freqGridLabel: string;
  cursorColor: string;
  hoverLineColor: string;
  hoverLabelBg: string;
  hoverLabelText: string;
  regionColor: string;
  regionSelectedColor: string;
  regionHandleColor: string;
  scrollbarThumb: string;
  scrollbarTrack: string;
}

export interface SpectroViewerOptions {
  /** CSS selector string or HTMLElement. */
  container: string | HTMLElement;
  /** Height in pixels of the spectrogram area (default `400`). */
  height?: number;
  /** Initial pixels-per-second zoom level (default `100`). */
  pixelsPerSecond?: number;
  /** Explicit duration in seconds (if known ahead of time). */
  duration?: number;

  timeline?: TimelineConfig | false;
  frequencyAxis?: FrequencyAxisConfig | false;
  frequencyGrid?: FrequencyGridConfig | false;
  cursor?: CursorConfig | false;
  hover?: HoverConfig | false;
  scroll?: ScrollConfig;
  regions?: RegionsConfig | false;
  spectrogram?: SpectrogramRenderConfig;

  theme?: ThemeName | ThemeColors;
}

// -- Events -----------------------------------------------------------------

export interface SpectroViewerEvents {
  ready: [];
  destroy: [];
  timeupdate: [time: number];
  zoom: [pixelsPerSecond: number];
  scroll: [scrollLeft: number];

  'region:created': [region: Region];
  'region:updated': [region: Region];
  'region:removed': [region: Region];
  'region:clicked': [region: Region, event: MouseEvent];
  'region:selected': [region: Region | null];
  'region:drag-start': [region: Region];
  'region:drag-end': [region: Region];

  play: [];
  pause: [];
  finish: [];
}
