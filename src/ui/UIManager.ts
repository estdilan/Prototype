import { CONFIG, type ColorName } from '../config';

export class UIManager {
  private scoreEl: HTMLElement;
  private spawnBar: HTMLElement;
  private spawnFill: HTMLElement;
  private micWrap: HTMLElement;
  private micFills: NodeListOf<Element>;
  private micStrokes: NodeListOf<Element>;
  private loadingEl: HTMLElement;
  private loadingFill: HTMLElement;
  private loadingText: HTMLElement;
  private micFeedbackPanel: HTMLElement;
  private micError: HTMLElement;
  private micFixBtn: HTMLElement;
  private timerEl: HTMLElement;
  private startScreenEl: HTMLElement;
  private welcomeScreenEl: HTMLElement;
  private calibrationScreenEl: HTMLElement;
  private calibrationStatusEl: HTMLElement;
  private calibrationVisualizer: HTMLElement;
  private startBtn: HTMLElement;
  private welcomeStartBtn: HTMLElement;
  private calibrationCountdownEl: HTMLElement;
  private calibrationItems = new Map<ColorName, HTMLElement>();
  private calibrationFlashTimeout: number | null = null;
  private interimBlockedUntil = 0;
  private cinematicVignette: HTMLElement;
  private cinematicBlackfill: HTMLElement;
  private cinematicLogo: HTMLElement;
  private cinematicScore: HTMLElement;
  private cinScoreValue: HTMLElement;
  private cinScoreOf: HTMLElement;
  private highScoreCorner: HTMLElement;
  private highScoreValue: HTMLElement;
  private sessionHighScore = -1;

  onStart?: () => void;
  onCalibrationComplete?: () => void;

