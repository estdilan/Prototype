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
  private micFeedbackPanel: HTMLElement;
  private micError: HTMLElement;
  private micFixBtn: HTMLElement;
  private timerEl: HTMLElement;
  private gameOverEl: HTMLElement;
  private gameOverNum: HTMLElement;
  private startScreenEl: HTMLElement;
  private welcomeScreenEl: HTMLElement;
  private calibrationScreenEl: HTMLElement;
  private calibrationStatusEl: HTMLElement;
  private calibrationVisualizer: HTMLElement;
  private startBtn: HTMLElement;
  private welcomeStartBtn: HTMLElement;
  private statStreak: HTMLElement;
  private calibrationItems = new Map<ColorName, HTMLElement>();
  private calibrationFlashTimeout: number | null = null;

  private currentStreak = 0;
  private maxStreak = 0;

  onStart?: () => void;
  onCalibrationComplete?: () => void;

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
    this.micFeedbackPanel = this.#q('#mic-feedback-panel');
    this.micError    = this.#q('#mic-error');
    this.micFixBtn   = this.#q('#mic-fix-btn');
    this.timerEl      = this.#q('#timer');
    this.gameOverEl   = this.#q('#game-over');
    this.gameOverNum  = this.#q('#game-over-score');
    this.startScreenEl = this.#q('#start-screen');
    this.welcomeScreenEl = this.#q('#welcome-screen');
    this.calibrationScreenEl = this.#q('#calibration-screen');
    this.calibrationStatusEl = this.#q('#calibration-status');
    this.calibrationVisualizer = this.#q('#calibration-visualizer');
    this.startBtn = this.#q('#start-btn');
    this.welcomeStartBtn = this.#q('#welcome-start-btn');
    this.statStreak   = this.#q('#stat-streak');

    document.querySelectorAll<HTMLElement>('#calibration-list .calibration-item').forEach((item) => {
      const color = item.dataset.color as ColorName | undefined;
      if (color) this.calibrationItems.set(color, item);
    });

    this.#q('#victory-restart').addEventListener('click', () => window.location.reload());
    this.#q('#game-over-restart').addEventListener('click', () => window.location.reload());
    
    this.micFixBtn.addEventListener('click', () => {
      this.micFeedbackPanel.style.display = 'none';
      // Ideally re-trigger mic request here.
    });
    this.welcomeStartBtn.addEventListener('click', () => {
      this.onStart?.();
    });

    this.startBtn.addEventListener('click', () => {
      this.onCalibrationComplete?.();
    });
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
    this.micWrap.style.display = 'flex';
  }

  hideMic(): void {
    this.micWrap.style.display = 'none';
  }

  setMicColor(color: ColorName): void {
    const hex = CONFIG.colors[color].hex;
    this.micWrap.className = `c-${color}`;
    
    this.micFills.forEach(el => el.setAttribute('fill', hex));
    this.micStrokes.forEach(el => el.setAttribute('stroke', hex));

    this.currentStreak++;
    if (this.currentStreak > this.maxStreak) this.maxStreak = this.currentStreak;
    this.micFeedbackPanel.style.display = 'none';
  }

  setMicIdle(): void {
    this.micWrap.className = 'idle';
    this.micFills.forEach(el => el.setAttribute('fill', '#888'));
    this.micStrokes.forEach(el => el.setAttribute('stroke', '#888'));
  }

  showMicError(message: string): void {
    const isPermission = message.includes('not-allowed');
    this.micError.textContent = isPermission
      ? 'Permiso denegado. Revisa la configuración de tu navegador.'
      : 'Error de entrada de voz. ¿Está mudo?';
    this.micFeedbackPanel.style.display = 'flex';
    this.micWrap.className = 'error';
    this.micFills.forEach(el => el.setAttribute('fill', '#f55'));
    this.micStrokes.forEach(el => el.setAttribute('stroke', '#f55'));
    this.currentStreak = 0;
  }

  updateScore(value: number): void {
    this.scoreEl.textContent = String(value).padStart(3, '0');
    this.scoreEl.classList.add('bump');
    setTimeout(() => this.scoreEl.classList.remove('bump'), 160);
  }

  showVictory(finalScore: number): void {
    this.victoryNum.textContent = String(finalScore).padStart(3, '0');
    this.victoryEl.classList.add('show');
  }

  showWelcomeScreen(): void {
    this.startScreenEl.classList.add('show');
    this.#setSection('welcome');
  }

  showStartScreen(): void {
    this.showWelcomeScreen();
  }

  showCalibrationScreen(): void {
    this.startScreenEl.classList.add('show');
    this.#setSection('calibration');
    this.resetCalibrationUI();
  }

  hideStartScreen(): void {
    this.startScreenEl.classList.remove('show');
  }

  showTimer(): void {
    this.timerEl.style.display = 'block';
  }

  hideTimer(): void {
    this.timerEl.style.display = 'none';
  }

  updateTimer(seconds: number): void {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    this.timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (seconds <= CONFIG.game.warningThresholdSec && seconds > 0) {
      this.timerEl.classList.add('warning');
    } else {
      this.timerEl.classList.remove('warning');
    }
  }

  showGameOver(score: number): void {
    this.gameOverNum.textContent = String(score).padStart(3, '0');
    this.statStreak.textContent = String(this.maxStreak);
    this.gameOverEl.classList.add('show');
    this.hideMic();
  }

  setCalibrationActive(color: ColorName): void {
    this.calibrationItems.forEach((item, key) => {
      item.classList.toggle('active', key === color);
    });
    this.calibrationVisualizer.className = `calibration-visualizer c-${color}`;
    this.setCalibrationStatus(`Siguiente: ${color.toUpperCase()}`);
  }

  setCalibrationDetected(color: ColorName): void {
    const item = this.calibrationItems.get(color);
    if (item) {
      item.classList.remove('active');
      item.classList.add('done');
    }
    this.#flashCalibrationVisualizer();
  }

  showCalibrationReady(): void {
    this.calibrationScreenEl.classList.add('ready');
    this.setCalibrationStatus('Presiona comenzar juego');
  }

  showCalibrationTimeout(retriesLeft: number): void {
    if (retriesLeft > 0) {
      this.setCalibrationStatus(`Timeout - reintentos: ${retriesLeft}`, true);
    } else {
      this.setCalibrationStatus('Sin reintentos. Recarga para intentar.', true);
    }
  }

  setCalibrationStatus(message: string, isWarning: boolean = false): void {
    this.calibrationStatusEl.textContent = message;
    this.calibrationStatusEl.classList.toggle('warning', isWarning);
  }

  resetCalibrationUI(): void {
    this.calibrationScreenEl.classList.remove('ready');
    this.calibrationItems.forEach((item) => {
      item.classList.remove('active', 'done');
    });
    this.setCalibrationStatus('Escuchando...');
    this.calibrationVisualizer.className = 'calibration-visualizer';
  }

  #setSection(section: 'welcome' | 'calibration'): void {
    const incoming = section === 'welcome' ? this.welcomeScreenEl     : this.calibrationScreenEl;
    const outgoing = section === 'welcome' ? this.calibrationScreenEl : this.welcomeScreenEl;

    if (!outgoing.classList.contains('active')) {
      // Nada saliendo — entra directo
      incoming.classList.add('active');
      return;
    }

    this.#transitionSections(outgoing, incoming);
  }

  #transitionSections(from: HTMLElement, to: HTMLElement): void {
    const LEAVE_MS = 380; // debe coincidir con la duración de .leaving en el CSS

    from.classList.add('leaving');
    from.classList.remove('active');

    // Limpia .leaving cuando termina su animación de salida
    setTimeout(() => from.classList.remove('leaving'), LEAVE_MS);

    // La entrante espera un poco para que no se solapen
    setTimeout(() => to.classList.add('active'), 80);
  }

  #flashCalibrationVisualizer(): void {
    if (this.calibrationFlashTimeout) {
      clearTimeout(this.calibrationFlashTimeout);
      this.calibrationFlashTimeout = null;
    }
    this.calibrationVisualizer.classList.add('flash');
    this.calibrationFlashTimeout = window.setTimeout(() => {
      this.calibrationVisualizer.classList.remove('flash');
    }, 220);
  }
}