import {
  Engine, Scene, Color3, Color4, Vector3,
  ArcRotateCamera, HemisphericLight, SpotLight, PointLight,
} from '@babylonjs/core';
import { CannonJSPlugin } from '@babylonjs/core/Physics/v1/Plugins/cannonJSPlugin';
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent';
import * as CANNON from 'cannon-es';
import { CONFIG, DEG2RAD } from '../config';

(window as any).CANNON = CANNON;

export interface SceneContext {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
}

export function setupScene(canvas: HTMLCanvasElement): SceneContext {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.04, 0.04, 0.07, 1);

  const physicsPlugin = new CannonJSPlugin(true, 10, CANNON);
  scene.enablePhysics(new Vector3(0, -9.81, 0), physicsPlugin);

  const cam = new ArcRotateCamera(
    'cam',
    CONFIG.camera.alpha,
    CONFIG.camera.beta,
    CONFIG.camera.radius,
    new Vector3(0, CONFIG.camera.y, 0),
    scene,
  );
  cam.fov = CONFIG.camera.fovDeg * DEG2RAD;
  cam.attachControl(canvas, true);
  cam.lowerRadiusLimit = CONFIG.camera.minRadius;
  cam.upperRadiusLimit = CONFIG.camera.maxRadius;
  cam.panningSensibility = 0;  // bloquea Alt+drag para que no mueva el target
  cam.checkCollisions  = true;

  // --- Iluminación ambiente: muy tenue para crear atmósfera oscura ---
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity   = CONFIG.lighting.ambientIntensity;
  hemi.groundColor = new Color3(0.02, 0.02, 0.04);
  hemi.diffuse     = new Color3(0.15, 0.15, 0.25);  // tinte azulado nocturno

  // --- 4 focos estadio apuntando a la plataforma ---
  const target = new Vector3(0, CONFIG.platform.y, 0);
  const r = CONFIG.lighting.spotRadius;
  const h = CONFIG.lighting.spotHeight;
  const white = new Color3(1, 1, 1);
  [
    new Vector3( r, h,  r),
    new Vector3(-r, h,  r),
    new Vector3( r, h, -r),
    new Vector3(-r, h, -r),
  ].forEach((pos, i) => {
    const spot = new SpotLight(
      `spot${i}`, pos, target.subtract(pos).normalize(),
      CONFIG.lighting.spotAngle, CONFIG.lighting.spotExponent, scene,
    );
    spot.intensity = CONFIG.lighting.spotIntensity;
    spot.diffuse   = white;
  });

  // Spot cenital central sobre la plataforma (foco principal)
  const center = new SpotLight(
    'spotCenter',
    new Vector3(0, CONFIG.lighting.spotHeight, 0),
    new Vector3(0, -1, 0),
    CONFIG.lighting.centerAngle,
    CONFIG.lighting.spotExponent,
    scene,
  );
  center.intensity = CONFIG.lighting.centerIntensity;
  center.diffuse   = new Color3(1, 1, 1);

  // --- Luz blanca inferior de la plataforma ---
  const underlight = new PointLight(
    'platformUnderlight',
    new Vector3(0, CONFIG.lighting.underlightY, 0),
    scene,
  );
  underlight.intensity = CONFIG.lighting.underlightIntensity;
  underlight.diffuse   = new Color3(1, 1, 1);
  underlight.specular  = new Color3(0, 0, 0);

  // --- Log de valores de cámara en tiempo real (para ajustar defaults de CONFIG.camera) ---
  let camLogTimer: number | null = null;
  cam.onViewMatrixChangedObservable.add(() => {
    if (camLogTimer !== null) return;
    camLogTimer = window.setTimeout(() => {
      camLogTimer = null;
      const a = cam.alpha, b = cam.beta, r = cam.radius, ty = cam.target.y;
      const RAD2DEG = 180 / Math.PI;
      console.log(
        `[Camera] alpha=${a.toFixed(3)} (${(a * RAD2DEG).toFixed(1)}°)  ` +
        `beta=${b.toFixed(3)} (${(b * RAD2DEG).toFixed(1)}°)  ` +
        `radius=${r.toFixed(2)}  target.y=${ty.toFixed(2)}  ` +
        `→ config: { alpha: ${a.toFixed(3)}, beta: ${b.toFixed(3)}, radius: ${r.toFixed(2)}, y: ${ty.toFixed(2)} }`,
      );
    }, 200);
  });

  return { engine, scene, camera: cam };
}
