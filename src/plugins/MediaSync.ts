/**
 * Synchronizes the SpectroViewer cursor and playback state with an
 * HTMLMediaElement (audio or video).
 *
 * This is intentionally a thin adapter so that the viewer stays
 * framework-agnostic and media-source-agnostic.
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
      this.onDurationChange(media.duration);
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

  setTime(time: number): void {
    if (this.media) this.media.currentTime = time;
  }

  getTime(): number {
    return this.media?.currentTime ?? 0;
  }

  getDuration(): number {
    const d = this.media?.duration;
    return d && Number.isFinite(d) ? d : 0;
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
    this.onTimeUpdate(this.media?.currentTime ?? 0);
    this.onPause();
  };

  private handleEnded = (): void => {
    this.stopLoop();
    this.onFinish();
  };

  private handleDurationChange = (): void => {
    const d = this.media?.duration;
    if (d && Number.isFinite(d)) this.onDurationChange(d);
  };

  private handleSeeked = (): void => {
    this.onTimeUpdate(this.media?.currentTime ?? 0);
  };

  /**
   * Use rAF loop during playback for smooth cursor updates (~60 fps)
   * instead of the less frequent `timeupdate` event (~4 Hz).
   */
  private startLoop(): void {
    this.stopLoop();
    const tick = () => {
      if (this.destroyed || !this.media || this.media.paused) return;
      this.onTimeUpdate(this.media.currentTime);
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
