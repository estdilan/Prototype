export const DEG2RAD = Math.PI / 180;

export type ColorName = 'rojo' | 'azul' | 'verde' | 'amarillo';

export const CONFIG = {
  pellets: {
    total: 100,
    spawnIntervalMs: 8,
    scale: 0.4,
    spawnXZ: 3.2,
    spawnYMin: 6.0,
    spawnYMax: 18,
    exitY: 2.0,
    safetyY: -20,
    physHeight: 0.20,
    physBase: -0.28,   // Y offset del visual relativo al centro del cilindro físico; tantear junto con physHeight
    mass: 5,
    restitution: 0.08,
    friction: 0.02,
    linearDamping: 0.06,
    angularDamping: 0.35,
    initialVelocityY: -18,
    respawnVelocityY: -15,
    maxUpVelocityY: 6,
  },
  platform: {
    // Fallback dimensions used if platform.glb bounding box cannot be computed.
    // Tune after inspecting the model in-browser.
    width: 12,
    height: 0.5,
    depth: 12,
    y: 4.4,
    visualOffsetY: 0,   // desplaza solo el mesh visual de la plataforma; tantear en pasos de 0.05 para cerrar el gap
    restitution: 0.05,
    friction: 0.02,
  },
  // Slit AABBs in world space (platform center at origin).
  // These define where pellets pass through to score.
  // Tune these values to match the actual gaps in platform.glb.
  slits: [
    { xMin:  6.4, xMax:  7.0,  zMin: -3.6, zMax:  3.6 },  // +X gap
    { xMin: -7.0, xMax: -6.4,  zMin: -3.6, zMax:  3.6 },  // -X gap
    { xMin: -3.6, xMax:  3.6,  zMin:  6.4, zMax:  7.0 },  // +Z gap
    { xMin: -3.6, xMax:  3.6,  zMin: -7.0, zMax: -6.4 },  // -Z gap
  ],
  tilt: {
    baseDeg: 8,
    maxDeg: 20,
    incrementDeg: 4,
    baseHoldSec: 1.2,
    holdIncrementSec: 0.4,
    snapSpeed: 20,
    returnSpeed: 4,
    silenceSpeed: 6,
  },
  voice: {
    silenceMs: 1600,
    colorLockMs: 400,
    lang: 'es-ES',
    engine: (import.meta.env.VITE_VOICE_ENGINE ?? 'deepgram') as 'deepgram' | 'vosk',
    voskModelUrl: (import.meta.env.VITE_VOSK_MODEL_URL ?? '/models/vosk-model-small-es-0.42.tar.gz') as string,
  },
  jumbotron: {
    x: 0,
    y: 15,    // suspendido sobre la plataforma; subir para más alto, bajar para más cerca
    z: 0,
    scale: 0.008,  // el modelo nativo mide ~1200 unidades, scale chico para que quepa
  },
  stadium: {
    y: 3,     // altura del estadio; subir para elevarlo respecto a la plataforma
    scale: 55.0,
  },
  lighting: {
    ambientIntensity: 0.08,   // luz ambiente general; subir para iluminar todo, bajar para más contraste
    spotHeight: 28,           // altura desde la que bajan los 4 focos esquineros
    spotRadius: 18,           // distancia horizontal de cada foco al centro
    spotAngle: Math.PI / 3.5, // apertura del cono (mayor = haz más ancho)
    spotExponent: 2,          // suavidad del borde del cono
    spotIntensity: 800,       // brillo de cada foco esquinero
    centerAngle: Math.PI / 4, // apertura del foco cenital
    centerIntensity: 400,     // brillo del foco cenital sobre la plataforma
  },
  camera: {
    alpha: -0.499,       // ~-28.6°, encuadre elegido en runtime
    beta: 1.054,         // ~60.4°
    y: 2.00,
    radius: 60.00,
    fovDeg: 28,
    minRadius: 50,       // evita zoom-in extremo (impide llegar a la vista cerrada tipo img2)
    maxRadius: 80,
  },
  colors: {
    rojo:     { hex: '#e74c3c', r: 0.91, g: 0.30, b: 0.24 },
    azul:     { hex: '#3498db', r: 0.20, g: 0.60, b: 0.86 },
    verde:    { hex: '#2ecc71', r: 0.18, g: 0.80, b: 0.44 },
    amarillo: { hex: '#f1c40f', r: 0.95, g: 0.77, b: 0.06 },
  },
  colorToTilt: {
    rojo:     { x:  1, z: -1 },
    azul:     { x:  1, z:  1 },
    verde:    { x: -1, z:  1 },
    amarillo: { x: -1, z: -1 },
  } as Record<ColorName, { x: number; z: number }>,
  game: {
    timerSeconds: 60,
    warningThresholdSec: 30,
  },
  calibration: {
    timeoutMs: 8000,        // Tiempo máximo para detectar un color
    maxRetries: 2,          // Reintentos después de timeout
    minAudioLevel: 0.05,    // Nivel mínimo de audio detectado
    feedbackDurationMs: 600, // Duración de retroalimentación visual
    words: ['rojo', 'azul', 'verde', 'amarillo'] as ColorName[],
  },
};
