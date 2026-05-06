import { CONFIG } from '../config';

interface SlitAABB {
  xMin: number; xMax: number;
  zMin: number; zMax: number;
}

export class SlitDetector {
  private slits: readonly SlitAABB[];

  constructor(slits: readonly SlitAABB[] = CONFIG.slits) {
    this.slits = slits;
  }

  isInSlit(x: number, z: number): boolean {
    for (const s of this.slits) {
      if (x >= s.xMin && x <= s.xMax && z >= s.zMin && z <= s.zMax) return true;
    }
    return false;
  }
}
