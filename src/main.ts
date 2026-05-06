// Register the GLB/GLTF loader as a side effect — must be imported before any SceneLoader calls.
import '@babylonjs/loaders/glTF';

import { setupScene } from './scene/SceneSetup';
import { UIManager } from './ui/UIManager';
import { GameManager } from './game/GameManager';

const canvas = document.getElementById('renderCanvas') as unknown as HTMLCanvasElement;

window.onerror = (_msg, _src, _line, _col, err) => {
  const box = document.getElementById('error-box');
  if (box) {
    box.style.display = 'block';
    box.textContent   = `ERROR: ${err?.stack ?? err}`;
  }
};

async function bootstrap() {
  const ui = new UIManager();
  const { engine, scene } = setupScene(canvas);

  const game = new GameManager(scene, ui);
  await game.init();

  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => engine.resize());
}

bootstrap().catch((err) => {
  console.error('[Rockey] Fatal init error:', err);
  const box = document.getElementById('error-box');
  if (box) {
    box.style.display = 'block';
    box.textContent   = `INIT ERROR:\n${err?.stack ?? err}`;
  }
});
