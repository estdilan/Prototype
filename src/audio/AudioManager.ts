export class AudioManager {
  private click: HTMLAudioElement;
  private pop: HTMLAudioElement;
  private bg: HTMLAudioElement;
  private bgFadeTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.click = new Audio('/assets/waterdrop.mp3');
    this.pop   = new Audio('/assets/click.mp3');
    this.bg    = new Audio('/assets/background.mp3');
    this.click.volume = 0.6;
    this.pop.volume   = 0.5;
    this.bg.loop      = true;
    this.bg.volume    = 0;
  }

  playClick(): void {
    const s = this.click.cloneNode() as HTMLAudioElement;
    s.volume = this.click.volume;
    s.play().catch(() => {});
  }

  playPop(): void {
    const s = this.pop.cloneNode() as HTMLAudioElement;
    s.volume = this.pop.volume;
    s.play().catch(() => {});
  }

  setBgVolume(target: number, fadeDurationMs = 800): void {
    if (this.bg.paused) {
      this.bg.play().catch(() => {});
    }
    if (this.bgFadeTimer) {
      clearInterval(this.bgFadeTimer);
      this.bgFadeTimer = null;
    }
    const steps = 20;
    const intervalMs = fadeDurationMs / steps;
    const start = this.bg.volume;
    const delta = (target - start) / steps;
    let step = 0;
    this.bgFadeTimer = setInterval(() => {
      step++;
      this.bg.volume = Math.min(1, Math.max(0, start + delta * step));
      if (step >= steps) {
        this.bg.volume = target;
        clearInterval(this.bgFadeTimer!);
        this.bgFadeTimer = null;
      }
    }, intervalMs);
  }
}
