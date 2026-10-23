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
  grit?: number;
  accent?: boolean;
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

export type Crown = (x: number, y: number) => number;

export interface Surfaces {
  albedo: Grid;
  normals: Uint8Array;
}

const BODY_FLATTEN = 0.9;
const LOBE_WEIGHT = 0.55;
const CROWN_FLOOR = 0.2;

export function surfaces(size: number, regions: readonly Region[], tall = 1, holes?: Mask, crown?: Crown): Surfaces {
  const albedo = createGrid(size);
  const normals = new Uint8Array(size * size * 4);

  const whole: Mask = (x, y) => regions.some((region) => region.mask(x, y));
  const body = measure(size, whole);
  const bodyDome = (x: number, y: number): number => dome(body.depth(x, y), body.deepest) * body.deepest;
  const bodyHeight = (x: number, y: number): number =>
    crown ? (crown(x, y) + CROWN_FLOOR * bodyDome(x, y)) * tall : bodyDome(x, y) * BODY_FLATTEN * tall;

  let peak = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) if (whole(x, y)) peak = Math.max(peak, bodyHeight(x, y));
  }

  for (const [index, region] of regions.entries()) {
    const field = measure(size, region.mask);
    const profile = region.material.profile ?? dome;
    const relief = region.material.relief ?? 2;
    const speckle = region.material.speckle ?? 0;
    const grit = region.material.grit ?? 0;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!region.mask(x, y) || holes?.(x, y)) continue;

        const rough = normalAt(field, profile, relief, x, y);
        const lobe: [number, number, number] = [
          rough[0] + (noise(x, y, index + 7) - 0.5) * grit,
          rough[1] + (noise(y, x, index + 13) - 0.5) * grit,
          rough[2],
        ];
        const slopeX = (bodyHeight(x + 1, y) - bodyHeight(x - 1, y)) / 2;
        const slopeY = (bodyHeight(x, y + 1) - bodyHeight(x, y - 1)) / 2;
        const normal = normalize([
          -slopeX + lobe[0] * LOBE_WEIGHT,
          -slopeY + lobe[1] * LOBE_WEIGHT,
          1 + lobe[2] * LOBE_WEIGHT,
        ]);

        const local = Math.min(1, Math.max(0, profile(field.depth(x, y), field.deepest)));
        const broad = Math.min(1, bodyHeight(x, y) / (peak || 1));
        const height = local * 0.6 + broad * 0.4;
        const grain = speckle === 0 ? 0 : (noise(x, y, index) - 0.5) * speckle;

        put(albedo, x, y, rampAt(region.material.ramp, 0.5 + grain));
        const at = (y * size + x) * 4;
        normals[at] = Math.round((normal[0] * 0.5 + 0.5) * 255);
        normals[at + 1] = Math.round((normal[1] * 0.5 + 0.5) * 255);
        normals[at + 2] = 1 + Math.round(height * 254);
        normals[at + 3] = region.material.accent ? 250 : 0xff;
      }
    }
  }

  return { albedo, normals };
}
