import {
  Engine, Scene, Color3, Color4, Vector3,
  ArcRotateCamera, HemisphericLight, DirectionalLight,
} from '@babylonjs/core';
import { CannonJSPlugin } from '@babylonjs/core/Physics/v1/Plugins/cannonJSPlugin';
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent';
import * as CANNON from 'cannon-es';
import { CONFIG, DEG2RAD } from '../config';

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
  cam.checkCollisions  = true;

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity   = 0.5;
  hemi.groundColor = new Color3(0.08, 0.08, 0.12);

  const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, 0.5).normalize(), scene);
  sun.intensity = 1.1;

  return { engine, scene, camera: cam };
}
