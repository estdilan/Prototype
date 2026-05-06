import { CONFIG, type ColorName } from '../config';

// Web Speech API is not fully typed in lib.dom.d.ts for all environments.
// These declarations cover the subset we use.
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => ISpeechRecognition;

type VoiceCallback = {
  onColor: (color: ColorName) => void;
  onSilence: () => void;
  onError: (message: string) => void;
};

const COLOR_MAP: Record<string, ColorName> = {
  rojo: 'rojo',     red: 'rojo',
  azul: 'azul',     blue: 'azul',
  verde: 'verde',   green: 'verde',
  amarillo: 'amarillo', yellow: 'amarillo',
};

export class VoiceController {
  private cb: VoiceCallback;
  private rec: ISpeechRecognition | null = null;
  private lastTranscript = '';
  private lastColor: ColorName | null = null;
  private lastColorTime = 0;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceArmed = false;
  private restartDelay = 0;
  private stopped = false;
  private SR: SpeechRecognitionCtor | null = null;

  constructor(callbacks: VoiceCallback) {
    this.cb = callbacks;
  }

  start(): void {
    const w = window as unknown as Record<string, unknown>;
    const SR = (w['SpeechRecognition'] ?? w['webkitSpeechRecognition']) as SpeechRecognitionCtor | undefined;

    if (!SR) {
      this.cb.onError('El reconocimiento de voz no está disponible. Usa Chrome.');
      return;
    }

    this.SR      = SR;
    this.stopped = false;
    this.#createSession();
  }

  stop(): void {
    this.stopped = true;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    try { this.rec?.stop(); } catch { /* ignore */ }
  }

  #createSession(): void {
    if (!this.SR) return;
    const rec = new this.SR();
    rec.lang            = CONFIG.voice.lang;
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.maxAlternatives = 1;
    this.rec = rec;

    rec.onresult = (e) => {
      const result     = e.results[e.results.length - 1];
      const transcript = this.#normalize(result[0].transcript);
      const now        = Date.now();
      const color      = this.#firstColor(transcript);

      if (!color) { this.#armSilence(); return; }

      const isDup   = transcript === this.lastTranscript;
      const tooSoon = color === this.lastColor && now - this.lastColorTime < CONFIG.voice.colorLockMs;
      if (isDup || tooSoon) { this.#armSilence(); return; }

      this.lastTranscript = transcript;
      this.lastColor      = color;
      this.lastColorTime  = now;
      this.silenceArmed   = true;

      this.cb.onColor(color);
      this.#armSilence();
      if (result.isFinal) this.lastTranscript = '';
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech') {
        this.cb.onSilence();
        this.lastTranscript = '';
        this.lastColor      = null;
        this.silenceArmed   = false;
      } else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.cb.onError('Micrófono no permitido. Habilita el acceso al micrófono en Chrome.');
        this.stopped = true;
      } else {
        console.warn('[Voice] error:', e.error);
      }
    };

    rec.onend = () => {
      if (this.stopped) return;
      // Exponential backoff before restarting to avoid tight loops
      this.restartDelay = Math.min(this.restartDelay * 2 || 100, 3000);
      setTimeout(() => {
        if (!this.stopped) this.#createSession();
      }, this.restartDelay);
    };

    rec.onstart = () => {
      this.restartDelay = 0;
      console.log('[Voice] Recognition started (', CONFIG.voice.lang, ')');
    };

    try {
      rec.start();
    } catch (err) {
      console.error('[Voice] Failed to start recognition:', err);
      this.cb.onError('No se pudo iniciar el micrófono.');
    }
  }

  #armSilence(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (!this.silenceArmed) return;
    this.silenceTimer = setTimeout(() => {
      this.cb.onSilence();
      this.lastTranscript = '';
      this.lastColor      = null;
      this.silenceArmed   = false;
    }, CONFIG.voice.silenceMs);
  }

  #normalize(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  #firstColor(text: string): ColorName | null {
    for (const word of text.split(/\s+/)) {
      if (COLOR_MAP[word]) return COLOR_MAP[word];
    }
    return null;
  }
}
