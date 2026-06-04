import { Scene } from '@babylonjs/core';
import { loadEnvironment } from '../scene/EnvironmentLoader';
import { loadPlatform } from '../platform/PlatformLoader';
import { PlatformController } from '../platform/PlatformController';
import { SlitDetector } from '../pellets/SlitDetector';
import { PelletManager } from '../pellets/PelletManager';
import { VoiceController } from '../voice/VoiceController';
import { UIManager } from '../ui/UIManager';
import { AudioManager } from '../audio/AudioManager';
import { CONFIG, type ColorName } from '../config';

type GameState = 'LOADING' | 'START' | 'SPAWNING' | 'PLAYING' | 'VICTORY' | 'GAME_OVER';

export class GameManager {
  private scene: Scene;
  private ui: UIManager;
  private state: GameState = 'LOADING';

  private platform!: PlatformController;
  private pellets!: PelletManager;
  private voice!: VoiceController;
  private audio!: AudioManager;
  private calibrationVoice: VoiceController | null = null;
  private calibrationIndex = 0;
  private calibrationOrder: ColorName[] = CONFIG.calibration.words;

  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private timeLeft = 0;
  private postCalibrationInterval: ReturnType<typeof setInterval> | null = null;

  constructor(scene: Scene, ui: UIManager) {
    this.scene = scene;
    this.ui    = ui;
  }

  async init(): Promise<void> {
    // 1. Load all assets (environment + platform)
    await loadEnvironment(this.scene, this.ui);
    const { collider } = await loadPlatform(this.scene, this.ui);

    // 2. Set up game systems
    this.audio    = new AudioManager();
    this.platform = new PlatformController(collider);
    const slit    = new SlitDetector();
    this.pellets  = new PelletManager(this.scene, this.ui, slit, this.audio);

    this.platform.onTiltStart = (color) => { this.ui.setMicColor(color); this.audio.playPop(); };
    this.platform.onTiltEnd   = ()      => this.ui.setMicIdle();

    this.pellets.onVictory = () => this.#enterVictory();

    await this.pellets.init();

    this.voice = new VoiceController({
      onColor:   (color) => this.platform.trigger(color),
      onSilence: ()      => this.platform.silence(),
      onError:   (msg)   => this.ui.showMicError(msg),
    });

    // 3. Register render loop
    this.scene.registerBeforeRender(() => {
      const dt = this.scene.getEngine().getDeltaTime() * 0.001;
      if (this.state === 'PLAYING') {
        this.platform.update(dt);
        this.pellets.update();
      }
    });

    // 4. Show start screen
    this.ui.onStart = () => this.#onCalibrationStart();
    this.ui.onCalibrationComplete = () => this.#onStartPressed();
    this.ui.hideLoading();
    this.#enterStart();
  }

  #enterStart(): void {
    this.state = 'START';
    this.ui.showWelcomeScreen();
  }

  #onCalibrationStart(): void {
    this.ui.showCalibrationScreen();
    this.#startCalibrationFlow();
  }

  #startCalibrationFlow(): void {
    this.#cleanupCalibration();
    this.calibrationOrder = CONFIG.calibration.words;
    this.calibrationIndex = 0;

    this.ui.setCalibrationActive(this.calibrationOrder[0]);

    this.calibrationVoice = new VoiceController({
      onColor:   (color) => this.#onCalibrationColor(color),
      onSilence: () => {},
      onInterim: (text)  => this.ui.showCalibrationInterim(text),
      onReady:   () => this.ui.setCalibrationStatus('Es momento de usar la voz'),
      onError:   (msg) => {
        console.error(`[Rockey] Calibration error: ${msg}`);
        this.ui.showMicError(msg);
        this.#cleanupCalibration();
      },
    });

    this.calibrationVoice.start();
  }

  #onCalibrationColor(color: ColorName): void {
    const expected = this.calibrationOrder[this.calibrationIndex];
    if (color !== expected) return;

    this.ui.setCalibrationDetected(color);
    this.calibrationIndex++;

    if (this.calibrationIndex >= this.calibrationOrder.length) {
      this.calibrationVoice?.stop();
      this.calibrationVoice = null;
      window.setTimeout(() => this.#startPostCalibrationCountdown(), 800);
      return;
    }

    const next = this.calibrationOrder[this.calibrationIndex];
    window.setTimeout(() => this.ui.setCalibrationActive(next), 600);
  }

  #startPostCalibrationCountdown(): void {
    let count = 5;
    this.ui.showCalibrationCountdown(count);
    this.postCalibrationInterval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(this.postCalibrationInterval!);
        this.postCalibrationInterval = null;
        this.#onStartPressed();
      } else {
        this.ui.showCalibrationCountdown(count);
      }
    }, 1000);
  }

  #clearPostCalibrationCountdown(): void {
    if (this.postCalibrationInterval) {
      clearInterval(this.postCalibrationInterval);
      this.postCalibrationInterval = null;
    }
  }

  #cleanupCalibration(): void {
    this.#clearPostCalibrationCountdown();
    if (this.calibrationVoice) {
      this.calibrationVoice.stop();
      this.calibrationVoice = null;
    }
  }

  #onStartPressed(): void {
    this.#cleanupCalibration();
    this.ui.hideStartScreen();
    this.#startSpawning();
  }

  #startSpawning(): void {
    this.state = 'SPAWNING';
    this.ui.showSpawnBar();
    console.log('[Rockey] Spawning started');

    let spawned = 0;
    const timer = setInterval(() => {
      if (spawned >= CONFIG.pellets.total) {
        clearInterval(timer);
        setTimeout(() => this.#enterPlaying(), 800);
        return;
      }
      this.pellets.spawn();
      spawned++;
      this.ui.setSpawnProgress(spawned / CONFIG.pellets.total);
    }, CONFIG.pellets.spawnIntervalMs);
  }

  #enterPlaying(): void {
    this.state = 'PLAYING';
    this.pellets.enableSlideMode();
    this.ui.hideSpawnBar();
    this.ui.showMic();
    this.ui.setMicIdle();
    this.ui.showTimer();
    this.#startCountdown();
    this.voice.start();
    console.log('[Rockey] Playing — voice enabled');
  }

  #startCountdown(): void {
    this.timeLeft = CONFIG.game.timerSeconds;
    this.ui.updateTimer(this.timeLeft);
    this.countdownInterval = setInterval(() => {
      this.timeLeft--;
      this.ui.updateTimer(this.timeLeft);
      if (this.timeLeft <= 0) this.#enterGameOver();
    }, 1000);
  }

  #clearCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  #enterVictory(): void {
    this.state = 'VICTORY';
    this.#clearCountdown();
    this.voice.stop();
    this.ui.hideMic();
    this.ui.hideTimer();
    this.ui.showVictory(this.pellets.currentScore);
    console.log('[Rockey] Victory!');
  }

  #enterGameOver(): void {
    this.state = 'GAME_OVER';
    this.#clearCountdown();
    this.voice.stop();
    this.ui.hideMic();
    this.ui.hideTimer();

    const score     = this.pellets.currentScore;
    const threshold = CONFIG.pellets.total - 50;
    const nearMiss  = score >= threshold;

    if (nearMiss) {
      console.log(`[Rockey] Game Over — near miss (${score}/${CONFIG.pellets.total}), playing cinematic`);
      this.ui.showCinematicGameOver(score);
    } else {
      this.ui.showGameOver(score);
      console.log('[Rockey] Game Over — time ran out');
    }
  }
}
