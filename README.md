# SpectroViewer

Lightweight, framework-agnostic spectrogram viewer with regions, timeline, and media synchronization.

**~9 KB gzipped** – Built for bioacoustics, audio analysis, and anywhere you need to visualize pre-rendered spectrograms with interactive annotations.

## Features

- **Pre-rendered spectrogram images** – Load segmented WebP/PNG images with automatic lazy loading via IntersectionObserver
- **Interactive regions** – Draggable, resizable time-range annotations with full CRUD support
- **Timeline** – Adaptive time axis that adjusts tick density to the zoom level
- **Frequency axis** – Dynamic labels (auto-generated or explicit) with configurable Hz range
- **Playhead cursor** – Smooth cursor synced to media playback at 60 fps via requestAnimationFrame
- **Hover crosshair** – Shows precise time at pointer position
- **Media synchronization** – Attach any `<audio>` or `<video>` element for playback control
- **Auto-scroll / auto-center** – Keeps the playhead visible during playback
- **Zoom** – Pixels-per-second zoom with synchronized spectrogram, regions, and timeline
- **Dark / Light themes** – Built-in themes or fully custom color tokens
- **Zero dependencies** – Pure TypeScript, no runtime dependencies
- **Framework-agnostic** – Works with vanilla JS, Angular, React, Vue, Svelte, etc.

## Install

```bash
npm install spectro-viewer
```

Or use the UMD build via `<script>` tag:

```html
<script src="spectro-viewer.umd.cjs"></script>
```

## Quick Start

```typescript
import { SpectroViewer } from 'spectro-viewer';

const viewer = SpectroViewer.create({
  container: '#viewer',
  height: 400,
  pixelsPerSecond: 100,
  theme: 'dark',
  frequencyAxis: { min: 0, max: 125000 },
});

// Load pre-rendered spectrogram segments
viewer.loadSpectrogram({
  files: [
    { url: '/spectrograms/seg_0000.webp', startTime: 0, duration: 10, width: 2000, height: 400 },
    { url: '/spectrograms/seg_0001.webp', startTime: 10, duration: 10, width: 2000, height: 400 },
    // ...
  ],
  totalDuration: 120,
});

// Sync with a video/audio element
viewer.syncMedia(document.querySelector('video'));

// Add annotation regions
viewer.addRegion({
  id: 'detection-1',
  start: 5.2,
  end: 5.8,
  color: 'rgba(239, 68, 68, 0.15)',
  draggable: true,
  resizable: true,
  content: '<span class="badge">3</span>',
});

// Listen to events
viewer.on('region:created', (region) => {
  console.log('New region:', region.start, region.end);
});

viewer.on('region:updated', (region) => {
  console.log('Region moved/resized:', region.id);
});

viewer.on('timeupdate', (time) => {
  console.log('Current time:', time);
});
```

## API Reference

### `SpectroViewer.create(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `container` | `string \| HTMLElement` | *required* | CSS selector or element |
| `height` | `number` | `400` | Spectrogram area height in pixels |
| `pixelsPerSecond` | `number` | `100` | Initial zoom level |
| `duration` | `number` | – | Explicit duration (seconds) |
| `theme` | `'dark' \| 'light' \| ThemeColors` | `'dark'` | Color theme |
| `timeline` | `TimelineConfig \| false` | `{}` | Timeline settings or disabled |
| `frequencyAxis` | `FrequencyAxisConfig \| false` | `{}` | Frequency axis settings or disabled |
| `cursor` | `CursorConfig \| false` | `{}` | Playhead cursor settings or disabled |
| `hover` | `HoverConfig \| false` | `{}` | Hover crosshair settings or disabled |
| `scroll` | `ScrollConfig` | `{}` | Scroll behavior |
| `regions` | `RegionsConfig \| false` | `{}` | Regions settings or disabled |

### Methods

#### Spectrogram

- `loadSpectrogram(data: SpectrogramData)` – Load spectrogram image segments

#### Playback

- `syncMedia(element: HTMLMediaElement)` – Sync with audio/video element
- `play()` / `pause()` / `playPause()` – Playback controls
- `setTime(seconds)` – Seek to time
- `setPlaybackRate(rate)` – Set speed (0.25x, 0.5x, 1x, 2x, etc.)
- `currentTime` / `duration` / `isPlaying` – Read-only properties

#### Zoom & Scroll

