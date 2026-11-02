import type { Fauna } from '../fauna/api.ts';
import { LIFE_COUNT, LIVES, PATCH_TILES, STAGES, Stage } from '../fauna/api.ts';
import { patchIndex } from '../fauna/api.ts';
import { prng } from '../../sim/rng.ts';
import type { Random } from '../../sim/rng.ts';
import type { World } from '../../sim/world.ts';
import { stationOf } from '../../content/stations/index.ts';
import { itemIdOf } from '../../content/items/index.ts';

export const SNARE_SECONDS = 20;

export const SNARE_RATE = 0.3;

const MIN_STOCK = 0.05;

const lifeIndex = (key: string): number => LIVES.findIndex((life) => life.key === key);

export class Snares {
  private readonly random: Random;
  private clock = SNARE_SECONDS;

  constructor(
    private readonly world: World,
    private readonly fauna: Fauna,
    seed: number,
  ) {
    this.random = prng(seed ^ 0x54a7e);
  }

  update(seconds: number): void {
    if (seconds <= 0) return;
    this.clock -= seconds;
    if (this.clock > 0) return;
    this.clock = SNARE_SECONDS;
    const { world, fauna, random } = this;
    const { grid, items } = world;
    for (const tile of world.structures.stations) {
      const trap = stationOf(world.structures.built[tile]!)?.trap;
      const prey = trap ? lifeIndex(trap.catches) : -1;
      if (!trap || prey < 0 || items.at(tile).length > 0) continue;
      const patch = patchIndex(fauna.patches.columns, Math.floor(grid.columnOf(tile) / PATCH_TILES), Math.floor(grid.rowOf(tile) / PATCH_TILES));
      const at = (patch * LIFE_COUNT + prey) * STAGES + Stage.Adult;
      const adults = fauna.stock[at]!;
      if (adults < MIN_STOCK || random() >= 1 - Math.exp(-adults * SNARE_RATE)) continue;
      fauna.stock[at] = Math.max(0, adults - 1);
      for (const yielded of trap.yields) items.add(tile, itemIdOf(yielded) as never);
    }
  }
}
