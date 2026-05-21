import { CONFIG, type ColorName } from '../config';

type VoiceCallback = {
  onColor: (color: ColorName) => void;
  onSilence: () => void;
  onError: (message: string) => void;
  onTimeout?: () => void;
};

// Diccionario NLP expandido para robustez
const COLOR_DICTIONARY: Record<ColorName, string[]> = {
  rojo: ['rojo', 'roja', 'red', 'roj', 'roho', 'loco', 'ojo'],
  azul: ['azul', 'blue', 'asul', 'azu', 'sub'],
  verde: ['verde', 'green', 'berde', 'ver', 'vende'],
  amarillo: ['amarillo', 'amarilla', 'yellow', 'ama', 'amarilo', 'yelo', 'mario'],
};

const WORD_MAP = new Map<string, ColorName>();
for (const [color, words] of Object.entries(COLOR_DICTIONARY)) {
  for (const word of words) {
    WORD_MAP.set(word, color as ColorName);
  }
}


export class VoiceController {
  private cb: VoiceCallback;
  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: AudioWorkletNode | null = null;
  
  private state: 'IDLE' | 'LISTENING' | 'STOPPED' | 'ERROR' = 'IDLE';
  private isCalibrationMode = false;
  private calibrationTimer: number | null = null;

  // Cola de colores y estado de procesamiento
  private colorQueue: ColorName[] = [];
  private isProcessingQueue = false;
  private emittedColorsForUtterance: ColorName[] = [];
  
  private lastColorDetected: ColorName | null = null;
  private lastColorTime = 0;
  private lastColorEmitTime = 0; // Prevenir duplicados en corto plazo
  private silenceTimer: number | null = null;

  constructor(callbacks: VoiceCallback) {
    this.cb = callbacks;
  }

  /**
   * Inicia en modo calibración con timeout automático
   */
  async startCalibration(): Promise<void> {
    this.isCalibrationMode = true;
    await this.start();
  }

  async start(): Promise<void> {
    if (this.state === 'LISTENING') return;
    this.state = 'LISTENING';

    // Si estamos en modo calibración, iniciar timer de timeout
    if (this.isCalibrationMode && this.calibrationTimer === null) {
      this.calibrationTimer = window.setTimeout(() => {
        if (this.state === 'LISTENING' && this.isCalibrationMode) {
          console.log('[Voice] Calibration timeout');
          this.cb.onTimeout?.();
          this.stop();
        }
      }, CONFIG.calibration.timeoutMs);
    }

    const token = import.meta.env.VITE_DEEPGRAM_TOKEN;
    if (!token) {
      this.cb.onError('Falta el token de Deepgram en el .env.local');
      this.state = 'ERROR';
      return;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      this.cb.onError('Micrófono no permitido o no encontrado.');
      this.state = 'ERROR';
      return;
    }

    // Deepgram URL con WebSocket Real-time ultrarrápido (nova-2 model)
    const url = `wss://api.deepgram.com/v1/listen?language=es&model=nova-2&encoding=linear16&sample_rate=16000&channels=1&interim_results=true&endpointing=80`;
    this.socket = new WebSocket(url, ['token', token]);

    this.socket.onopen = () => {
      console.log('[Voice] Deepgram WebSocket conectado');
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
          // Limpiar caché de utterance si llega vacío y es final
          this.emittedColorsForUtterance = [];
        }
      } else if (res.type === 'Metadata') {
        console.log('[Voice] Sesión de Deepgram iniciada');
      } else if (res.type === 'Error') {
        console.error('[Voice] Deepgram error:', res.description);
        this.cb.onError(`Deepgram Error: ${res.description}`);
        this.stop();
      }
    };

    this.socket.onerror = (e) => {
      console.error('[Voice] Error en WebSocket', e);
      this.cb.onError('Error en la conexión con Deepgram');
      this.state = 'ERROR';
    };

    this.socket.onclose = () => {
      console.log('[Voice] WebSocket cerrado');
      this.stop();
    };
  }

  stop(): void {
    if (this.state === 'STOPPED') return;
    this.state = 'STOPPED';

    if (this.calibrationTimer) {
      window.clearTimeout(this.calibrationTimer);
      this.calibrationTimer = null;
    }

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
      this.mediaStream.getTracks().forEach(track => track.stop());
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
    
    // Cargar el AudioWorklet
    this.audioContext.audioWorklet.addModule('/audio-worklet.js').then(() => {
      if (!this.audioContext) return;
      
      // Crear el AudioWorkletNode
      this.processor = new AudioWorkletNode(this.audioContext!, 'audio-processor');
      
      source.connect(this.processor);
      this.processor.connect(this.audioContext!.destination);

      // Recibir datos procesados del worklet
      this.processor.port.onmessage = (event) => {
        if (this.socket?.readyState !== WebSocket.OPEN) return;

        const pcm16 = event.data.pcm16;
        
        const buffer = new ArrayBuffer(pcm16.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcm16.length; i++) {
          view.setInt16(i * 2, pcm16[i], true); // little-endian
        }
        
        // Deepgram acepta los bytes binarios directamente
        this.socket!.send(buffer);
      };
    }).catch(err => {
      console.error('[Voice] Error cargando AudioWorklet:', err);
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
        this.emittedColorsForUtterance = []; // Reiniciar rastreo por si hay silencios largos
      }
    }, CONFIG.voice?.silenceMs || 1500);
  }

  #processTranscript(text: string, isFinal: boolean) {
    this.#resetSilenceTimer();
    
    const colorsInText = this.#extractAllColors(text);
    
    // Comparar los colores detectados en el texto con los que ya emitimos en esta frase
    // Si hay más, son colores nuevos (ej: "rojo" -> "rojo verde", el verde es nuevo)
    for (let i = this.emittedColorsForUtterance.length; i < colorsInText.length; i++) {
        const newColor = colorsInText[i];
        this.emittedColorsForUtterance.push(newColor);
        
        // Deduplicación temporal: no emitir si es el mismo color en <150ms
        const now = Date.now();
        if (newColor === this.lastColorDetected && (now - this.lastColorEmitTime) < 150) {
            continue; // Skip duplicado
        }
        this.lastColorDetected = newColor;
        this.lastColorEmitTime = now;
        this.#enqueueColor(newColor);
    }
    
    if (isFinal) {
        this.emittedColorsForUtterance = []; // Final de frase, resetear para la próxima
    }
  }

  #enqueueColor(color: ColorName) {
    this.colorQueue.push(color);
    if (!this.isProcessingQueue) {
        this.#processQueue();
    }
  }

  #processQueue() {
    this.isProcessingQueue = true;
    while (this.colorQueue.length > 0) {
        const color = this.colorQueue.shift()!;
        
        const now = Date.now();
        console.log(`[Voice] 🎤 Deepgram: ${color.toUpperCase()} (T: ${now - this.lastColorTime}ms)`);
        
        // En modo calibración, limpiar timer al primer color detectado
        if (this.isCalibrationMode && this.calibrationTimer) {
          window.clearTimeout(this.calibrationTimer);
          this.calibrationTimer = null;
        }
        
        this.cb.onColor(color);
        this.lastColorTime = now;
    }
    this.isProcessingQueue = false;
  }

  #extractAllColors(text: string): ColorName[] {
    const normalized = text
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/gi, '');

    const words = normalized.split(/\s+/);
    const foundColors: ColorName[] = [];
    
    for (const w of words) {
      if (WORD_MAP.has(w)) {
        foundColors.push(WORD_MAP.get(w)!);
      }
    }
    
    return foundColors;
  }
}
