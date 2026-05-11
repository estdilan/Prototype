import {
  Scene, SceneLoader, MeshBuilder,
  Quaternion, AbstractMesh, Mesh, Vector3, Matrix,
} from '@babylonjs/core';
import { PhysicsImpostor } from '@babylonjs/core/Physics/v1/physicsImpostor';
import '@babylonjs/core/Physics/v1/physicsEngineComponent';
import { CONFIG } from '../config';
import type { UIManager } from '../ui/UIManager';

export interface PlatformResult {
  /** Root mesh that PlatformController rotates to tilt the platform. */
  collider: Mesh;
  /** The imported visual mesh, parented to the collider. */
  visualRoot: AbstractMesh;
}

// ---- Tunable layout constants (in platform local units) ----
const PLATFORM_HALF    = 8.0;   // half side of the GLB (16×16 platform)
const CENTER_HALF      = 6.4;   // half side of the central piece
const EDGE_BAR_WIDTH   = 1.0;   // outer border bar width
const CORNER_INSET     = 1.0;   // amount the rounded corner is pulled in
const SLIT_HALF_LENGTH = 3.6;  // half-length of the actual slit gap (perpendicular to slit's radial axis)

// Derived helpers
const EDGE_CENTER    = PLATFORM_HALF - EDGE_BAR_WIDTH / 2;        // 7.5
const EDGE_INNER     = PLATFORM_HALF - EDGE_BAR_WIDTH;            // 7.0  (inner edge of border bar)
const EDGE_LEN       = CENTER_HALF * 2;                           // 12.8 (length along the bar's long axis)

// Slit-end fill pieces: two boxes per slit fill the area between the slit's
// perpendicular extent and the center boundary so pellets only fall through
// the actual slit gap.
const FILL_THICK     = EDGE_INNER - CENTER_HALF;                  // radial width (between center and edge bar inner)
const FILL_RADIAL    = (CENTER_HALF + EDGE_INNER) / 2;            // radial center of the fill
const FILL_LEN       = CENTER_HALF - SLIT_HALF_LENGTH;            // length along the slit axis
const FILL_OFFSET    = (CENTER_HALF + SLIT_HALF_LENGTH) / 2;      // perpendicular offset of fill center

// Shape of one rounded corner (NE quadrant template).
// Three boxes leave the absolute (PLATFORM_HALF, PLATFORM_HALF) tip uncovered to mimic the round.
//   - inner: large square against the inside (closer to center)
//   - tipX:  thin strip extending outward along +X
//   - tipZ:  thin strip extending outward along +Z
type Section = { name: string; lx: number; lz: number; w: number; d: number; group: string };

// Number of sub-divisions used to approximate the rounded chamfer at the corner tip.
// Cells of the SUBDIV × SUBDIV grid whose center is below the diagonal cut are filled.
// Higher values → smoother curve (and more physics bodies).
const CORNER_SUBDIV = 4;

