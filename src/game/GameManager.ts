import { Scene } from '@babylonjs/core';
import { loadEnvironment } from '../scene/EnvironmentLoader';
import { loadPlatform } from '../platform/PlatformLoader';
import { PlatformController } from '../platform/PlatformController';
import { SlitDetector } from '../pellets/SlitDetector';
import { PelletManager } from '../pellets/PelletManager';
import { VoiceController } from '../voice/VoiceController';
import { UIManager } from '../ui/UIManager';
import { CONFIG } from '../config';

type GameState = 'LOADING' | 'SPAWNING' | 'PLAYING' | 'VICTORY';

export class GameManager {
  private scene: Scene;
  private ui: UIManager;
  private state: GameState = 'LOADING';

  private platform!: PlatformController;
  private pellets!: PelletManager;
  private voice!: VoiceController;

  constructor(scene: Scene, ui: UIManager) {
    this.scene = scene;
    this.ui    = ui;
  }

  async init(): Promise<void> {
    // 1. Load all assets (environment + platform)
    await loadEnvironment(this.scene, this.ui);
    const { collider } = await loadPlatform(this.scene, this.ui);

    // 2. Set up game systems
    this.platform = new PlatformController(collider);
    const slit    = new SlitDetector();
    this.pellets  = new PelletManager(this.scene, this.ui, slit);

    this.platform.onTiltStart = (color) => this.ui.setMicColor(color);
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

    // 4. Start game
    this.ui.hideLoading();
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
    this.ui.hideSpawnBar();
    this.ui.showMic();
    this.ui.setMicIdle();
    this.voice.start();
    console.log('[Rockey] Playing — voice enabled');
  }

  #enterVictory(): void {
    this.state = 'VICTORY';
    this.voice.stop();
    this.ui.hideMic();
    this.ui.showVictory(this.pellets.currentScore);
    console.log('[Rockey] Victory!');
  }
}
