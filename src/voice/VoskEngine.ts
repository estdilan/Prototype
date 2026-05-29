import type { KaldiRecognizer, Model } from 'vosk-browser';
import { CONFIG, type ColorName } from '../config';
import { extractAllColors, VOSK_GRAMMAR } from './colorNormalizer';
import type { VoiceCallbacks, VoiceEngine } from './VoiceEngine';

const SAMPLE_RATE = 16000;

export class VoskEngine implements VoiceEngine {
  readonly name = 'vosk';

  private cb: VoiceCallbacks;
  private model: Model | null = null;
  private recognizer: KaldiRecognizer | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: AudioWorkletNode | null = null;
  private state: 'IDLE' | 'LOADING' | 'LISTENING' | 'STOPPED' | 'ERROR' = 'IDLE';

  private emittedColorsForUtterance: ColorName[] = [];
  private lastColorDetected: ColorName | null = null;
  private lastColorEmitTime = 0;
  private lastColorTime = 0;
  private silenceTimer: number | null = null;

  constructor(callbacks: VoiceCallbacks) {
    this.cb = callbacks;
  }

  async start(): Promise<void> {
    if (this.state === 'LISTENING' || this.state === 'LOADING') return;
    this.state = 'LOADING';

    let createModel: (url: string) => Promise<Model>;
    try {
      ({ createModel } = await import('vosk-browser'));
    } catch (err) {
      console.error('[Voice/Vosk] No se pudo cargar vosk-browser:', err);
      this.cb.onError('vosk-browser no está instalado. Ejecutá `npm install`.');
      this.state = 'ERROR';
      return;
    }

    try {
      console.log('[Voice/Vosk] Descargando modelo:', CONFIG.voice.voskModelUrl);
      const t0 = performance.now();
      this.model = await createModel(CONFIG.voice.voskModelUrl);
      console.log(`[Voice/Vosk] Modelo cargado en ${Math.round(performance.now() - t0)}ms`);
    } catch (err) {
      console.error('[Voice/Vosk] Error cargando modelo:', err);
      this.cb.onError(`No se pudo cargar el modelo Vosk desde ${CONFIG.voice.voskModelUrl}`);
      this.state = 'ERROR';
      return;
    }

    this.recognizer = new this.model.KaldiRecognizer(SAMPLE_RATE, JSON.stringify(VOSK_GRAMMAR));
    this.recognizer.setWords(true);

    this.recognizer.on('result', (msg) => {
      if (msg.event !== 'result') return;
      const text = msg.result.text ?? '';
      if (text) this.#processTranscript(text, true);
      else this.emittedColorsForUtterance = [];
    });

    this.recognizer.on('partialresult', (msg) => {
      if (msg.event !== 'partialresult') return;
      const text = msg.result.partial ?? '';
      if (text) this.#processTranscript(text, false);
    });

    this.recognizer.on('error', (msg) => {
      if (msg.event !== 'error') return;
      console.error('[Voice/Vosk] Recognizer error:', msg.error);
      this.cb.onError(`Vosk error: ${msg.error}`);
    });

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = this.mediaStream.getAudioTracks()[0];
      console.log('[Voice/Vosk] Micrófono en uso:', track?.label || '(sin nombre)');
    } catch {
      this.cb.onError('Micrófono no permitido o no encontrado.');
      this.state = 'ERROR';
      return;
    }

    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    try {
      await this.audioContext.audioWorklet.addModule('/audio-worklet.js');
    } catch (err) {
      console.error('[Voice/Vosk] Error cargando AudioWorklet:', err);
      this.cb.onError('Error al inicializar el procesamiento de audio');
      this.stop();
      return;
    }

    this.processor = new AudioWorkletNode(this.audioContext, 'audio-processor');
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.processor.port.onmessage = (event) => {
      if (!this.recognizer || !this.audioContext) return;
      const float32: Float32Array = event.data.float32;
      if (!float32 || float32.length === 0) return;
      this.recognizer.acceptWaveformFloat(float32, SAMPLE_RATE);
    };

    this.state = 'LISTENING';
    console.log('[Voice/Vosk] Escuchando');
  }

  stop(): void {
    if (this.state === 'STOPPED') return;
    this.state = 'STOPPED';

    if (this.silenceTimer) {
      window.clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.recognizer) {
      this.recognizer.remove();
      this.recognizer = null;
    }
    if (this.model) {
      this.model.terminate();
      this.model = null;
    }
  }

  #resetSilenceTimer() {
    if (this.silenceTimer) window.clearTimeout(this.silenceTimer);
    this.silenceTimer = window.setTimeout(() => {
      if (this.state === 'LISTENING') {
        this.cb.onSilence();
        this.lastColorDetected = null;
        this.emittedColorsForUtterance = [];
      }
    }, CONFIG.voice?.silenceMs || 1500);
  }

  #processTranscript(text: string, isFinal: boolean) {
    this.#resetSilenceTimer();
    const colorsInText = extractAllColors(text);

    for (let i = this.emittedColorsForUtterance.length; i < colorsInText.length; i++) {
      const newColor = colorsInText[i];
      this.emittedColorsForUtterance.push(newColor);

      const now = Date.now();
      if (newColor === this.lastColorDetected && now - this.lastColorEmitTime < 150) continue;
      this.lastColorDetected = newColor;
      this.lastColorEmitTime = now;

      console.log(`[Voice/Vosk] 🎤 ${newColor.toUpperCase()} (Δ${now - this.lastColorTime}ms, ${isFinal ? 'final' : 'partial'})`);
      this.cb.onColor(newColor);
      this.lastColorTime = now;
    }

    if (isFinal) this.emittedColorsForUtterance = [];
  }
}
