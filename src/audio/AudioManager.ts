export class AudioManager {
  private click: HTMLAudioElement;
  private pop: HTMLAudioElement;

  constructor() {
    this.click = new Audio('/assets/waterdrop.mp3');
    this.pop   = new Audio('/assets/click.mp3');
    this.click.volume = 0.6;
    this.pop.volume   = 0.5;
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
}
