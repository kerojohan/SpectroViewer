/**
 * Synchronizes the SpectroViewer cursor and playback state with an
 * HTMLMediaElement (audio or video).
 *
 * This is intentionally a thin adapter so that the viewer stays
 * framework-agnostic and media-source-agnostic.
 *
 * When `offsetSec` is provided the adapter transparently translates between
 * *media time* (0-based, as reported by the HTMLMediaElement) and *absolute
 * timeline time* (media time + offsetSec).  The viewer always works in
 * absolute time; the media element always receives media-local time.
 */
export class MediaSync {
  private media: HTMLMediaElement | null = null;
  private raf: number | null = null;
  private destroyed = false;

  constructor(
    private onTimeUpdate: (time: number) => void,
    private onPlay: () => void,
    private onPause: () => void,
    private onFinish: () => void,
    private onDurationChange: (duration: number) => void,
    /** Seconds to add to every media-element timestamp to obtain the
     *  absolute position on the spectrogram timeline. */
    private offsetSec: number = 0,
  ) {}

  attach(media: HTMLMediaElement): void {
    this.detach();
    this.media = media;

    media.addEventListener('play', this.handlePlay);
    media.addEventListener('pause', this.handlePause);
    media.addEventListener('ended', this.handleEnded);
    media.addEventListener('durationchange', this.handleDurationChange);
    media.addEventListener('seeked', this.handleSeeked);

    if (media.duration && Number.isFinite(media.duration)) {
      this.onDurationChange(media.duration + this.offsetSec);
    }

    if (!media.paused) {
      this.startLoop();
      this.onPlay();
    }
  }

  detach(): void {
    if (this.media) {
      this.media.removeEventListener('play', this.handlePlay);
      this.media.removeEventListener('pause', this.handlePause);
      this.media.removeEventListener('ended', this.handleEnded);
      this.media.removeEventListener('durationchange', this.handleDurationChange);
      this.media.removeEventListener('seeked', this.handleSeeked);
    }
    this.stopLoop();
    this.media = null;
  }

  // -- Playback controls forwarded to the media element ---------------------

  play(): void { this.media?.play(); }
  pause(): void { this.media?.pause(); }

  playPause(): void {
    if (!this.media) return;
    if (this.media.paused) this.media.play(); else this.media.pause();
  }

  /** Seek to an *absolute* timeline position (offsetSec is subtracted internally). */
  setTime(absoluteTime: number): void {
    if (!this.media) return;
    const mediaTime = absoluteTime - this.offsetSec;
    const dur = this.media.duration;
    this.media.currentTime = Math.max(
      0,
      Number.isFinite(dur) ? Math.min(dur, mediaTime) : mediaTime,
    );
  }

  /** Returns the current position as an *absolute* timeline time. */
  getTime(): number {
    return (this.media?.currentTime ?? 0) + this.offsetSec;
  }

  /** Returns the absolute end time of the attached media clip. */
  getDuration(): number {
    const d = this.media?.duration;
    return d && Number.isFinite(d) ? d + this.offsetSec : 0;
  }

  setPlaybackRate(rate: number): void {
    if (this.media) this.media.playbackRate = rate;
  }

  isPlaying(): boolean {
    return this.media ? !this.media.paused : false;
  }

  // -- Internal event handlers ----------------------------------------------

  private handlePlay = (): void => {
    this.startLoop();
    this.onPlay();
  };

  private handlePause = (): void => {
    this.stopLoop();
    this.onTimeUpdate((this.media?.currentTime ?? 0) + this.offsetSec);
    this.onPause();
  };

  private handleEnded = (): void => {
    this.stopLoop();
    this.onFinish();
  };

  private handleDurationChange = (): void => {
    const d = this.media?.duration;
    if (d && Number.isFinite(d)) this.onDurationChange(d + this.offsetSec);
  };

  private handleSeeked = (): void => {
    this.onTimeUpdate((this.media?.currentTime ?? 0) + this.offsetSec);
  };

  /**
   * Use rAF loop during playback for smooth cursor updates (~60 fps)
   * instead of the less frequent `timeupdate` event (~4 Hz).
   */
  private startLoop(): void {
    this.stopLoop();
    const tick = () => {
      if (this.destroyed || !this.media || this.media.paused) return;
      this.onTimeUpdate(this.media.currentTime + this.offsetSec);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.detach();
  }
}
