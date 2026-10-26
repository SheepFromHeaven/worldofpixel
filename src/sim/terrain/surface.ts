import { Biome } from '../types.ts';
import { noise2, spread2 } from '../rng.ts';
import type { Geology } from '../geology/geology.ts';
import { COARSE } from '../geology/geology.ts';
import { FEATURES, featureIndex } from '../geology/minerals.ts';
import { Rock } from '../geology/rocks.ts';
import { Series } from '../geology/sequences.ts';
import { volcanoesNear } from './landforms.ts';
import type { WorldField } from './worldfield.ts';

export const ROCK_SLOPE = 0.12;
const ROCK_REACH = 2;

export const FERTILITY_ONE = 200;

const SOLUBLE = new Set<number>([Rock.Limestone, Rock.Chalk, Rock.Marble]);
const WEATHERED = new Set<number>([Rock.Sandstone, Rock.Shale, Rock.Clay, Rock.Gypsum, Rock.Ironstone]);
const HARD = new Set<number>([Rock.Granite, Rock.Gneiss, Rock.Quartzite, Rock.Slate, Rock.Schist, Rock.Marble, Rock.Basalt, Rock.Andesite]);
const SERIES_DRY = new Set<number>([Series.RedBeds, Series.Evaporite]);

const CHEMISTRY: Readonly<Record<number, number>> = {
  [Rock.Basalt]: 1.15,
  [Rock.Andesite]: 1.15,
  [Rock.Tuff]: 1.2,
  [Rock.Obsidian]: 0.9,
  [Rock.Limestone]: 0.85,
  [Rock.Chalk]: 0.85,
  [Rock.Marble]: 0.8,
  [Rock.Granite]: 0.8,
  [Rock.Gneiss]: 0.8,
  [Rock.Quartzite]: 0.65,
  [Rock.Sandstone]: 0.8,
  [Rock.Shale]: 0.95,
  [Rock.Slate]: 0.9,
  [Rock.Schist]: 0.9,
  [Rock.Salt]: 0.25,
  [Rock.Gypsum]: 0.4,
};

const KIND: Readonly<Record<number, number>> = {
  [Rock.Soil]: 1,
  [Rock.Clay]: 0.85,
  [Rock.Sand]: 0.5,
};

const SURFACE_FERTILITY: Readonly<Record<number, number>> = {
  [Biome.Rock]: 0.12,
  [Biome.Karst]: 0.45,
  [Biome.Volcanic]: 0.3,
  [Biome.Salt]: 0.03,
  [Biome.Badlands]: 0.35,
};

const clamp = (value: number, low = 0, high = 1): number => (value < low ? low : value > high ? high : value);

export interface Surface {
  biome: Uint8Array;
  fertility: Uint8Array;
}

