import { BIOME_RAMPS } from '../render/palette.ts';
import { Aqua, DEPTH_UNIT_METRES } from '../sim/aquatic.ts';
import { Cover } from '../sim/covers.ts';
import { Biome } from '../sim/types.ts';
import { TileGrid } from '../sim/grid.ts';
import type { World } from '../sim/world.ts';

export const STAGE_TILES = 384;

const WEATHER_CELL = 16;

const PROBED = new Set(['toJSON', 'then', 'nodeType', 'tagName', 'constructor', 'toString', 'asymmetricMatch', '_owner']);

interface Patch {
  biome: Biome;
  covers: readonly (readonly [number, number])[];
  eco: number;
  damp: number;
  aqua?: number;
  metres?: number;
  river?: boolean;
  flow?: number;
}

export interface Terrain {
  key: string;
  title: string;
  ground: Patch;
  water?: Patch;
  colour: string;
  waterColour?: string;
}

const patch = (biome: Biome, covers: readonly (readonly [number, number])[], eco: number, damp: number, rest: Partial<Patch> = {}): Patch => ({ biome, covers, eco, damp, ...rest });

const rampColour = (biome: Biome, step = 2): string => {
  const packed = BIOME_RAMPS[biome]![step]!;
  return `#${(packed >>> 8).toString(16).padStart(6, '0')}`;
};

const MEADOW = patch(Biome.Meadow, [[Cover.Grass, 0.9], [Cover.Scrub, 0.07], [Cover.Bush, 0.03]], 190, 90);
const SEA = patch(Biome.Ocean, [[Cover.Bare, 1]], 0, 255, { aqua: Aqua.None, metres: 40 });
const BEACH = patch(Biome.Desert, [[Cover.Bare, 0.96], [Cover.Boulder, 0.04]], 20, 60);

export const TERRAINS: readonly Terrain[] = [
  { key: 'meadow', title: 'meadow', ground: MEADOW, colour: rampColour(Biome.Meadow) },
  { key: 'forest', title: 'forest', ground: patch(Biome.Forest, [[Cover.Tree, 0.7], [Cover.Bush, 0.12], [Cover.Grass, 0.14], [Cover.Fallen, 0.04]], 230, 130), colour: rampColour(Biome.Forest) },
  { key: 'highland', title: 'highland', ground: patch(Biome.Highland, [[Cover.Scrub, 0.4], [Cover.Boulder, 0.3], [Cover.Grass, 0.3]], 90, 50), colour: rampColour(Biome.Highland) },
  { key: 'marsh', title: 'marsh', ground: patch(Biome.Marsh, [[Cover.Grass, 0.5], [Cover.Bush, 0.4], [Cover.Fallen, 0.1]], 170, 245), colour: rampColour(Biome.Marsh) },
  { key: 'tundra', title: 'tundra', ground: patch(Biome.Tundra, [[Cover.Grass, 0.5], [Cover.Bare, 0.4], [Cover.Boulder, 0.1]], 60, 80), colour: rampColour(Biome.Tundra) },
  { key: 'desert', title: 'desert', ground: patch(Biome.Desert, [[Cover.Bare, 0.9], [Cover.Scrub, 0.06], [Cover.Boulder, 0.04]], 20, 10), colour: rampColour(Biome.Desert) },
  { key: 'lake', title: 'lake', ground: patch(Biome.Lake, [[Cover.Bare, 1]], 0, 255, { aqua: Aqua.Algae, metres: 6 }), colour: rampColour(Biome.Lake) },
  { key: 'river', title: 'river', ground: patch(Biome.Lake, [[Cover.Bare, 1]], 0, 255, { aqua: Aqua.Weed, metres: 2, river: true, flow: 90 }), colour: rampColour(Biome.River) },
  { key: 'sea', title: 'open sea', ground: SEA, colour: rampColour(Biome.Ocean) },
  { key: 'coast', title: 'coast', ground: BEACH, water: SEA, colour: rampColour(Biome.Desert), waterColour: rampColour(Biome.Ocean) },
  { key: 'shore', title: 'lake shore', ground: MEADOW, water: patch(Biome.Lake, [[Cover.Bare, 1]], 0, 255, { aqua: Aqua.Reeds, metres: 3 }), colour: rampColour(Biome.Meadow), waterColour: rampColour(Biome.Lake) },
];

const hashOf = (column: number, row: number): number => {
  let h = Math.imul(column, 0x27d4eb2d) ^ Math.imul(row, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

const coverOf = (one: Patch, column: number, row: number): number => {
  let roll = hashOf(column, row);
  for (const [cover, share] of one.covers) {
    if (roll < share) return cover;
    roll -= share;
  }
  return one.covers[0]![0];
};

export function stageWorld(terrain: Terrain, number: number): World {
  const grid = new TileGrid(STAGE_TILES, STAGE_TILES, -STAGE_TILES / 2, -STAGE_TILES / 2, 1);
  const count = grid.count;
  const biome = new Uint8Array(count);
  const cover = new Uint8Array(count);
  const eco = new Uint8Array(count);
  const damp = new Uint8Array(count);
  const aqua = new Uint8Array(count);
  const flow = new Uint8Array(count);
  const depth = new Uint8Array(count);
  const shore = new Uint8Array(count);
  const river = new Uint8Array(count);
  const middle = STAGE_TILES / 2;
  const cell = (column: number): Patch => (terrain.water && column < middle ? terrain.water : terrain.ground);
  for (let row = 0; row < STAGE_TILES; row += 1) {
    for (let column = 0; column < STAGE_TILES; column += 1) {
      const at = row * STAGE_TILES + column;
      const here = cell(column);
      biome[at] = here.biome;
      cover[at] = coverOf(here, column, row);
      eco[at] = here.eco;
      damp[at] = here.damp;
      aqua[at] = here.aqua ?? 0;
      flow[at] = here.flow ?? 0;
      river[at] = here.river ? 1 : 0;
      depth[at] = here.metres ? Math.min(255, Math.round(here.metres / DEPTH_UNIT_METRES)) : 0;
      shore[at] = terrain.water && column < middle ? Math.min(255, middle - column) : 255;
    }
  }
  const weatherColumns = Math.ceil(STAGE_TILES / WEATHER_CELL);
  const field = {
    seed: number,
    grid,
    biome,
    wind: new Uint8Array(count).fill(80),
    prevailing: 1,
    water: new Uint8Array(count),
    height: new Float32Array(count).fill(0.5),
    weather: { columns: weatherColumns, rows: weatherColumns, data: new Uint8Array(weatherColumns * weatherColumns * 4) },
  };
  const plants = { speciesAt: () => null };
  const stage = { seed: number, grid, field, plants, biome, cover, wear: new Uint8Array(count), eco, damp, aqua, flow, depth, shore, river, steep: new Uint8Array(count), wind: field.wind, revision: 1 };
  return new Proxy(stage, {
    get(target, name) {
      if (name in target) return target[name as keyof typeof target];
      if (typeof name === 'symbol' || name.startsWith('$') || PROBED.has(name)) return undefined;
      throw new Error(`zoo stage has no ${String(name)}`);
    },
  }) as unknown as World;
}
