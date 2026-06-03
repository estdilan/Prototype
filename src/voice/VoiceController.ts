import { CONFIG } from '../config';
import { DeepgramEngine } from './DeepgramEngine';
import { VoskEngine } from './VoskEngine';
import type { VoiceCallbacks, VoiceEngine } from './VoiceEngine';

export class VoiceController {
  private engine: VoiceEngine;

  constructor(callbacks: VoiceCallbacks) {
    const choice = CONFIG.voice.engine;
    if (choice === 'vosk') {
      this.engine = new VoskEngine(callbacks);
    } else {
      this.engine = new DeepgramEngine(callbacks);
    }
    console.log(`[Voice] Engine activo: ${this.engine.name}`);
  }

  start(): Promise<void> {
    return this.engine.start();
  }

  stop(): void {
    this.engine.stop();
  }
}