function buildCorner(
  group: string,
  signX: 1 | -1,
  signZ: 1 | -1,
): Section[] {
  // Corner spans from CENTER_HALF (touching orange fills + cyan edges)
  // to PLATFORM_HALF, with the absolute corner pulled in by CORNER_INSET
  // to simulate the rounded tip.
  const innerSize   = PLATFORM_HALF - CENTER_HALF - CORNER_INSET;
  const innerHalf   = innerSize / 2;
  const innerCenter = CENTER_HALF + innerHalf;

  const tipThick = CORNER_INSET;
  const tipLen   = innerSize;

  const sections: Section[] = [
    {
      name: `${group}_inner`,
      lx: signX * innerCenter,
      lz: signZ * innerCenter,
      w: innerSize,
      d: innerSize,
      group,
    },
    {
      name: `${group}_tipX`,
      lx: signX * (PLATFORM_HALF - tipThick / 2),
      lz: signZ * innerCenter,
      w: tipThick,
      d: tipLen,
      group,
    },
    {
      name: `${group}_tipZ`,
      lx: signX * innerCenter,
      lz: signZ * (PLATFORM_HALF - tipThick / 2),
      w: tipLen,
      d: tipThick,
      group,
    },
  ];

  // Staircase chamfer approximation: divide the outer CORNER_INSET × CORNER_INSET
  // square into a SUBDIV × SUBDIV sub-grid and fill only the cells below the
  // diagonal (i + j < SUBDIV - 1) so the uncovered region has a stepped curve.
  const subThick    = CORNER_INSET / CORNER_SUBDIV;
  const cornerStart = PLATFORM_HALF - CORNER_INSET;

  for (let i = 0; i < CORNER_SUBDIV; i++) {
    for (let j = 0; j < CORNER_SUBDIV; j++) {
      if (i + j >= CORNER_SUBDIV - 1) continue;
      const cx = cornerStart + (i + 0.5) * subThick;
      const cz = cornerStart + (j + 0.5) * subThick;
      sections.push({
        name: `${group}_chmf_${i}_${j}`,
        lx: signX * cx,
        lz: signZ * cz,
        w: subThick,
        d: subThick,
        group,
      });
    }
  }

  return sections;
}

