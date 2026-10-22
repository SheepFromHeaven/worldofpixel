import type { Ramp } from './color.ts';
import { rampAt } from './color.ts';
import type { Field, Mask } from './field.ts';
import { bayer, measure, noise } from './field.ts';
import type { Grid } from './grid.ts';
import { createGrid, put } from './grid.ts';
import type { Light } from './light.ts';
import { illuminate, normalize } from './light.ts';

export type Profile = (depth: number, deepest: number) => number;

export const dome: Profile = (depth, deepest) => {
  const t = 1 - depth / (deepest || 1);
  return Math.sqrt(Math.max(0, 1 - t * t));
};

export const basin: Profile = (depth, deepest) => -dome(depth, deepest);

export const cone: Profile = (depth, deepest) => depth / (deepest || 1);

export const flat: Profile = () => 0;

export interface Material {
  ramp: Ramp;
  warm?: Ramp;
  profile?: Profile;
  relief?: number;
  ambient?: number;
  contrast?: number;
  density?: number;
  speckle?: number;
}

export interface Region {
  mask: Mask;
  material: Material;
}

function normalAt(field: Field, profile: Profile, relief: number, x: number, y: number) {
  const height = (hx: number, hy: number): number =>
    profile(field.depth(hx, hy), field.deepest) * relief;

  const slopeX = (height(x + 1, y) - height(x - 1, y)) / 2;
  const slopeY = (height(x, y + 1) - height(x, y - 1)) / 2;
  return normalize([-slopeX * relief, -slopeY * relief, 1]);
}

export function shade(size: number, regions: readonly Region[], lights: readonly Light[]): Grid {
  const grid = createGrid(size);

  for (const [index, region] of regions.entries()) {
    const field = measure(size, region.mask);
    const profile = region.material.profile ?? dome;
    const relief = region.material.relief ?? 2;
    const ambient = region.material.ambient ?? 0.15;
    const contrast = region.material.contrast ?? 0.7;
    const density = region.material.density ?? 0;
    const speckle = region.material.speckle ?? 0;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!region.mask(x, y)) continue;

        const normal = normalAt(field, profile, relief, x, y);
        const light = illuminate(lights, { x, y, normal });
        const sunk = density * (field.depth(x, y) / (field.deepest || 1));
        const grain = speckle === 0 ? 0 : (noise(x, y, index) - 0.5) * speckle;

        const warm = region.material.warm;
        const heat = light.total > 0 ? light.warm / light.total : 0;
        const ramp = warm && heat > bayer(x, y) ? warm : region.material.ramp;

        put(grid, x, y, rampAt(ramp, ambient + light.total * contrast - sunk + grain));
      }
    }
  }

  return grid;
}
