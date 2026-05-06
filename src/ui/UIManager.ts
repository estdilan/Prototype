import { CONFIG, type ColorName } from '../config';

export class UIManager {
  private scoreEl: HTMLElement;
  private spawnBar: HTMLElement;
  private spawnFill: HTMLElement;
  private micWrap: HTMLElement;
  private micFills: NodeListOf<Element>;
  private micStrokes: NodeListOf<Element>;
  private victoryEl: HTMLElement;
  private victoryNum: HTMLElement;
  private loadingEl: HTMLElement;
  private loadingFill: HTMLElement;
  private loadingText: HTMLElement;
  private micError: HTMLElement;

  constructor() {
    this.scoreEl     = this.#q('#score');
    this.spawnBar    = this.#q('#spawn-progress');
    this.spawnFill   = this.#q('#spawn-progress-fill');
    this.micWrap     = this.#q('#mic-wrap');
    this.micFills    = document.querySelectorAll('#mic-svg [fill]:not([fill="none"])');
    this.micStrokes  = document.querySelectorAll('#mic-svg [stroke]');
    this.victoryEl   = this.#q('#victory');
    this.victoryNum  = this.#q('#victory-score');
    this.loadingEl   = this.#q('#loading');
    this.loadingFill = this.#q('#loading-fill');
    this.loadingText = this.#q('#loading-text');
    this.micError    = this.#q('#mic-error');

    this.#q('#victory-restart').addEventListener('click', () => window.location.reload());
  }

  #q(sel: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) throw new Error(`UIManager: element not found: ${sel}`);
    return el;
  }

  setLoadingProgress(ratio: number, label?: string): void {
    this.loadingFill.style.width = `${Math.round(ratio * 100)}%`;
    if (label) this.loadingText.textContent = label;
  }

  hideLoading(): void {
    this.loadingEl.style.display = 'none';
  }

  showSpawnBar(): void {
    this.spawnBar.style.display = 'block';
  }

  hideSpawnBar(): void {
    this.spawnBar.style.display = 'none';
  }

  setSpawnProgress(ratio: number): void {
    this.spawnFill.style.width = `${(ratio * 100).toFixed(1)}%`;
  }

  showMic(): void {
    this.micWrap.style.display = 'block';
  }

  hideMic(): void {
    this.micWrap.style.display = 'none';
  }

  setMicColor(color: ColorName): void {
    const hex = CONFIG.colors[color].hex;
    this.micWrap.className = `c-${color}`;
    this.micFills.forEach(el => el.setAttribute('fill', hex));
    this.micStrokes.forEach(el => el.setAttribute('stroke', hex));
  }

  setMicIdle(): void {
    this.micWrap.className = 'idle';
    this.micFills.forEach(el => el.setAttribute('fill', '#888'));
    this.micStrokes.forEach(el => el.setAttribute('stroke', '#888'));
    this.micError.style.display = 'none';
  }

  showMicError(message: string): void {
    this.micError.textContent = message;
    this.micError.style.display = 'block';
    this.micWrap.className = 'error';
    this.micFills.forEach(el => el.setAttribute('fill', '#f55'));
    this.micStrokes.forEach(el => el.setAttribute('stroke', '#f55'));
  }

  updateScore(value: number): void {
    this.scoreEl.textContent = String(value);
    this.scoreEl.classList.add('bump');
    setTimeout(() => this.scoreEl.classList.remove('bump'), 160);
  }

  showVictory(finalScore: number): void {
    this.victoryNum.textContent = String(finalScore);
    this.victoryEl.classList.add('show');
  }
}
