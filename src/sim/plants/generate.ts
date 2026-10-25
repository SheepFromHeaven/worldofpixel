import { Cover } from '../covers.ts';
import { distanceFrom } from '../distance.ts';
import { hash2, noise2 } from '../rng.ts';
import { altitudeOf } from '../terrain/climate.ts';
import type { WorldField } from '../terrain/worldfield.ts';
import { Biome } from '../types.ts';
import { zoneOf } from './zones.ts';
import { clumpAt, densitiesAt, affinityOf, placeOf, rollAt } from '../cover.ts';
import { ECO_FULL } from '../eco.ts';
import { encodeHeight, heightAfter, lightResponse } from './growth.ts';
import { fitness } from './niche.ts';
import type { Species } from './species.ts';
import { IDS_BY_LAYER, SPECIES } from './species.ts';

export interface PlantColumns {
  canopy: Uint8Array;
  canopyAge: Uint16Array;
  canopyHeight: Uint8Array;
  under: Uint8Array;
  underAge: Uint16Array;
  underHeight: Uint8Array;
  herb: Uint8Array;
  canopyTaken: Uint8Array;
  underTaken: Uint8Array;
}

export interface PlantEnvironment {
  altitude: Uint8Array;
  salt: Uint8Array;
  wants: Uint8Array;
}

export const SPRAY_TILES = 5;

export const emptyColumns = (count: number): PlantColumns => ({
  canopy: new Uint8Array(count),
  canopyAge: new Uint16Array(count),
  canopyHeight: new Uint8Array(count),
  under: new Uint8Array(count),
  underAge: new Uint16Array(count),
  underHeight: new Uint8Array(count),
  herb: new Uint8Array(count),
  canopyTaken: new Uint8Array(count),
  underTaken: new Uint8Array(count),
});

export function environmentFor(field: WorldField): PlantEnvironment {
  const { grid } = field;
  const sea = new Uint8Array(grid.count);
  for (let i = 0; i < grid.count; i += 1) sea[i] = field.biome[i] === Biome.Ocean ? 1 : 0;
  const away = distanceFrom(grid, sea);

  const altitude = new Uint8Array(grid.count);
  const salt = new Uint8Array(grid.count);
  for (let i = 0; i < grid.count; i += 1) {
    altitude[i] = Math.round(altitudeOf(field.height[i]!) * 255);
    salt[i] = Math.round(Math.exp(-away[i]! / SPRAY_TILES) * 255);
  }
  return { altitude, salt, wants: new Uint8Array(grid.count) };
}

export function formOf(
  canopy: number,
  canopyHeight: number,
  under: number,
  underHeight: number,
  herb: number,
  metres: (byte: number) => number,
): Cover | null {
  if (canopy !== 0) {
    const species = SPECIES[canopy - 1]!;
    return species.habit === 'snag' || metres(canopyHeight) >= 2 ? Cover.Tree : Cover.Bush;
  }
  if (under !== 0) {
    const species = SPECIES[under - 1]!;
    if (species.habit === 'vine' || species.habit === 'fern' || species.habit === 'succulent') return Cover.Scrub;
    return metres(underHeight) >= 1.2 ? Cover.Bush : Cover.Scrub;
  }
  return herb !== 0 ? Cover.Grass : null;
}

const STAND_WAVE = 46;

const CLOSURE_BY_ZONE: readonly number[] = [0, 0.6, 0.6, 1, 0.5, 1, 1.6, 0.8, 0.3, 0.7, 1.5, 2.2];

const CANOPY_SHARPEN = 1.5;

const UNDER_UNDER_CANOPY = 0.22;

const AGE_SKEW_CANOPY = 2;

const AGE_SKEW_UNDER = 1.8;

const ESTABLISHED_VIGOR = 0.8;

const weights = new Float64Array(SPECIES.length + 1);

function choose(ids: readonly number[], roll: number): number {
  let total = 0;
  for (const id of ids) total += weights[id]!;
  if (total <= 0) return 0;
  let left = roll * total;
  for (const id of ids) {
    left -= weights[id]!;
    if (left < 0) return id;
  }
  return ids[ids.length - 1]!;
}

export interface Scene {
  celsius: number;
  rain: number;
  damp: number;
  altitude: number;
  salt: number;
}

function weigh(ids: readonly number[], scene: Scene, x: number, y: number, seed: number, shadeLight: number, sharpen: number): number {
  let any = 0;
  for (const id of ids) {
    const species = SPECIES[id - 1]!;
    const fit = fitness(id, scene.celsius, scene.rain, scene.damp, scene.altitude, scene.salt);
    if (fit < 0.03) {
      weights[id] = 0;
      continue;
    }
    const stand = 0.5 + noise2(x / STAND_WAVE, y / STAND_WAVE, seed + 1000 + id * 31);
    const lit = shadeLight >= 1 ? 1 : lightResponse(species, shadeLight) ** 0.6;
    weights[id] = fit ** sharpen * stand * lit;
    any += weights[id]!;
  }
  return any;
}