export async function loadPlatform(scene: Scene, ui: UIManager): Promise<PlatformResult> {
  ui.setLoadingProgress(0.8, 'Cargando plataforma...');

  const result = await SceneLoader.ImportMeshAsync('', '/models/', 'platform.glb', scene, (evt) => {
    if (evt.total > 0) {
      const pct = 0.8 + (evt.loaded / evt.total) * 0.2;
      ui.setLoadingProgress(pct, 'Cargando plataforma...');
    }
  });

  const visualRoot = result.meshes[0];
  visualRoot.position.setAll(0);
  visualRoot.rotationQuaternion = Quaternion.Identity();
  visualRoot.computeWorldMatrix(true);
  visualRoot.getChildMeshes().forEach(m => m.computeWorldMatrix(true));

  const { min, max } = visualRoot.getHierarchyBoundingVectors(true);
  const size = max.subtract(min);
  const boundsCenter = min.add(max).scale(0.5);
  const h = size.y > 0.01 ? size.y : CONFIG.platform.height;

  console.log(`[Platform] GLB bounds: ${size.x.toFixed(2)} × ${h.toFixed(2)} × ${size.z.toFixed(2)}`);
  console.log(`[Platform] Bounds center offset: ${boundsCenter.x.toFixed(3)}, ${boundsCenter.y.toFixed(3)}, ${boundsCenter.z.toFixed(3)}`);

  // Root mesh — no physics impostor. PlatformController rotates this.
  const root = new Mesh('platform_root', scene);
  root.isVisible = false;
  root.position.y = CONFIG.platform.y;
  root.rotationQuaternion = Quaternion.Identity();

  // 13-piece layout: 1 center + 4 edge bars + 4 corners (3 sub-boxes each).
  //
  //   [corner_nw] [edge_n] [corner_ne]
  //   [edge_w]    [CENTRO] [edge_e]
  //   [corner_sw] [edge_s] [corner_se]
  //
  const sectionDefs: Section[] = [
    // Center
    { name: 'center', lx: 0, lz: 0, w: CENTER_HALF * 2, d: CENTER_HALF * 2, group: 'center' },

    // Edge bars (outer border between corners)
    { name: 'edge_n', lx:  0,            lz:  EDGE_CENTER, w: EDGE_LEN,       d: EDGE_BAR_WIDTH, group: 'edge' },
    { name: 'edge_s', lx:  0,            lz: -EDGE_CENTER, w: EDGE_LEN,       d: EDGE_BAR_WIDTH, group: 'edge' },
    { name: 'edge_e', lx:  EDGE_CENTER,  lz:  0,           w: EDGE_BAR_WIDTH, d: EDGE_LEN,       group: 'edge' },
    { name: 'edge_w', lx: -EDGE_CENTER,  lz:  0,           w: EDGE_BAR_WIDTH, d: EDGE_LEN,       group: 'edge' },

    // Slit-end fills (8 pieces — 2 per slit, between center boundary and the actual slit ends)
    { name: 'fill_xpos_zpos', lx:  FILL_RADIAL, lz:  FILL_OFFSET, w: FILL_THICK, d: FILL_LEN,   group: 'fill' },
    { name: 'fill_xpos_zneg', lx:  FILL_RADIAL, lz: -FILL_OFFSET, w: FILL_THICK, d: FILL_LEN,   group: 'fill' },
    { name: 'fill_xneg_zpos', lx: -FILL_RADIAL, lz:  FILL_OFFSET, w: FILL_THICK, d: FILL_LEN,   group: 'fill' },
    { name: 'fill_xneg_zneg', lx: -FILL_RADIAL, lz: -FILL_OFFSET, w: FILL_THICK, d: FILL_LEN,   group: 'fill' },
    { name: 'fill_zpos_xpos', lx:  FILL_OFFSET, lz:  FILL_RADIAL, w: FILL_LEN,   d: FILL_THICK, group: 'fill' },
    { name: 'fill_zpos_xneg', lx: -FILL_OFFSET, lz:  FILL_RADIAL, w: FILL_LEN,   d: FILL_THICK, group: 'fill' },
    { name: 'fill_zneg_xpos', lx:  FILL_OFFSET, lz: -FILL_RADIAL, w: FILL_LEN,   d: FILL_THICK, group: 'fill' },
    { name: 'fill_zneg_xneg', lx: -FILL_OFFSET, lz: -FILL_RADIAL, w: FILL_LEN,   d: FILL_THICK, group: 'fill' },

    // Corners (3 boxes each to approximate rounded shape)
    ...buildCorner('ne',  1,  1),
    ...buildCorner('nw', -1,  1),
    ...buildCorner('se',  1, -1),
    ...buildCorner('sw', -1, -1),
  ];

  const sections: Array<{ box: Mesh; lx: number; lz: number }> = [];

  for (const s of sectionDefs) {
    if (s.w <= 0 || s.d <= 0) continue;  // skip degenerate sections
    const box = MeshBuilder.CreateBox(`platform_${s.name}`, { width: s.w, height: h, depth: s.d }, scene);
    box.isVisible        = false;
    box.checkCollisions  = true;
    box.rotationQuaternion = Quaternion.Identity();
    box.position.set(s.lx, CONFIG.platform.y, s.lz);
    box.physicsImpostor = new PhysicsImpostor(
      box,
      PhysicsImpostor.BoxImpostor,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { mass: 0, restitution: CONFIG.platform.restitution, friction: CONFIG.platform.friction, disablePreStep: false } as any,
      scene,
    );
    sections.push({ box, lx: s.lx, lz: s.lz });
  }

  // Pre-allocate temporaries to avoid GC pressure each frame.
  const _rotMat = Matrix.Identity();
  const _local  = Vector3.Zero();
  const _world  = Vector3.Zero();

  scene.registerBeforeRender(() => {
    const q = root.rotationQuaternion!;
    Matrix.FromQuaternionToRef(q, _rotMat);

    for (const { box, lx, lz } of sections) {
      _local.set(lx, 0, lz);
      Vector3.TransformNormalToRef(_local, _rotMat, _world);
      box.position.set(_world.x, CONFIG.platform.y + _world.y, _world.z);
      box.rotationQuaternion!.copyFrom(q);
    }
  });

  // Visual mesh parented to root with centering offset.
  visualRoot.parent = root;
  visualRoot.position = new Vector3(
    -boundsCenter.x,
    -boundsCenter.y + CONFIG.platform.visualOffsetY,
    -boundsCenter.z,
  );

  return { collider: root as unknown as Mesh, visualRoot };
}
