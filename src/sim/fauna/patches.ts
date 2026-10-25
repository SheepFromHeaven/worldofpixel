import { Aqua, flowOf } from '../aquatic.ts';
import { Biome } from '../types.ts';
import type { World } from '../world.ts';
import { amphibianHabitatAt } from './habitat/amphibianHabitat.ts';
import type { AmphibianHabitatSample } from './habitat/amphibianHabitat.ts';
import { habitatAt } from './habitat/insectHabitat.ts';
import type { HabitatSample } from './habitat/insectHabitat.ts';
import { reptileHabitatAt } from './habitat/reptileHabitat.ts';
import type { ReptileHabitatSample } from './habitat/reptileHabitat.ts';
import { Kind, stageSuitability } from './habitat/suitability.ts';
import type { TileHabitat } from './habitat/suitability.ts';
import type { Life } from './life.ts';
import { LIFE_COUNT, LIVES, PATCH_AREA, PATCH_TILES, Stage } from './life.ts';

const SAMPLE_OFFSETS = [3, 8, 13];

const GAME_SUIT_FLOOR = 0.05;
const CALM_FLOW = 0.9;
const WATER_YOUNG_GAIN = 1;

export interface PatchData {
  readonly columns: number;
  readonly rows: number;
  readonly count: number;
  readonly suitAdult: Float32Array;
  readonly suitYoung: Float32Array;
  readonly suitEgg: Float32Array;
  readonly plant: Float32Array;
  readonly water: Float32Array;
  readonly revision: number;
}

export const patchIndex = (columns: number, column: number, row: number): number => row * columns + column;

function kindOf(world: World, tile: number): number {
  if (world.biome[tile] === Biome.Ocean) return Kind.Sea;
  return world.river[tile] === 1 || world.biome[tile] === Biome.Lake ? Kind.Fresh : Kind.Land;
}

function plantOf(world: World, tile: number, kind: number): number {
  if (kind === Kind.Land) return world.eco[tile]! / 255;
  const aqua = world.aqua[tile]!;
  return aqua === Aqua.None ? 0.08 : 0.55;
}

const distinct = (life: Life): { young: boolean; egg: boolean } => {
  if (life.group === 'amphibian') return { young: true, egg: true };
  if (life.group === 'insect') return { young: life.aquaticYoung, egg: life.aquaticYoung };
  if (life.group === 'reptile') return { young: false, egg: true };
  return { young: false, egg: false };
};

export function buildPatches(world: World): PatchData {
  const { grid } = world;
  const columns = Math.ceil(grid.columns / PATCH_TILES);
  const rows = Math.ceil(grid.rows / PATCH_TILES);
  const count = columns * rows;
  const suitAdult = new Float32Array(LIFE_COUNT * count);
  const suitYoung = new Float32Array(LIFE_COUNT * count);
  const suitEgg = new Float32Array(LIFE_COUNT * count);
  const plant = new Float32Array(count);
  const water = new Float32Array(count);
  const insect: HabitatSample = [0, 0, 0, 0];
  const amphibian: AmphibianHabitatSample = [0, 0, 0, 0];
  const reptile: ReptileHabitatSample = [0, 0, 0, 0];
  const tile: { insect: HabitatSample; amphibian: AmphibianHabitatSample; reptile: ReptileHabitatSample; kind: number } = { insect, amphibian, reptile, kind: 0 };
  const split = LIVES.map(distinct);
  const waterYoung = LIVES.map((life) => life.group === 'amphibian' || (life.group === 'insect' && life.aquaticYoung));
  const share = 1 / (SAMPLE_OFFSETS.length * SAMPLE_OFFSETS.length);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const patch = patchIndex(columns, column, row);
      let plants = 0;
      let wet = 0;
      for (const dr of SAMPLE_OFFSETS) {
        for (const dc of SAMPLE_OFFSETS) {
          const c = Math.min(grid.columns - 1, column * PATCH_TILES + dc);
          const r = Math.min(grid.rows - 1, row * PATCH_TILES + dr);
          const index = r * grid.columns + c;
          const kind = kindOf(world, index);
          habitatAt(world, c, r, insect);
          amphibianHabitatAt(world, c, r, amphibian);
          reptileHabitatAt(world, c, r, reptile);
          tile.kind = kind;
          plants += plantOf(world, index, kind) * share;
          if (kind !== Kind.Land) wet += share;
          for (let id = 0; id < LIFE_COUNT; id += 1) {
            const life = LIVES[id]!;
            const at = patch * LIFE_COUNT + id;
            if (life.group === 'game') {
              if (kind === Kind.Land) suitAdult[at] = suitAdult[at]! + share * Math.max(GAME_SUIT_FLOOR, (world.eco[index]! / 255) * (0.5 + 0.5 * reptile[1]));
              continue;
            }
            const adult = stageSuitability(life, Stage.Adult, tile as TileHabitat);
            suitAdult[at] = suitAdult[at]! + share * adult;
            const own = split[id]!;
            suitYoung[at] = suitYoung[at]! + share * (own.young ? stageSuitability(life, Stage.Hatchling, tile as TileHabitat) : adult);
            suitEgg[at] = suitEgg[at]! + share * (own.egg ? stageSuitability(life, Stage.Egg, tile as TileHabitat) : adult);
          }
        }
      }
      plant[patch] = plants;
      water[patch] = wet;
      let calm = 0;
      for (let dr = 0; dr < PATCH_TILES; dr += 1) {
        const r = row * PATCH_TILES + dr;
        if (r >= grid.rows) break;
        for (let dc = 0; dc < PATCH_TILES; dc += 1) {
          const c = column * PATCH_TILES + dc;
          if (c >= grid.columns) break;
          const index = r * grid.columns + c;
          if (world.biome[index] === Biome.Lake) calm += 1;
          else if (world.river[index] === 1 && flowOf(world.flow[index]!) < CALM_FLOW) calm += 1;
        }
      }
      const calmShare = Math.min(1, (calm / PATCH_AREA) * WATER_YOUNG_GAIN);
      for (let id = 0; id < LIFE_COUNT; id += 1) {
        if (!waterYoung[id]) continue;
        suitYoung[patch * LIFE_COUNT + id] = calmShare;
        suitEgg[patch * LIFE_COUNT + id] = calmShare;
      }
    }
  }
  for (let id = 0; id < LIFE_COUNT; id += 1) {
    if (LIVES[id]!.group !== 'game') continue;
    for (let patch = 0; patch < count; patch += 1) {
      suitYoung[patch * LIFE_COUNT + id] = suitAdult[patch * LIFE_COUNT + id]!;
      suitEgg[patch * LIFE_COUNT + id] = suitAdult[patch * LIFE_COUNT + id]!;
    }
  }
  return { columns, rows, count, suitAdult, suitYoung, suitEgg, plant, water, revision: world.revision };
}
