import { CONFIG, type ColorName } from '../config';
import { extractAllColors } from './colorNormalizer';
import type { VoiceCallbacks, VoiceEngine } from './VoiceEngine';

export class DeepgramEngine implements VoiceEngine {
  readonly name = 'deepgram';

  private cb: VoiceCallbacks;
  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: AudioWorkletNode | null = null;

  private state: 'IDLE' | 'LISTENING' | 'STOPPED' | 'ERROR' = 'IDLE';

  private colorQueue: ColorName[] = [];
  private isProcessingQueue = false;
  private emittedColorsForUtterance: ColorName[] = [];

  private lastColorDetected: ColorName | null = null;
  private lastColorTime = 0;
  private lastColorEmitTime = 0;
  private silenceTimer: number | null = null;

  constructor(callbacks: VoiceCallbacks) {
    this.cb = callbacks;
  }

  async start(): Promise<void> {
    if (this.state === 'LISTENING') return;
    this.state = 'LISTENING';

    const token = import.meta.env.VITE_DEEPGRAM_TOKEN;
    if (!token) {
      this.cb.onError('Falta el token de Deepgram en el .env.local');
      this.state = 'ERROR';
      return;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = this.mediaStream.getAudioTracks()[0];
      console.log('[Voice/Deepgram] Micrófono en uso:', track?.label || '(sin nombre)');
    } catch {
      this.cb.onError('Micrófono no permitido o no encontrado.');
      this.state = 'ERROR';
      return;
    }

    const url = `wss://api.deepgram.com/v1/listen?language=es&model=nova-2&encoding=linear16&sample_rate=16000&channels=1&interim_results=true&endpointing=80`;
    this.socket = new WebSocket(url, ['token', token]);

    this.socket.onopen = () => {
      console.log('[Voice/Deepgram] WebSocket conectado');
      this.#startAudioCapture();
    };

    this.socket.onmessage = (message) => {
      const res = JSON.parse(message.data);

      if (res.type === 'Results') {
        const transcript = res.channel?.alternatives?.[0]?.transcript;
        const isFinal = res.is_final || res.speech_final;

        if (transcript) {
          this.#processTranscript(transcript, isFinal);
        } else if (isFinal) {
          this.emittedColorsForUtterance = [];
        }
      } else if (res.type === 'Metadata') {
        console.log('[Voice/Deepgram] Sesión iniciada');
      } else if (res.type === 'Error') {
        console.error('[Voice/Deepgram] Error:', res.description);
        this.cb.onError(`Deepgram Error: ${res.description}`);
        this.stop();
      }
    };

    this.socket.onerror = (e) => {
      console.error('[Voice/Deepgram] WebSocket error', e);
      this.cb.onError('Error en la conexión con Deepgram');
      this.state = 'ERROR';
    };

    this.socket.onclose = () => {
      console.log('[Voice/Deepgram] WebSocket cerrado');
      this.stop();
    };
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

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  #startAudioCapture() {
    if (!this.mediaStream || !this.socket) return;

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    this.audioContext.audioWorklet.addModule('/audio-worklet.js').then(() => {
      if (!this.audioContext) return;
      this.processor = new AudioWorkletNode(this.audioContext, 'audio-processor');
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.processor.port.onmessage = (event) => {
        if (this.socket?.readyState !== WebSocket.OPEN) return;

        const pcm16: Int16Array = event.data.pcm16;
        const buffer = new ArrayBuffer(pcm16.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcm16.length; i++) {
          view.setInt16(i * 2, pcm16[i], true);
        }
        this.socket!.send(buffer);
      };
    }).catch((err) => {
      console.error('[Voice/Deepgram] Error cargando AudioWorklet:', err);
      this.cb.onError('Error al inicializar el procesamiento de audio');
      this.stop();
    });
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
      this.#enqueueColor(newColor);
    }

    if (isFinal) this.emittedColorsForUtterance = [];
  }

  #enqueueColor(color: ColorName) {
    this.colorQueue.push(color);
    if (!this.isProcessingQueue) this.#processQueue();
  }

  #processQueue() {
    this.isProcessingQueue = true;
    while (this.colorQueue.length > 0) {
      const color = this.colorQueue.shift()!;
      const now = Date.now();
      console.log(`[Voice/Deepgram] 🎤 ${color.toUpperCase()} (Δ${now - this.lastColorTime}ms)`);
      this.cb.onColor(color);
      this.lastColorTime = now;
    }
    this.isProcessingQueue = false;
  }
}