  constructor() {
    this.scoreEl     = this.#q('#score');
    this.spawnBar    = this.#q('#spawn-progress');
    this.spawnFill   = this.#q('#spawn-progress-fill');
    this.micWrap     = this.#q('#mic-wrap');
    this.micFills    = document.querySelectorAll('#mic-svg [fill]:not([fill="none"])');
    this.micStrokes  = document.querySelectorAll('#mic-svg [stroke]');
    this.loadingEl   = this.#q('#loading');
    this.loadingFill = this.#q('#loading-fill');
    this.loadingText = this.#q('#loading-text');
    this.micFeedbackPanel = this.#q('#mic-feedback-panel');
    this.micError    = this.#q('#mic-error');
    this.micFixBtn   = this.#q('#mic-fix-btn');
    this.timerEl      = this.#q('#timer');
    this.startScreenEl = this.#q('#start-screen');
    this.welcomeScreenEl = this.#q('#welcome-screen');
    this.calibrationScreenEl = this.#q('#calibration-screen');
    this.calibrationStatusEl = this.#q('#calibration-status');
    this.calibrationVisualizer = this.#q('#calibration-visualizer');
    this.calibrationCountdownEl = this.#q('#calibration-countdown');
    this.startBtn = this.#q('#start-btn');
    this.welcomeStartBtn = this.#q('#welcome-start-btn');
    this.cinematicVignette   = this.#q('#cinematic-vignette');
    this.cinematicBlackfill  = this.#q('#cinematic-blackfill');
    this.cinematicLogo       = this.#q('#cinematic-logo');
    this.cinematicScore      = this.#q('#cinematic-score');
    this.cinScoreValue       = this.#q('#cin-score-value');
    this.cinScoreOf          = this.#q('#cin-score-of');
    this.highScoreCorner     = this.#q('#high-score-corner');
    this.highScoreValue      = this.#q('#hs-value');

    const stored = sessionStorage.getItem('rockey_high_score');
    if (stored !== null) {
      this.sessionHighScore = parseInt(stored, 10);
      this.highScoreValue.textContent = String(this.sessionHighScore).padStart(3, '0');
      this.highScoreCorner.classList.add('visible');
    }

    document.querySelectorAll<HTMLElement>('#calibration-list .calibration-item').forEach((item) => {
      const color = item.dataset.color as ColorName | undefined;
      if (color) this.calibrationItems.set(color, item);
    });

    this.micFixBtn.addEventListener('click', () => {
      this.micFeedbackPanel.style.display = 'none';
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
  }

  updateScore(value: number): void {
    this.scoreEl.textContent = String(value).padStart(3, '0');
    this.scoreEl.classList.add('bump');
    setTimeout(() => this.scoreEl.classList.remove('bump'), 160);
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

  showEndSequence(score: number, maxScore: number): void {
    // Update session high score
    if (score > this.sessionHighScore) {
      this.sessionHighScore = score;
      sessionStorage.setItem('rockey_high_score', String(this.sessionHighScore));
    }
    this.highScoreValue.textContent = String(this.sessionHighScore).padStart(3, '0');
    this.highScoreCorner.classList.add('visible');

    const blackfill = this.cinematicBlackfill;
    const logo      = this.cinematicLogo;
    const scoreEl   = this.cinematicScore;

    // Reset layers
    blackfill.className = '';
    logo.className      = '';
    scoreEl.className   = '';
    void blackfill.offsetWidth; // force reflow before animation

    // Phase 1 — fade to black over 3 000 ms
    blackfill.className = 'fade-in-slow';

    // Phase 2 — at t=3 000: show score overlay for 5 000 ms
    setTimeout(() => {
      blackfill.className = 'hold';
      this.cinScoreValue.textContent = String(score).padStart(3, '0');
      this.cinScoreOf.textContent    = `/ ${maxScore}`;
      scoreEl.className = 'show';
    }, 3000);

    // Phase 3 — at t=8 000: fade out score, start logo entrance
    setTimeout(() => {
      scoreEl.className = 'hide';
    }, 8000);

    setTimeout(() => {
      scoreEl.className = '';
      logo.className    = 'phase-in';
    }, 8600);

    // Phase 3b — at t=10 000: logo fully settled
    setTimeout(() => {
      logo.className = 'phase-hold';
    }, 10000);

    // Phase 4 — at t=18 000: logo fades out, then blackfill fades in
    setTimeout(() => {
      logo.className = 'phase-out';
    }, 18000);

    setTimeout(() => {
      blackfill.className = '';
      void blackfill.offsetWidth;
      blackfill.className = 'fade-in-slow';
    }, 18400);

    // Phase 5 — at t=21 400: reload
    setTimeout(() => {
      window.location.reload();
    }, 21400);
  }

  setCalibrationActive(color: ColorName): void {
    this.calibrationItems.forEach((item, key) => {
      item.classList.toggle('active', key === color);
    });
    this.calibrationVisualizer.className = `calibration-visualizer c-${color}`;
    this.setCalibrationStatus('Di el color resaltado');
    this.interimBlockedUntil = Date.now() + 1200;
  }

  setCalibrationDetected(color: ColorName): void {
    const item = this.calibrationItems.get(color);
    if (item) {
      item.classList.remove('active');
      item.classList.add('done');
    }
    this.setCalibrationStatus(`✓ ${color.toUpperCase()} reconocido`);
    this.interimBlockedUntil = Date.now() + 900;
    this.#flashCalibrationVisualizer();
  }

  showCalibrationInterim(text: string): void {
    if (text && Date.now() >= this.interimBlockedUntil) {
      this.calibrationStatusEl.textContent = text;
    }
  }

  showCalibrationCountdown(seconds: number): void {
    this.calibrationScreenEl.classList.add('ready', 'counting');
    this.calibrationCountdownEl.textContent = String(seconds);
    this.calibrationCountdownEl.classList.remove('tick');
    requestAnimationFrame(() => this.calibrationCountdownEl.classList.add('tick'));
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
    this.calibrationScreenEl.classList.remove('ready', 'counting');
    this.interimBlockedUntil = 0;
    this.calibrationItems.forEach((item) => {
      item.classList.remove('active', 'done');
    });
    this.setCalibrationStatus('Di el color resaltado');
    this.calibrationVisualizer.className = 'calibration-visualizer';
  }

  #setSection(section: 'welcome' | 'calibration'): void {
    const incoming = section === 'welcome' ? this.welcomeScreenEl     : this.calibrationScreenEl;
    const outgoing = section === 'welcome' ? this.calibrationScreenEl : this.welcomeScreenEl;

    if (!outgoing.classList.contains('active')) {
      incoming.classList.add('active');
      return;
    }

    this.#transitionSections(outgoing, incoming);
  }

  #transitionSections(from: HTMLElement, to: HTMLElement): void {
    const LEAVE_MS = 380;

    from.classList.add('leaving');
    from.classList.remove('active');

    setTimeout(() => from.classList.remove('leaving'), LEAVE_MS);
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
