import { CONFIG } from '../config';
import { DeepgramEngine } from './DeepgramEngine';
import { VoskEngine } from './VoskEngine';
import type { VoiceCallbacks, VoiceEngine } from './VoiceEngine';

export class VoiceController {
  private engine: VoiceEngine;
  private callbacks: VoiceCallbacks;
  private isCalibrationMode = false;
  private calibrationTimer: number | null = null;

  constructor(callbacks: VoiceCallbacks) {
    this.callbacks = callbacks;
    const choice = CONFIG.voice.engine;
    if (choice === 'vosk') {
      this.engine = new VoskEngine(callbacks);
    } else {
      this.engine = new DeepgramEngine(callbacks);
    }
    console.log(`[Voice] Engine activo: ${this.engine.name}`);
  }

  async startCalibration(): Promise<void> {
    this.isCalibrationMode = true;
    if (this.calibrationTimer === null) {
      this.calibrationTimer = window.setTimeout(() => {
        if (this.isCalibrationMode) {
          this.callbacks.onTimeout?.();
          this.stop();
        }
      }, CONFIG.calibration.timeoutMs);
    }
    return this.engine.start();
  }

  start(): Promise<void> {
    return this.engine.start();
  }

  stop(): void {
    this.isCalibrationMode = false;
    if (this.calibrationTimer) {
      window.clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }
    this.engine.stop();
  }
}
