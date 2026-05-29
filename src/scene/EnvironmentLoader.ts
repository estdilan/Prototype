import { Scene, SceneLoader, Vector3 } from '@babylonjs/core';
import { CONFIG } from '../config';
import type { UIManager } from '../ui/UIManager';

// Stadium.glb is large (42 MB). Optimize it with gltf-transform before shipping:
//   npx gltf-transform optimize public/models/stadium.glb public/models/stadium.opt.glb
// Target: < 8 MB (KTX2 textures + Draco mesh compression).

export async function loadEnvironment(scene: Scene, ui: UIManager): Promise<void> {
  // --- Stadium (background) ---
  ui.setLoadingProgress(0, 'Cargando estadio...');
  const stadiumResult = await SceneLoader.ImportMeshAsync('', '/models/', 'stadium.glb', scene, (evt) => {
    if (evt.total > 0) {
      // Scale stadium progress to 0-60% of total loading bar
      const pct = (evt.loaded / evt.total) * 0.6;
      ui.setLoadingProgress(pct, 'Cargando estadio...');
    }
  });
  stadiumResult.meshes[0].scaling.setAll(CONFIG.stadium.scale);
  stadiumResult.meshes[0].position.y = CONFIG.stadium.y;
  stadiumResult.meshes.forEach(m => { m.checkCollisions = true; });

  // --- Jumbotron ---
  ui.setLoadingProgress(0.6, 'Cargando jumbotron...');
  const jumbotronResult = await SceneLoader.ImportMeshAsync('', '/models/', 'jumbotron.glb', scene, (evt) => {
    if (evt.total > 0) {
      const pct = 0.6 + (evt.loaded / evt.total) * 0.2;
      ui.setLoadingProgress(pct, 'Cargando jumbotron...');
    }
  });
  const jRoot = jumbotronResult.meshes[0];
  jRoot.position = new Vector3(CONFIG.jumbotron.x, CONFIG.jumbotron.y, CONFIG.jumbotron.z);
  jRoot.scaling.setAll(CONFIG.jumbotron.scale);
  const jBounds = jRoot.getHierarchyBoundingVectors(true);
  console.log(`[Jumbotron] bounds size: ${(jBounds.max.x - jBounds.min.x).toFixed(2)} × ${(jBounds.max.y - jBounds.min.y).toFixed(2)} × ${(jBounds.max.z - jBounds.min.z).toFixed(2)}`);
  console.log(`[Jumbotron] position: ${jRoot.position}`);
}