export function establishedHeight(species: Species, ageInYears: number): number {
  return heightAfter(species, ageInYears, ESTABLISHED_VIGOR);
}

export function generatePlants(
  seed: number,
  field: WorldField,
  eco: Uint8Array,
  damp: Uint8Array,
  river: Uint8Array,
  environment: PlantEnvironment,
): { columns: PlantColumns; cover: Uint8Array } {
  const { grid } = field;
  const columns = emptyColumns(grid.count);
  const cover = new Uint8Array(grid.count);
  const scene: Scene = { celsius: 0, rain: 0, damp: 0, altitude: 0, salt: 0 };

  for (let row = 0; row < grid.rows; row += 1) {
    const y = grid.y(row);
    const at = row * grid.columns;

    for (let column = 0; column < grid.columns; column += 1) {
      const i = at + column;
      const biome = field.biome[i]!;
      if (biome > Biome.Desert || river[i] === 1) continue;
      const affinity = affinityOf(biome as Biome);

      const mix = densitiesAt(affinity, eco[i]! / ECO_FULL);
      const zone = zoneOf(field.temperature[i]!, field.wet[i]!, environment.altitude[i]! / 255);
      const closed = { ...mix, tree: mix.tree * CLOSURE_BY_ZONE[zone]! };
      const x = grid.x(column);
      const form = placeOf(closed, clumpAt(seed, x, y), rollAt(seed, column, row));
      environment.wants[i] = form;
      if (form === Cover.Boulder) {
        cover[i] = Cover.Boulder;
        continue;
      }

      scene.celsius = field.temperature[i]!;
      scene.rain = field.wet[i]!;
      scene.damp = damp[i]! / 255;
      scene.altitude = environment.altitude[i]! / 255;
      scene.salt = environment.salt[i]! / 255;

      let canopy = 0;
      let under = 0;

      if (form === Cover.Tree && weigh(IDS_BY_LAYER.canopy, scene, x, y, seed, 1, CANOPY_SHARPEN) > 0) {
        canopy = choose(IDS_BY_LAYER.canopy, hash2(column, row, seed + 3101));
        const species = SPECIES[canopy - 1]!;
        const age = Math.max(1, species.lifespan * hash2(column, row, seed + 3203) ** AGE_SKEW_CANOPY);
        columns.canopy[i] = canopy;
        columns.canopyAge[i] = Math.min(65535, Math.round(age * 32));
        columns.canopyHeight[i] = Math.round(encodeHeight(establishedHeight(species, age)));
      }

      const wantsUnder = form === Cover.Bush || form === Cover.Scrub || (form === Cover.Tree && canopy === 0);
      const underLight = canopy !== 0 ? UNDER_UNDER_CANOPY : 1;
      const chanceUnder = canopy !== 0 ? 0.4 : wantsUnder ? 1 : 0;
      if (chanceUnder > 0 && hash2(column, row, seed + 3301) < chanceUnder && weigh(IDS_BY_LAYER.under, scene, x, y, seed, underLight, CANOPY_SHARPEN) > 0) {
        if (form === Cover.Bush || form === Cover.Scrub) {
          for (const id of IDS_BY_LAYER.under) {
            const tall = SPECIES[id - 1]!.height >= 2.5;
            weights[id] = weights[id]! * ((form === Cover.Bush) === tall ? 1 : 0.25);
          }
        }
        under = choose(IDS_BY_LAYER.under, hash2(column, row, seed + 3403));
        if (under !== 0) {
          const species = SPECIES[under - 1]!;
          const age = Math.max(0.5, species.lifespan * hash2(column, row, seed + 3503) ** AGE_SKEW_UNDER);
          columns.under[i] = under;
          columns.underAge[i] = Math.min(65535, Math.round(age * 32));
          columns.underHeight[i] = Math.round(encodeHeight(establishedHeight(species, age)));
        }
      }

      const sheltered = canopy !== 0 || under !== 0;
      const chanceHerb = form === Cover.Grass ? 1 : sheltered ? 0.55 : 0;
      if (chanceHerb > 0 && hash2(column, row, seed + 3601) < chanceHerb) {
        const light = sheltered ? UNDER_UNDER_CANOPY : 1;
        if (weigh(IDS_BY_LAYER.ground, scene, x, y, seed, light, 1) > 0) {
          columns.herb[i] = choose(IDS_BY_LAYER.ground, hash2(column, row, seed + 3701));
        }
      }

      const derived = formOf(columns.canopy[i]!, columns.canopyHeight[i]!, columns.under[i]!, columns.underHeight[i]!, columns.herb[i]!, (b) => (b / 255) ** 2 * 64);
      cover[i] = derived ?? Cover.Bare;
    }
  }

  return { columns, cover };
}
