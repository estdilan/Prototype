import {
  Scene, MeshBuilder, StandardMaterial, Color3,
  Vector3, PhysicsImpostor, AbstractMesh,
} from '@babylonjs/core';
import { CONFIG } from '../config';
import { SlitDetector } from './SlitDetector';
import type { UIManager } from '../ui/UIManager';

interface Pellet {
  mesh: AbstractMesh;
}

export class PelletManager {
  private scene: Scene;
  private ui: UIManager;
  private slit: SlitDetector;
  private pellets: Pellet[] = [];
  private counter = 0;
  private material: StandardMaterial;
  private score = 0;

  onVictory?: () => void;

  constructor(scene: Scene, ui: UIManager, slit: SlitDetector) {
    this.scene = scene;
    this.ui    = ui;
    this.slit  = slit;

    this.material = new StandardMaterial('pelletMat', scene);
    this.material.diffuseColor  = new Color3(0.92, 0.87, 0.72);
    this.material.specularColor = new Color3(0.25, 0.25, 0.25);
  }

  spawn(): void {
    const pos = this.#randomPos();
    const mesh = MeshBuilder.CreateSphere(
      `p${this.counter++}`,
      { diameter: CONFIG.pellets.diameter, segments: CONFIG.pellets.segments },
      this.scene,
    );
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.material   = this.material;
    mesh.isPickable = false;

    mesh.physicsImpostor = new PhysicsImpostor(
      mesh,
      PhysicsImpostor.SphereImpostor,
      { mass: CONFIG.pellets.mass, restitution: CONFIG.pellets.restitution, friction: CONFIG.pellets.friction },
      this.scene,
    );
    mesh.physicsImpostor.setLinearVelocity(new Vector3(0, CONFIG.pellets.initialVelocityY, 0));

    this.pellets.push({ mesh });
  }

  update(): void {
    const { exitY, safetyY } = CONFIG.pellets;

    // Iterate backwards so splicing is safe
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const { mesh } = this.pellets[i];
      const { x, y, z } = mesh.position;

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

  #randomPos() {
    const { spawnXZ, spawnYMin, spawnYMax } = CONFIG.pellets;
    return {
      x: (Math.random() - 0.5) * spawnXZ * 2,
      y: spawnYMin + Math.random() * (spawnYMax - spawnYMin),
      z: (Math.random() - 0.5) * spawnXZ * 2,
    };
  }

  #respawn(idx: number): void {
    const { mesh } = this.pellets[idx];
    const p = this.#randomPos();
    mesh.position.set(p.x, p.y, p.z);
    mesh.physicsImpostor?.setLinearVelocity(new Vector3(0, CONFIG.pellets.respawnVelocityY, 0));
    mesh.physicsImpostor?.setAngularVelocity(Vector3.Zero());
  }

  #score(idx: number): void {
    const { mesh } = this.pellets[idx];
    mesh.physicsImpostor?.dispose();
    mesh.dispose();
    this.pellets.splice(idx, 1);

    this.score++;
    this.ui.updateScore(this.score);

    if (this.score >= CONFIG.pellets.total) {
      this.onVictory?.();
    }
  }
}
