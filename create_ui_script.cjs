const fs = require('fs');
const code = `import { CONFIG, type ColorName } from '../config';

export class UIManager {
  private scoreEl: HTMLElement;
  private spawnBar: HTMLElement;
  private spawnFill: HTMLElement;
  private micWrap: HTMLElement;
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
  private toastContainer: HTMLElement;
  private targetValue: HTMLElement;
  private statStreak: HTMLElement;

  private currentStreak = 0;
  private maxStreak = 0;

  onStart?: () => void;

  constructor() {
    this.scoreEl     = this.#q('#score');
    this.spawnBar    = this.#q('#spawn-progress');
    this.spawnFill   = this.#q('#spawn-progress-fill');
    this.micWrap     = this.#q('#mic-wrap');
    
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
    this.toastContainer = this.#q('#toast-container');
    this.targetValue  = this.#q('#target-value');
    this.statStreak   = this.#q('#stat-streak');

    this.#q('#victory-restart').addEventListener('click', () => window.location.reload());
    this.#q('#game-over-restart').addEventListener('click', () => window.location.reload());
    this.#q('#game-over-menu').addEventListener('click', () => window.location.reload());
    this.micFixBtn.addEventListener('click', () => {
      this.micFeedbackPanel.style.display = 'none';
      // Ideally re-trigger mic request here.
      this.showToast('Reintentando conexión al micrófono...', 'dimmed');
    });

    this.#q('#start-btn').addEventListener('click', () => {
      // UX 1/2: Simular un paso de onboarding antes de iniciar
      const step1 = this.#q('#step-1');
      const step2 = this.#q('#step-2');
      const btn = this.#q('#start-btn');
      
      step1.classList.add('dimmed');
      step1.classList.remove('active');
      step2.classList.remove('dimmed');
      step2.classList.add('active');
      btn.textContent = 'COMENZAR SIMULACIÓN';
      
      const prevAction = btn.onclick;
      btn.onclick = () => {
        this.onStart?.();
      };
    });
  }

  #q(sel: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) throw new Error(\`UIManager: element not found: \${sel}\`);
    return el;
  }

  // --- Toasts (UX 4) ---
  showToast(message: string, styleClass: string = '') {
    const toast = document.createElement('div');
    toast.className = \`micro-toast \${styleClass}\`;
    toast.textContent = message;
    
    this.toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => toast.remove());
    }, 1500);
  }

  setLoadingProgress(ratio: number, label?: string): void {
    this.loadingFill.style.width = \`\${Math.round(ratio * 100)}%\`;
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
    this.spawnFill.style.width = \`\${(ratio * 100).toFixed(1)}%\`;
  }

  showMic(): void {
    this.micWrap.style.display = 'flex';
  }

  hideMic(): void {
    this.micWrap.style.display = 'none';
  }

  setMicColor(color: ColorName): void {
    this.micWrap.className = \`orb c-\${color} listening\`;
    this.showToast(\`\${color.toUpperCase()} DETECTADO\`);
    this.currentStreak++;
    if (this.currentStreak > this.maxStreak) this.maxStreak = this.currentStreak;
  }

  setMicIdle(): void {
    this.micWrap.className = 'orb idle';
    this.micFeedbackPanel.style.display = 'none';
  }

  showMicError(message: string): void {
    // UX 5: Actionable errors
    this.micError.textContent = message === 'not-allowed' 
      ? 'Permiso denegado. Revisa la configuración de tu navegador.'
      : 'Error de entrada de voz. ¿Está mudo?';
    this.micFeedbackPanel.style.display = 'flex';
    this.micWrap.className = 'orb error';
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

  showStartScreen(): void {
    this.startScreenEl.classList.add('show');
    this.showMic();
  }

  hideStartScreen(): void {
    this.startScreenEl.classList.remove('show');
    this.targetValue.textContent = 'Mantener Pellets';
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
    this.timerEl.textContent = \`\${String(m).padStart(2, '0')}:\${String(s).padStart(2, '0')}\`;
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
}
`;
fs.writeFileSync('src/ui/UIManager.ts', code);
`;
fs.writeFileSync('update_ui.cjs', content);
