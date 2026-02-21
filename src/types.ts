// ---------------------------------------------------------------------------
// SpectroViewer – Public type definitions
// ---------------------------------------------------------------------------

/** Descriptor for a single pre-rendered spectrogram image segment. */
export interface SpectrogramFileDescriptor {
  /** URL or path to the image (WebP, PNG, JPEG …). */
  url: string;
  /** Width in pixels at the native resolution. */
  width: number;
  /** Height in pixels at the native resolution. */
  height: number;
  /** Time offset in seconds where this segment begins. */
  startTime: number;
  /** Duration in seconds covered by this segment. */
  duration: number;
}

/** Payload passed to `viewer.loadSpectrogram()`. */
export interface SpectrogramData {
  files: SpectrogramFileDescriptor[];
  /** Total duration in seconds (if omitted, calculated from files). */
  totalDuration?: number;
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
