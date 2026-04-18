import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaSync } from './MediaSync';

// Minimal HTMLMediaElement stub
function makeMedia(overrides: Partial<HTMLMediaElement> = {}): HTMLMediaElement {
  const listeners: Record<string, EventListenerOrEventListenerObject[]> = {};
  const el = {
    currentTime: 0,
    duration: 10,
    paused: true,
    playbackRate: 1,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    addEventListener: vi.fn((type: string, fn: EventListenerOrEventListenerObject) => {
      (listeners[type] ??= []).push(fn);
    }),
    removeEventListener: vi.fn(),
    _emit(type: string) {
      listeners[type]?.forEach((fn) =>
        typeof fn === 'function' ? fn(new Event(type)) : fn.handleEvent(new Event(type)),
      );
    },
    ...overrides,
  } as unknown as HTMLMediaElement & { _emit(type: string): void };
  return el;
}

type Callbacks = {
  onTimeUpdate: ReturnType<typeof vi.fn>;
  onPlay: ReturnType<typeof vi.fn>;
  onPause: ReturnType<typeof vi.fn>;
  onFinish: ReturnType<typeof vi.fn>;
  onDurationChange: ReturnType<typeof vi.fn>;
};

function makeSync(offsetSec = 0): { sync: MediaSync; cb: Callbacks } {
  const cb: Callbacks = {
    onTimeUpdate: vi.fn(),
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onFinish: vi.fn(),
    onDurationChange: vi.fn(),
  };
  const sync = new MediaSync(
    cb.onTimeUpdate,
    cb.onPlay,
    cb.onPause,
    cb.onFinish,
    cb.onDurationChange,
    offsetSec,
  );
  return { sync, cb };
}

// ---------------------------------------------------------------------------

describe('MediaSync – no offset', () => {
  it('getTime returns media.currentTime', () => {
    const { sync } = makeSync(0);
    const media = makeMedia({ currentTime: 5 } as Partial<HTMLMediaElement>);
    sync.attach(media);
    expect(sync.getTime()).toBe(5);
  });

  it('setTime sets media.currentTime directly', () => {
    const { sync } = makeSync(0);
    const media = makeMedia();
    sync.attach(media);
    sync.setTime(3.5);
    expect(media.currentTime).toBe(3.5);
  });

  it('seeked event fires onTimeUpdate with media.currentTime', () => {
    const { sync, cb } = makeSync(0);
    const media = makeMedia() as HTMLMediaElement & { _emit(t: string): void };
    sync.attach(media);
    (media as any).currentTime = 4;
    (media as any)._emit('seeked');
    expect(cb.onTimeUpdate).toHaveBeenCalledWith(4);
  });

  it('durationchange fires onDurationChange with media.duration', () => {
    const { sync, cb } = makeSync(0);
    const media = makeMedia() as HTMLMediaElement & { _emit(t: string): void };
    sync.attach(media);
    (media as any)._emit('durationchange');
    expect(cb.onDurationChange).toHaveBeenCalledWith(10);
  });

  it('getDuration returns media.duration', () => {
    const { sync } = makeSync(0);
    const media = makeMedia();
    sync.attach(media);
    expect(sync.getDuration()).toBe(10);
  });
});

// ---------------------------------------------------------------------------

describe('MediaSync – with offsetSec', () => {
  let media: HTMLMediaElement & { _emit(t: string): void };
  let sync: MediaSync;
  let cb: Callbacks;

  beforeEach(() => {
    ({ sync, cb } = makeSync(12.3));
    media = makeMedia() as HTMLMediaElement & { _emit(t: string): void };
    sync.attach(media);
  });

  it('getTime returns media.currentTime + offsetSec', () => {
    (media as any).currentTime = 2;
    expect(sync.getTime()).toBe(14.3);
  });

  it('getDuration returns media.duration + offsetSec', () => {
    expect(sync.getDuration()).toBeCloseTo(22.3);
  });

  it('setTime translates absolute → media time', () => {
    sync.setTime(14.3);
    expect(media.currentTime).toBeCloseTo(2);
  });

  it('seeked fires onTimeUpdate with absolute time', () => {
    (media as any).currentTime = 1.5;
    media._emit('seeked');
    expect(cb.onTimeUpdate).toHaveBeenCalledWith(1.5 + 12.3);
  });

  it('durationchange fires onDurationChange with absolute duration', () => {
    media._emit('durationchange');
    expect(cb.onDurationChange).toHaveBeenCalledWith(10 + 12.3);
  });

  it('attach fires onDurationChange with absolute duration when already loaded', () => {
    // cb already received it on attach in beforeEach
    expect(cb.onDurationChange).toHaveBeenCalledWith(10 + 12.3);
  });
});

// ---------------------------------------------------------------------------

describe('MediaSync – clamp behaviour', () => {
  it('setTime below offsetSec clamps media.currentTime to 0', () => {
    const { sync } = makeSync(12.3);
    const media = makeMedia();
    sync.attach(media);
    sync.setTime(0); // absoluteTime 0 < offsetSec 12.3 → mediaTime negative → clamp to 0
    expect(media.currentTime).toBe(0);
  });

  it('setTime above media.duration clamps to media.duration', () => {
    const { sync } = makeSync(0);
    const media = makeMedia({ duration: 5 } as Partial<HTMLMediaElement>);
    sync.attach(media);
    sync.setTime(99);
    expect(media.currentTime).toBe(5);
  });

  it('setTime above absolute end (offsetSec + duration) clamps to media.duration', () => {
    const { sync } = makeSync(12.3);
    const media = makeMedia({ duration: 5 } as Partial<HTMLMediaElement>);
    sync.attach(media);
    sync.setTime(999);
    expect(media.currentTime).toBe(5);
  });

  it('setTime with infinite duration does not clamp upper bound', () => {
    const { sync } = makeSync(0);
    const media = makeMedia({ duration: Infinity } as Partial<HTMLMediaElement>);
    sync.attach(media);
    sync.setTime(9999);
    expect(media.currentTime).toBe(9999);
  });
});