export function surfaceBiomes(field: WorldField, geology: Geology, river: Uint8Array): Surface {
  const { grid, seed } = field;
  const coarse = geology.coarseFields();
  const { columns, rows, features, series, soil, soilRock, surfaceRock } = coarse;
  const count = FEATURES.length;
  const fVolcanic = featureIndex('volcanic');
  const fKarst = featureIndex('karst');
  const fArid = featureIndex('arid');
  const fBasin = featureIndex('basin');

  const biome = field.climate.slice();
  const fertility = new Uint8Array(grid.count);
  const { height, climate } = field;

  const patch = (x: number, y: number, wave: number, salt: number): number =>
    spread2(noise2(x / wave, y / wave, seed + salt)) + (noise2(x / 4, y / 4, seed + salt + 7) - 0.5) * 0.14;

  for (let row = 0; row < grid.rows; row += 1) {
    const y = grid.y(row);
    const fy = (row + 0.5) / COARSE - 0.5;
    const r0 = clamp(Math.floor(fy), 0, rows - 1);
    const r1 = Math.min(rows - 1, r0 + 1);
    const v = clamp(fy - r0);

    for (let column = 0; column < grid.columns; column += 1) {
      const i = row * grid.columns + column;
      const base = climate[i]!;
      if (base >= Biome.Ocean) continue;

      const fx = (column + 0.5) / COARSE - 0.5;
      const c0 = clamp(Math.floor(fx), 0, columns - 1);
      const c1 = Math.min(columns - 1, c0 + 1);
      const u = clamp(fx - c0);
      const a = r0 * columns + c0;
      const b = r0 * columns + c1;
      const c = r1 * columns + c0;
      const d = r1 * columns + c1;
      const w0 = (1 - u) * (1 - v);
      const w1 = u * (1 - v);
      const w2 = (1 - u) * v;
      const w3 = u * v;
      const feature = (k: number): number =>
        (features[a * count + k]! * w0 + features[b * count + k]! * w1 + features[c * count + k]! * w2 + features[d * count + k]! * w3) / 255;
      const x = grid.x(column);
      const near = geology.coarseAt(x, y);

      const depth = ((soil[a]! * w0 + soil[b]! * w1 + soil[c]! * w2 + soil[d]! * w3) / 255) * 6;
      const rock = surfaceRock[near]!;

      let steep = 0;
      if (column >= ROCK_REACH && row >= ROCK_REACH && column < grid.columns - ROCK_REACH && row < grid.rows - ROCK_REACH) {
        const across = Math.abs(height[i + ROCK_REACH]! - height[i - ROCK_REACH]!);
        const down = Math.abs(height[i + ROCK_REACH * grid.columns]! - height[i - ROCK_REACH * grid.columns]!);
        steep = Math.max(across, down) / ROCK_SLOPE;
      }

      let out: number = base;
      if (river[i] !== 1 && base !== Biome.Marsh) {
        const volcanic = feature(fVolcanic);
        const arid = feature(fArid);
        const karst = feature(fKarst);

        if (volcanic > 0.25) {
          let hit = false;
          for (const cone of volcanoesNear(x, y, seed)) {
            const reach = Math.hypot(x - cone.x, y - cone.y) / cone.radius;
            if (reach < 0.4 || (reach < 0.8 && patch(x, y, 9, 1701) > 0.35)) hit = true;
          }
          if (!hit && volcanic > 0.7 && patch(x, y, 20, 1703) + (volcanic - 0.7) * 0.8 > 0.84) hit = true;
          if (hit) out = Biome.Volcanic;
        }

        if (out === base && series[near] === Series.Evaporite && arid > 0.45 && steep < 0.4 && patch(x, y, 38, 1709) + (arid - 0.45) * 0.6 > 0.62) out = Biome.Salt;
        if (out === base && base === Biome.Desert && arid > 0.85 && feature(fBasin) > 0.35 && steep < 0.25 && patch(x, y, 30, 1711) > 0.72) out = Biome.Salt;

        if (out === base && karst > 0.3 && SOLUBLE.has(rock) && patch(x, y, 26, 1721) + (karst - 0.3) * 0.9 > 0.55) out = Biome.Karst;

        if (
          out === base &&
          arid > 0.4 &&
          WEATHERED.has(rock) &&
          SERIES_DRY.has(series[near]!) &&
          (base === Biome.Desert || base === Biome.Meadow || base === Biome.Highland) &&
          (steep > 0.3 ? patch(x, y, 22, 1733) > 0.5 : patch(x, y, 30, 1731) + (arid - 0.4) * 0.7 > 0.78)
        ) out = Biome.Badlands;

        if (out === base) {
          if (base === Biome.Highland && (depth < 0.06 || patch(x, y, 22, 1741) > 0.64 - steep * 0.08)) out = Biome.Rock;
          else if (HARD.has(rock) && steep > 0.35 && depth < 1.2 && patch(x, y, 18, 1743) > 0.4) out = Biome.Rock;
        }
      }
      biome[i] = out;

      const chemistry = 0.6 + 0.4 * (CHEMISTRY[rock] ?? 1);
      const kind = KIND[soilRock[near]!] ?? 0.7;
      const thin = 0.6 + 0.4 * clamp(depth / 0.6);
      const share = SURFACE_FERTILITY[out] ?? 1;
      fertility[i] = Math.round(Math.min(1.27, thin * kind * chemistry * share) * FERTILITY_ONE);
    }
  }

  return { biome, fertility };
}
