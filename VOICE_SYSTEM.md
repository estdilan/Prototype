# Sistema de Reconocimiento de Voz - Documentación de Integración

## 📋 Descripción General

Este documento contiene toda la información necesaria para integrar el sistema de reconocimiento de voz en tu rama `main`. El sistema utiliza **Deepgram** como API de reconocimiento de voz en tiempo real y detecta comandos de colores en español.

---

## 📁 Archivos Necesarios (3 archivos)

| # | Archivo | Ubicación | Descripción |
|---|---------|-----------|-------------|
| 1 | `VoiceController.ts` | `src/voice/` | Clase principal que gestiona reconocimiento de voz con Deepgram |
| 2 | `audio-worklet.js` | `public/` | Procesa audio en tiempo real usando Web Audio API |
| 3 | Configuración en `config.ts` | `src/` | Constantes de configuración de voz |

---

## 🔧 Configuración Previa

### 1. Crear archivo `.env.local`

En la raíz del proyecto, crea un archivo `.env.local` con tu API Key de Deepgram:

```env
VITE_DEEPGRAM_TOKEN=tu_api_key_deepgram_aqui
```

**¿Cómo obtener tu API Key de Deepgram?**
1. Ve a https://console.deepgram.com
2. Crea una cuenta o inicia sesión
3. Ve a la sección de API Keys
4. Crea una nueva clave (asegúrate de que tenga permisos de "listen")
5. Copia la clave y pégala en el `.env.local`

### 2. Actualizar `tsconfig.json`

Asegúrate de que tu `tsconfig.json` incluya soporte para Web Workers:

```json
{
  "compilerOptions": {
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "target": "ES2020"
  }
}
```

---

## 📄 Archivo 1: `src/voice/VoiceController.ts`

**Ubicación:** `src/voice/VoiceController.ts`

**Descripción:** Clase principal que gestiona toda la lógica de reconocimiento de voz. Se conecta a Deepgram, captura audio del micrófono, procesa transcripciones y detecta comandos de colores.

**Características:**
- Conexión WebSocket con Deepgram en tiempo real
- Detección de colores en español (rojo, azul, verde, amarillo)
- Sistema de cola de colores para procesamiento ordenado
- Deduplicación temporal de comandos
- Manejo de silencios con timeouts configurables

```typescript
import { CONFIG, type ColorName } from '../configuracion';

type VoiceCallback = {
  onColor: (color: ColorName) => void;
  onSilence: () => void;
  onError: (message: string) => void;
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

  async start(): Promise<void> {
    if (this.state === 'LISTENING') return;
    this.state = 'LISTENING';

    const token = ((import.meta as any).env.VITE_DEEPGRAM_TOKEN);
    if (!token) {
      this.cb.onError('Falta el token de Deepgram en el .env');
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
```

---

## 📄 Archivo 2: `public/audio-worklet.js`

**Ubicación:** `public/audio-worklet.js`

**Descripción:** AudioWorklet que se ejecuta en un hilo separado del navegador. Convierte el audio de float32 a PCM16 (formato que Deepgram espera) y lo envía al hilo principal.

**Características:**
- Conversión eficiente de formato de audio
- Procesamiento en hilo separado sin bloquear la UI
- Compatible con navegadores modernos

```javascript
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const inputData = inputs[0][0];
    
    if (inputData && this.port) {
      // Convertir float32 [-1.0, 1.0] a int16 [-32768, 32767]
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      // Enviar datos procesados al hilo principal
      this.port.postMessage({ pcm16: pcm16 });
    }
    
    return true; // Continuar procesando
  }
}

registerProcessor('audio-processor', AudioProcessor);
```

---

## 📄 Archivo 3: Configuración en `src/config.ts`

**Ubicación:** `src/config.ts` (agregar a la configuración existente)

**Descripción:** Constantes de configuración para el sistema de voz.

**Lo que necesitas agregar a tu `configuracion.ts`:**

