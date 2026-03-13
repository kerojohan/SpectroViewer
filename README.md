# SpectroViewer

Framework-agnostic spectrogram viewer with regions, timeline, frequency axis,
and media synchronization.

This branch, `spectrogram-v2-ratpenats`, is the Ratpenats fork. It no longer
expects pre-rendered spectrogram images. It renders spectrogram data tiles on
`canvas` from quantized spectral data delivered by the backend.

![SpectroViewer – dark theme with frequency grid](docs/screenshot-dark.png)

## Branch Scope

This branch diverges from upstream in one important way:

- Upstream: spectrogram image segments (`webp/png/jpeg`)
- This branch: spectrogram data tiles (`uint8`) + `metadata.v2.json`

The interaction model is still the same:

- timeline
- cursor
- frequency axis
- frequency grid
- regions
- audio/video sync
- scroll and zoom

## Spectrogram v2 Format

The viewer expects metadata shaped like this:

```json
{
  "format": "spectrogram-v2",
  "version": 2,
  "sampleRate": 250000,
  "fftSize": 4096,
  "hopLength": 128,
  "freqMin": 0,
  "freqMax": 125000,
  "bins": 1024,
  "dbMin": -110.0,
  "dbMax": -20.0,
  "tileDuration": 5.0,
  "totalDuration": 60.0,
  "tileFormat": {
    "encoding": "raw",
    "dtype": "uint8",
    "layout": "time-major",
    "endianness": "little"
  },
  "tiles": [
    {
      "index": 0,
      "file": "/api/sessions/123/spectrogram/tile/tiles/tile_000000.bin",
      "startTime": 0.0,
      "endTime": 5.0,
      "duration": 5.0,
      "frames": 2048,
      "bins": 1024
    }
  ]
}
```

Tile contract:

- Each tile is a `Uint8Array`
- Layout is `time-major`
- Size must be exactly `frames * bins`
- Values are expected to already be normalized to `0..255`

## Install

```bash
npm install spectro-viewer
```

For this branch in Ratpenats:

```bash
npm install https://codeload.github.com/kerojohan/SpectroViewer/tar.gz/refs/heads/spectrogram-v2-ratpenats
```

## Quick Start

```ts
import { SpectroViewer } from 'spectro-viewer';

const viewer = SpectroViewer.create({
  container: '#viewer',
  height: 400,
  pixelsPerSecond: 100,
  theme: 'dark',
  frequencyAxis: { min: 0, max: 125000 },
});

const metadata = await fetch('/api/sessions/123/spectrogram/metadata').then((r) => r.json());

viewer.loadSpectrogramData({
  ...metadata,
  lazyLoad: true,
  lazyMargin: 300,
});

viewer.syncMedia(document.querySelector('video')!);

viewer.addRegion({
  id: 'detection-1',
  start: 5.2,
  end: 5.8,
  color: 'rgba(239, 68, 68, 0.15)',
  draggable: true,
  resizable: true,
});
```

## API Reference

### `SpectroViewer.create(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `container` | `string \| HTMLElement` | required | CSS selector or element |
| `height` | `number` | `400` | Spectrogram area height in pixels |
| `pixelsPerSecond` | `number` | `100` | Initial zoom level |
| `duration` | `number` | – | Explicit duration in seconds |
| `theme` | `'dark' \| 'light' \| ThemeColors` | `'dark'` | Color theme |
| `timeline` | `TimelineConfig \| false` | `{}` | Timeline settings or disabled |
| `frequencyAxis` | `FrequencyAxisConfig \| false` | `{}` | Frequency axis settings or disabled |
| `cursor` | `CursorConfig \| false` | `{}` | Playhead cursor settings or disabled |
| `hover` | `HoverConfig \| false` | `{}` | Hover crosshair settings or disabled |
| `scroll` | `ScrollConfig` | `{}` | Scroll behavior |
| `frequencyGrid` | `FrequencyGridConfig \| false` | `{}` | Frequency grid lines or disabled |
| `regions` | `RegionsConfig \| false` | `{}` | Regions settings or disabled |

### Spectrogram Methods

- `loadSpectrogram(data: SpectrogramData)` – Load spectrogram v2 metadata
- `loadSpectrogramData(data: SpectrogramData)` – Alias for the same operation

### Playback Methods

- `syncMedia(element: HTMLMediaElement)`
- `play()`
- `pause()`
- `playPause()`
- `setTime(seconds)`
- `setPlaybackRate(rate)`
- `currentTime`
- `duration`
- `isPlaying`

### Zoom and Scroll Methods

- `zoom(pixelsPerSecond)`
- `getZoom()`
- `scrollToTime(time, { center?, smooth? })`
- `setAutoScroll(enabled)`
- `setAutoCenter(enabled)`

### Region Methods

- `addRegion(options)`
- `removeRegion(id)`
- `clearRegions()`
- `getRegion(id)`
- `getRegions()`
- `selectRegion(id | null)`
- `enableDragSelection()`
- `disableDragSelection()`

### Events

- `ready`
- `destroy`
- `timeupdate`
- `zoom`
- `scroll`
- `play`
- `pause`
- `finish`
- `region:created`
- `region:updated`
- `region:removed`
- `region:clicked`
- `region:selected`
- `region:drag-start`
- `region:drag-end`

## Rendering Notes

This branch renders spectrogram data this way:

1. Tiles are fetched lazily from the backend.
2. Raw `uint8` values are decoded from `ArrayBuffer`.
3. A color lookup table is applied on the client.
4. The tile is painted into a `canvas`.

Current limitations of this branch:

- The built-in renderer currently uses a magma-style LUT.
- Tile encoding is expected to be raw `uint8`.
- Compression-aware tile decoders such as `zstd` are not implemented yet.

## Ratpenats Integration

This branch was created for `RatpenatsSpectroViewer`.

Expected backend endpoints:

- `GET /api/sessions/{id}/spectrogram/metadata`
- `GET /api/sessions/{id}/spectrogram/tile/{filename}`

Expected metadata file:

- `spectroviewer/metadata.v2.json`

## Development

```bash
npm install
npm run build
```
