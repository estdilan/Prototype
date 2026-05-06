export const DEG2RAD = Math.PI / 180;

export type ColorName = 'rojo' | 'azul' | 'verde' | 'amarillo';

export const CONFIG = {
  pellets: {
    total: 100,
    spawnIntervalMs: 8,
    diameter: 0.4,
    segments: 5,
    spawnXZ: 3.2,
    spawnYMin: 6.0,
    spawnYMax: 18,
    exitY: 2.0,
    safetyY: -20,
    mass: 4,
    restitution: 0.10,
    friction: 0.55,
    initialVelocityY: -18,
    respawnVelocityY: -15,
  },
  platform: {
    // Fallback dimensions used if platform.glb bounding box cannot be computed.
    // Tune after inspecting the model in-browser.
    width: 12,
    height: 0.5,
    depth: 12,
    y: 3,
    restitution: 0.05,
    friction: 0.6,
  },
  // Slit AABBs in world space (platform center at origin).
  // These define where pellets pass through to score.
  // Tune these values to match the actual gaps in platform.glb.
  slits: [
    { xMin:  6.4, xMax:  11,   zMin: -3.45, zMax:  3.45 },  // +X gap
    { xMin: -11,  xMax: -6.4,  zMin: -3.45, zMax:  3.45 },  // -X gap
    { xMin: -3.45, xMax: 3.45, zMin:  6.4,  zMax:  11   },  // +Z gap
    { xMin: -3.45, xMax: 3.45, zMin: -11,   zMax: -6.4  },  // -Z gap
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
  },
  camera: {
    alpha: -Math.PI / 4,
    beta: Math.acos(14 / 20),
    radius: 20,
    fovDeg: 60,
    minRadius: 8,
    maxRadius: 50,
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
};