- `zoom(pixelsPerSecond)` – Set zoom level
- `getZoom()` – Get current zoom level
- `scrollToTime(time, { center?, smooth? })` – Scroll to a specific time
- `setAutoScroll(enabled)` / `setAutoCenter(enabled)` – Toggle scroll behavior

#### Regions

- `addRegion(options: RegionOptions)` – Add annotation region
- `removeRegion(id)` – Remove a region
- `clearRegions()` – Remove all regions
- `getRegion(id)` / `getRegions()` – Query regions
- `selectRegion(id | null)` – Select/deselect a region
- `enableDragSelection()` / `disableDragSelection()` – Toggle drag-to-create

#### Frequency Axis

- `updateFrequencyAxis(config)` – Update axis labels/range dynamically

#### Lifecycle

- `destroy()` – Clean up and remove from DOM

### Events

| Event | Args | Description |
|-------|------|-------------|
| `ready` | – | Spectrogram loaded and viewer ready |
| `destroy` | – | Viewer destroyed |
| `timeupdate` | `time: number` | Current playback time changed |
| `zoom` | `pixelsPerSecond: number` | Zoom level changed |
| `scroll` | `scrollLeft: number` | Scroll position changed |
| `play` | – | Playback started |
| `pause` | – | Playback paused |
| `finish` | – | Playback reached end |
| `region:created` | `region: Region` | New region created (via drag-selection) |
| `region:updated` | `region: Region` | Region moved or resized |
| `region:removed` | `region: Region` | Region removed |
| `region:clicked` | `region: Region, event: MouseEvent` | Region clicked |
| `region:selected` | `region: Region \| null` | Region selection changed |
| `region:drag-start` | `region: Region` | Region drag started |
| `region:drag-end` | `region: Region` | Region drag ended |

## Frequency Axis Configuration

```typescript
// Auto-generated labels
SpectroViewer.create({
  frequencyAxis: { min: 0, max: 125000, labels: 'auto', labelCount: 6 }
});

// Explicit labels
SpectroViewer.create({
  frequencyAxis: { min: 0, max: 125000, labels: [0, 25000, 50000, 75000, 105000, 125000] }
});

// Custom formatter
SpectroViewer.create({
  frequencyAxis: {
    min: 0,
    max: 125000,
    formatLabel: (hz) => hz >= 1000 ? `${hz / 1000}k` : `${hz}`,
  }
});
```

## Custom Themes

```typescript
SpectroViewer.create({
  theme: {
    background: '#1a1a2e',
    text: '#e2e8f0',
    cursorColor: '#ef4444',
    regionColor: 'rgba(239, 68, 68, 0.15)',
    regionSelectedColor: 'rgba(59, 130, 246, 0.2)',
    // ... see ThemeColors type for all tokens
  }
});
```

## Use with Frameworks

### Angular

```typescript
@Component({ ... })
export class ViewerComponent implements AfterViewInit, OnDestroy {
  private viewer!: SpectroViewer;

  ngAfterViewInit() {
    this.viewer = SpectroViewer.create({ container: '#viewer' });
    this.viewer.loadSpectrogram(this.spectrogramData);
  }

  ngOnDestroy() {
    this.viewer.destroy();
  }
}
```

### React

```tsx
function Viewer({ spectrogramData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<SpectroViewer>();

  useEffect(() => {
    viewerRef.current = SpectroViewer.create({ container: containerRef.current! });
    viewerRef.current.loadSpectrogram(spectrogramData);
    return () => viewerRef.current?.destroy();
  }, []);

  return <div ref={containerRef} />;
}
```

## Generating Spectrograms

SpectroViewer expects pre-rendered image segments. You can generate them with any tool. Here's an example with Python + scipy:

```python
from scipy import signal
import matplotlib.pyplot as plt
import numpy as np

def generate_segment(audio, sample_rate, output_path, freq_max=125000):
    f, t, Sxx = signal.spectrogram(audio, fs=sample_rate, nperseg=4096, noverlap=3072)
    Sxx_db = 10 * np.log10(Sxx + 1e-10)
    
    fig, ax = plt.subplots(figsize=(len(audio)/sample_rate * 2, 4), dpi=100)
    ax.imshow(Sxx_db, aspect='auto', origin='lower', cmap='magma')
    ax.axis('off')
    fig.savefig(output_path, format='webp', bbox_inches='tight', pad_inches=0)
    plt.close(fig)
```

## License

MIT