```typescript
// En el objeto CONFIG, agregar o asegurarse que exista:
voice: {
  silenceMs: 1000,      // Milisegundos para detectar silencio
  colorLockMs: 400,     // Milisegundos de cooldown entre colores
  lang: 'es-ES',        // Idioma del reconocimiento
},
```

---

## 🚀 Pasos de Integración en la Rama Main

Sigue estos pasos para integrar el sistema en tu rama `main`:

### Paso 1: Crear carpeta
```bash
mkdir -p src/voice
```

### Paso 2: Crear archivos

1. **Crea `src/voice/VoiceController.ts`** con el código del Archivo 1 (arriba)
2. **Crea `public/audio-worklet.js`** con el código del Archivo 2 (arriba)

### Paso 3: Actualizar configuración

En `src/config.ts`, busca el objeto `CONFIG` y asegúrate de que incluya:

```typescript
export const CONFIG = {
  // ... configuración existente ...
  voice: {
    silenceMs: 1000,
    colorLockMs: 400,
    lang: 'es-ES',
  },
  // ... más configuración ...
};
```

### Paso 4: Crear `.env.local`

En la raíz del proyecto, crea `.env.local`:

```env
VITE_DEEPGRAM_TOKEN=tu_api_key_aqui
```

### Paso 5: Actualizar `tsconfig.json`

Asegúrate de que incluya:
```json
{
  "compilerOptions": {
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "target": "ES2020"
  }
}
```

### Paso 6: Usar en tu código

Ejemplo de cómo usar `VoiceController` en tu componente:

```typescript
import { VoiceController } from './voice/VoiceController';

const voiceController = new VoiceController({
  onColor: (color) => {
    console.log('Color detectado:', color);
    // Aquí puedes hacer lo que quieras con el color
  },
  onSilence: () => {
    console.log('Se detectó silencio');
  },
  onError: (error) => {
    console.error('Error en voz:', error);
  },
});

// Iniciar reconocimiento
await voiceController.start();

// Detener reconocimiento
voiceController.stop();
```

---

## 🎯 Colores Soportados

El sistema detecta estos colores en español:

| Color | Palabras reconocidas |
|-------|---------------------|
| **rojo** | rojo, roja, red, roj, roho, loco, ojo |
| **azul** | azul, blue, asul, azu, sub |
| **verde** | verde, green, berde, ver, vende |
| **amarillo** | amarillo, amarilla, yellow, ama, amarilo, yelo, mario |

---

## ⚙️ Configuración Personalizable

Todos estos valores se pueden ajustar en `CONFIG.voice`:

- **`silenceMs`** (1000): Milisegundos de silencio para activar el callback `onSilence()`
- **`colorLockMs`** (400): Tiempo de espera mínimo entre detecciones del mismo color
- **`lang`** ('es-ES'): Idioma del reconocimiento de voz

---

## 🔗 Dependencias Necesarias

Asegúrate de que tu `package.json` tenga:

```json
{
  "dependencies": {
    "three": "^latest",
    "vite": "^8.0.0"
  }
}
```

No se requieren dependencias adicionales para el sistema de voz, ya que utiliza APIs nativas del navegador.

---

## 🐛 Solución de Problemas

### Error: "Falta el token de Deepgram"
**Solución:** Crea el archivo `.env.local` en la raíz con `VITE_DEEPGRAM_TOKEN=tu_token`

### Error: "Micrófono no permitido"
**Solución:** El navegador rechazó el acceso al micrófono. Verifica los permisos del sitio en el navegador.

### No detecta colores
**Solución:** Verifica que estés pronunciando claro y que el diccionario `COLOR_DICTIONARY` incluya la variante que usas.

### AudioWorklet no se carga
**Solución:** Asegúrate de que `audio-worklet.js` está en la carpeta `public/`

---

## 📞 Soporte

Si tienes preguntas sobre Deepgram, consulta: https://developers.deepgram.com/docs

---

**Versión:** 1.0  
**Última actualización:** Mayo 2026
