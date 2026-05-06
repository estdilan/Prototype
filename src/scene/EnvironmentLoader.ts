import { Scene, SceneLoader } from '@babylonjs/core';
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
  stadiumResult.meshes[0].scaling.setAll(0.5);

  // --- Jumbotron ---
  ui.setLoadingProgress(0.6, 'Cargando jumbotron...');
  await SceneLoader.ImportMeshAsync('', '/models/', 'jumbotron.glb', scene, (evt) => {
    if (evt.total > 0) {
      // Scale jumbotron progress to 60-80% of total loading bar
      const pct = 0.6 + (evt.loaded / evt.total) * 0.2;
      ui.setLoadingProgress(pct, 'Cargando jumbotron...');
    }
  });
}
