import {
  Scene, SceneLoader, MeshBuilder,
  Vector3, AbstractMesh, TransformNode,
  PBRMaterial, Color3,
} from '@babylonjs/core';
import { PhysicsImpostor } from '@babylonjs/core/Physics/v1/physicsImpostor';
import '@babylonjs/core/Physics/v1/physicsEngineComponent';
import { CONFIG } from '../config';
import { SlitDetector } from './SlitDetector';
import type { UIManager } from '../ui/UIManager';
import type { AudioManager } from '../audio/AudioManager';

interface Pellet {
  physMesh: AbstractMesh;
  visual: TransformNode;
}

export class PelletManager {
  private scene: Scene;
  private ui: UIManager;
  private slit: SlitDetector;
  private audio: AudioManager;
  private pellets: Pellet[] = [];
  private counter = 0;
  private score = 0;
  private currentSpawnPoint = 0;

  private templateRoot: AbstractMesh | null = null;
  private pelletDims = { radius: 0.2, height: 0.1 };
  private visualOffset = Vector3.Zero();

  onVictory?: () => void;

  constructor(scene: Scene, ui: UIManager, slit: SlitDetector, audio: AudioManager) {
    this.scene = scene;
    this.ui    = ui;
    this.slit  = slit;
    this.audio = audio;
  }

  async init(): Promise<void> {
    const result = await SceneLoader.ImportMeshAsync('', '/models/', 'pellet.glb', this.scene);
    const root = result.meshes[0];
    root.scaling.setAll(CONFIG.pellets.scale);
    // Rotate so the disc lies flat (converts Z-up FBX orientation to Y-up)
    root.rotation.x = Math.PI / 2;
    root.computeWorldMatrix(true);
    root.getChildMeshes().forEach(m => m.computeWorldMatrix(true));

    const { min, max } = root.getHierarchyBoundingVectors(true);
    const size = max.subtract(min);
    const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
    const bbCenter = min.add(max).scale(0.5);
    // physHeight is explicit in config so it can be tuned independently of the GLB bounding box.
    // visualOffset.y = -physHeight/2 ensures the disc bottom sits flush on the platform surface.
    this.pelletDims = { radius: dims[2] / 2, height: CONFIG.pellets.physHeight };
    this.visualOffset = new Vector3(-bbCenter.x, CONFIG.pellets.physBase, -bbCenter.z);

    const mat = new PBRMaterial('pelletMat', this.scene);
    mat.albedoColor = new Color3(0.12, 0.12, 0.12);
    mat.metallic = 0.2;
    mat.roughness = 0.75;
    root.getChildMeshes().forEach(m => { m.material = mat; });

    root.setEnabled(false);
    this.templateRoot = root;
  }

  spawn(): void {
    const pos = this.#getSpawnPos();
    const name = `p${this.counter++}`;

    // Box collider ajustado al tamaño del pellet (mejor rendimiento y detección)
    const width = this.pelletDims.radius * 2;
    const height = this.pelletDims.height;
    const depth = this.pelletDims.radius * 2;

    const physMesh = MeshBuilder.CreateBox(name, {
      width: width,
      height: height,
      depth: depth,
    }, this.scene);
    physMesh.isVisible = false;
    physMesh.isPickable = false;
    physMesh.position.set(pos.x, pos.y, pos.z);

    const visual = this.templateRoot!.instantiateHierarchy(physMesh)!;
    visual.position.copyFrom(this.visualOffset);
    visual.setEnabled(true);

    physMesh.physicsImpostor = new PhysicsImpostor(
      physMesh,
      PhysicsImpostor.BoxImpostor,
      { mass: CONFIG.pellets.mass, restitution: CONFIG.pellets.restitution, friction: CONFIG.pellets.friction },
      this.scene,
    );

    const body = physMesh.physicsImpostor.physicsBody;
    body.linearDamping  = CONFIG.pellets.linearDamping;
    body.angularDamping = CONFIG.pellets.angularDamping;
    body.allowSleep     = true;
    body.sleepSpeedLimit = 0.5;
    body.sleepTimeLimit  = 1.0;
    // Permitir rotación libre en todos los ejes para comportamiento granular natural
    body.angularFactor.set(1, 1, 1);

    physMesh.physicsImpostor.setLinearVelocity(new Vector3(0, CONFIG.pellets.initialVelocityY, 0));

    this.pellets.push({ physMesh, visual });
  }

  update(): void {
    const { exitY, safetyY, maxUpVelocityY } = CONFIG.pellets;

    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const { physMesh } = this.pellets[i];
      const { x, y, z } = physMesh.position;

      const body = physMesh.physicsImpostor?.physicsBody;
      if (body && body.velocity.y > maxUpVelocityY) {
        body.velocity.y = maxUpVelocityY;
      }

      if (y < exitY) {
        if (this.slit.isInSlit(x, z)) {
          this.#score(i);
        } else {
          this.#respawn(i);
        }
        continue;
      }

      if (y < safetyY) {
        this.#respawn(i);
      }
    }
  }

  get currentScore(): number { return this.score; }

  enableSlideMode(): void {
    const { playLinearDamping, playAngularDamping } = CONFIG.pellets;
    for (const { physMesh } of this.pellets) {
      const impostor = physMesh.physicsImpostor;
      if (!impostor) continue;
      const body = impostor.physicsBody;
      body.linearDamping  = playLinearDamping;
      body.angularDamping = playAngularDamping;
      // Fricción suficiente para no desparramar en reposo, pero cede al inclinar
      if (body.material) {
        body.material.friction    = 0.12;
        body.material.restitution = 0.03;
      }
    }
  }

  #getSpawnPos() {
    const points = CONFIG.pellets.spawnPoints;
    const point = points[this.currentSpawnPoint % points.length];
    this.currentSpawnPoint++;
    // Mínima variación para montaña compacta
    const jitter = 0.05;
    return {
      x: point.x + (Math.random() - 0.5) * jitter * 2,
      y: point.y + Math.random() * 0.3,
      z: point.z + (Math.random() - 0.5) * jitter * 2,
    };
  }

  #respawn(idx: number): void {
    const { physMesh } = this.pellets[idx];
    const p = this.#getSpawnPos();
    physMesh.position.set(p.x, p.y, p.z);
    physMesh.physicsImpostor?.setLinearVelocity(new Vector3(0, CONFIG.pellets.respawnVelocityY, 0));
    physMesh.physicsImpostor?.setAngularVelocity(Vector3.Zero());
  }

  #score(idx: number): void {
    const { physMesh, visual } = this.pellets[idx];
    visual.dispose();
    physMesh.physicsImpostor?.dispose();
    physMesh.dispose();
    this.pellets.splice(idx, 1);

    this.score++;
    this.ui.updateScore(this.score);
    this.audio.playClick();

    if (this.score >= CONFIG.pellets.total) {
      this.onVictory?.();
    }
  }
}
