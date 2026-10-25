import { hash2 } from './rng.ts';
import { affinityOf, clumpAt, densitiesAt, placeOf, rollAt } from './cover.ts';
import type { Densities } from './cover.ts';
import { ECO_FULL } from './eco.ts';
import { AROUND } from './grid.ts';
import { isWater } from './terrain/worldfield.ts';
import type { Biome } from './types.ts';
import type { World } from './world.ts';
import { Cover } from './world.ts';

interface Woody {
  readonly cover: Cover;
  readonly density: keyof Densities;
  readonly seed: number;
  readonly spread: number;
  readonly death: number;
  readonly leaves: Cover;
}

let table: readonly Woody[] | null = null;

const build = (): readonly Woody[] => [
  { cover: Cover.Tree, density: 'tree', seed: 0.05, spread: 0.0002, death: 0.003, leaves: Cover.Fallen },
  { cover: Cover.Bush, density: 'bush', seed: 0.1, spread: 0.0004, death: 0.008, leaves: Cover.Bare },
  { cover: Cover.Scrub, density: 'scrub', seed: 0.16, spread: 0.0006, death: 0.015, leaves: Cover.Bare },
];

export const woody = (): readonly Woody[] => (table ??= build());

export const ROT_PER_DAY = 0.3;

export const GRASS_PER_DAY = 0.06;

export const SEED_BANK = 0.4;

export const MISPLACED_DEATH = 4;

const MAX_TILES_PER_CALL = 1 << 17;

const FORM_COUNT = 3;

export class Flora {
  private cursor = 0;
  private owed = 0;
  private sweeps = 0;
  private readonly counts = new Uint8Array(FORM_COUNT);

  advance(world: World, days: number): void {
    this.owed += days * world.count;
    const budget = Math.min(Math.floor(this.owed), MAX_TILES_PER_CALL);
    if (budget <= 0) return;
    this.owed = Math.min(this.owed - budget, MAX_TILES_PER_CALL);

    const end = Math.min(world.count, this.cursor + budget);
    for (let tile = this.cursor; tile < end; tile += 1) this.visit(world, tile);

    if (end >= world.count) {
      this.cursor = 0;
      this.sweeps += 1;
    } else {
      this.cursor = end;
    }
  }

  private visit(world: World, tile: number): void {
    const biome = world.biome[tile]! as Biome;
    if (isWater(biome) || world.river[tile] === 1) return;
    if (world.wear[tile]! > 0 || world.hasStructure(tile)) return;

    const cover = world.cover[tile]!;
    const roll = hash2(tile, this.sweeps, world.seed + 4049);

    if (cover === Cover.Fallen) {
      if (roll < ROT_PER_DAY) world.sow(tile, Cover.Bare);
      return;
    }

    if (cover === Cover.Boulder) return;

    const { grid } = world;
    const column = grid.columnOf(tile);
    const row = grid.rowOf(tile);
    const mix = densitiesAt(affinityOf(biome), world.eco[tile]! / ECO_FULL);
    const wanted = placeOf(mix, clumpAt(world.seed, grid.x(column), grid.y(row)), rollAt(world.seed, column, row));
    const forms = woody();

    for (const form of forms) {
      if (cover === form.cover) {
        const rate = wanted === form.cover ? form.death : form.death * MISPLACED_DEATH;
        if (roll < rate) world.sow(tile, form.leaves);
        return;
      }
    }

    if (cover !== Cover.Bare && cover !== Cover.Grass) return;

    const near = this.neighbours(world, column, row);
    let edge = 0;
    for (let f = 0; f < FORM_COUNT; f += 1) {
      const form = forms[f]!;
      if (wanted === form.cover) edge += form.seed * (near[f]! > 0 ? 1 : SEED_BANK);
      else if (near[f]! > 0 && mix[form.density] > 0) edge += form.spread * near[f]!;
      if (roll < edge) {
        world.sow(tile, form.cover);
        return;
      }
    }

    const flip = hash2(tile, this.sweeps, world.seed + 6151);
    if (cover === Cover.Bare && wanted === Cover.Grass && flip < GRASS_PER_DAY) world.sow(tile, Cover.Grass);
    else if (cover === Cover.Grass && wanted !== Cover.Grass && flip < GRASS_PER_DAY) world.sow(tile, Cover.Bare);
  }

  private neighbours(world: World, column: number, row: number): Uint8Array {
    const { grid } = world;
    const forms = woody();
    this.counts.fill(0);
    for (const [dx, dy] of AROUND) {
      const near = grid.at(column + dx, row + dy);
      if (near < 0) continue;
      const cover = world.cover[near]!;
      for (let f = 0; f < FORM_COUNT; f += 1) {
        if (cover === forms[f]!.cover) this.counts[f] = this.counts[f]! + 1;
      }
    }
    return this.counts;
  }
}
