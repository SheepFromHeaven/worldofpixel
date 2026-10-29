import type { Fauna } from '../fauna/fauna.ts';
import { LIFE_COUNT, LIVES, PATCH_TILES, STAGES, Stage } from '../fauna/life.ts';
import { patchIndex } from '../fauna/patches.ts';
import { prng } from '../rng.ts';
import type { Random } from '../rng.ts';
import type { World } from '../world.ts';
import { Building } from '../world.ts';
import { ItemType } from './items.ts';

export const SNARE_SECONDS = 20;

export const SNARE_RATE = 0.3;

const MIN_STOCK = 0.05;

const RABBIT = LIVES.findIndex((life) => life.key === 'rabbit');

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
    if (seconds <= 0 || RABBIT < 0) return;
    this.clock -= seconds;
    if (this.clock > 0) return;
    this.clock = SNARE_SECONDS;
    const { world, fauna, random } = this;
    const { grid, items } = world;
    for (const tile of world.buildings) {
      if (world.built[tile] !== Building.Snare || items.at(tile).length > 0) continue;
      const patch = patchIndex(fauna.patches.columns, Math.floor(grid.columnOf(tile) / PATCH_TILES), Math.floor(grid.rowOf(tile) / PATCH_TILES));
      const at = (patch * LIFE_COUNT + RABBIT) * STAGES + Stage.Adult;
      const adults = fauna.stock[at]!;
      if (adults < MIN_STOCK || random() >= 1 - Math.exp(-adults * SNARE_RATE)) continue;
      fauna.stock[at] = Math.max(0, adults - 1);
      items.add(tile, ItemType.Rabbit);
    }
  }
}
