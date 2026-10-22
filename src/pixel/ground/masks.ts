import { cracks, equalize, fbm, hash, scatter, wrap } from './periodic.ts';
import { MATERIALS, TEXTURE } from './textures.ts';
import type { Material } from './textures.ts';

export interface GroundMask {
  material: Material;
  cells: Uint8Array;
}

export const PRIORITY: readonly Material[] = ['forest', 'marsh', 'meadow', 'highland', 'tundra', 'desert', 'path'];

const field = (x: number, y: number, size: number, octaves: number, salt: number, tall = size): number =>
  fbm(x, y, TEXTURE, TEXTURE / size, octaves, salt, TEXTURE / tall);

function build(paint: (x: number, y: number) => number, marks?: (values: Float64Array) => void): Uint8Array {
  const values = new Float64Array(TEXTURE * TEXTURE);
  for (let y = 0; y < TEXTURE; y += 1) {
    for (let x = 0; x < TEXTURE; x += 1) values[y * TEXTURE + x] = paint(x, y);
  }
  marks?.(values);
  return equalize(values);
}

function lead(values: Float64Array, x: number, y: number, cells: readonly [number, number][], by: number): void {
  for (const [dx, dy] of cells) {
    const at = wrap(y + dy, TEXTURE) * TEXTURE + wrap(x + dx, TEXTURE);
    values[at] = values[at]! - by;
  }
}

const meadow = (): Uint8Array =>
  build(
    (x, y) => field(x, y, 8, 2, 801),
    (values) => {
      for (const point of scatter(TEXTURE, 4, 802, 0.8)) {
        lead(values, point.x, point.y, point.pick < 0.5 ? [[0, 0], [0, -1]] : [[0, 0], [-1, -1], [1, -1]], 0.35);
      }
    },
  );

const forest = (): Uint8Array =>
  build(
    (x, y) => field(x, y, 16, 2, 811) * 0.7 + field(x, y, 4, 1, 812) * 0.3,
    (values) => {
      for (const point of scatter(TEXTURE, 6, 813, 0.6)) lead(values, point.x, point.y, [[0, 0], [1, 0]], 0.3);
    },
  );

const highland = (): Uint8Array => {
  const stones = cracks(TEXTURE, 7, 821);
  return build((x, y) => stones.sites[stones.site[y * TEXTURE + x]!]!.pick * 0.75 + field(x, y, 4, 1, 822) * 0.25);
};

const marsh = (): Uint8Array => build((x, y) => field(x, y, 32, 3, 831) * 0.85 + field(x, y, 4, 1, 832) * 0.15);

const tundra = (): Uint8Array => build((x, y) => field(x, y, 32, 3, 841, 8) * 0.8 + field(x, y, 4, 1, 842) * 0.2);

const desert = (): Uint8Array => build((x, y) => field(x, y, 16, 2, 851) * 0.45 + hash(x, y, 852) * 0.55);

const path = (): Uint8Array =>
  build(
    (x, y) => field(x, y, 8, 2, 861),
    (values) => {
      for (const point of scatter(TEXTURE, 4, 862, 0.6)) lead(values, point.x, point.y, [[0, 0], [1, 0], [0, 1], [1, 1]], 0.3);
    },
  );

const BUILDERS: Record<Material, () => Uint8Array> = { meadow, forest, highland, marsh, tundra, desert, path };

export const MASKS: readonly GroundMask[] = MATERIALS.map((material) => ({ material, cells: BUILDERS[material]() }));
