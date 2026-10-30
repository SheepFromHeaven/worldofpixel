import { Cover } from '../covers.ts';
import type { TileIndex } from '../grid.ts';
import { NOWHERE } from '../grid.ts';
import { prng } from '../rng.ts';
import type { Random } from '../rng.ts';
import type { World } from '../world.ts';
import { FOOD_KCAL, ItemType } from './items.ts';
import type { People } from './people.ts';
import type { Ambient } from '../capabilities.ts';

export const SOURCE_SECONDS = 14;

export const SOURCE_REACH_TILES = 34;

export const SOURCE_SAMPLES = 48;

export const FOOD_CAP = 12;

export const DRY_CHECK_SECONDS = 10;

export const DRY_CHANCE = 0.06;

export const DRY_WARM_FROM = 8;

export const DRY_WARM_SPAN = 14;

const SPOT_RING = 4;

export const BERRIES_FROM_KCAL = 80;

export const BERRY_PICK_KCAL = 140;

export const EGG_CHANCE = 0.05;

export const GRUB_CHANCE = 0.12;

const DAMP_FOR_GRUBS = 90;

export class FoodSources {
  private readonly random: Random;
  private clock = SOURCE_SECONDS / 2;
  private drying = DRY_CHECK_SECONDS;

  constructor(
    private readonly world: World,
    private readonly people: People,
    seed: number,
    private readonly ambient: Ambient,
  ) {
    this.random = prng(seed ^ 0xf00d5);
  }

  update(seconds: number): void {
    if (seconds <= 0 || this.people.count === 0) return;
    this.drying -= seconds;
    if (this.drying <= 0) {
      this.drying = DRY_CHECK_SECONDS;
      this.dry();
    }
    this.clock -= seconds;
    if (this.clock > 0) return;
    this.clock = SOURCE_SECONDS;
    if (this.food() >= FOOD_CAP) return;
    this.grow();
  }

  private dry(): void {
    const { items } = this.world;
    const { storage } = this.world.structures;
    for (let slot = 0; slot < items.used; slot += 1) {
      if (items.kind[slot] !== ItemType.PlantFibre) continue;
      const tile = items.tile[slot]!;
      if (storage[tile] === 1) continue;
      const warm = Math.min(1, Math.max(0, (this.ambient.temperatureAt(tile) - DRY_WARM_FROM) / DRY_WARM_SPAN));
      const dry = 1 - this.world.damp[tile]! / 255;
      if (this.random() >= DRY_CHANCE * warm * dry) continue;
      items.remove(slot);
      items.add(tile, ItemType.DryKindling);
    }
  }

  private food(): number {
    const { items } = this.world;
    let found = 0;
    for (let slot = 0; slot < items.used; slot += 1) if (FOOD_KCAL[items.kind[slot]!] !== undefined && items.kind[slot] !== ItemType.Roast) found += 1;
    return found;
  }

  private spot(tile: TileIndex): TileIndex {
    const { world } = this;
    const { grid } = world;
    const column = grid.columnOf(tile);
    const row = grid.rowOf(tile);
    for (let ring = 0; ring <= SPOT_RING; ring += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        for (let dx = -ring; dx <= ring; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const next = grid.at(column + dx, row + dy);
          if (next !== NOWHERE && world.movement.passable(next) && world.items.at(next).length === 0 && !world.structures.isStorage(next) && !world.structures.isFloor(next)) return next;
        }
      }
    }
    return NOWHERE;
  }

  private grow(): void {
    const { world, people, random } = this;
    const { grid, plants } = world;
    const person = Math.floor(random() * people.count);
    const column = grid.column(people.posX[person]!);
    const row = grid.row(people.posY[person]!);

    for (let sample = 0; sample < SOURCE_SAMPLES; sample += 1) {
      const angle = random() * Math.PI * 2;
      const reach = 4 + random() * (SOURCE_REACH_TILES - 4);
      const tile = grid.at(column + Math.round(Math.cos(angle) * reach), row + Math.round(Math.sin(angle) * reach));
      if (tile === NOWHERE || world.river[tile] !== 0 || world.structures.fire[tile] !== 0) continue;

      for (const layer of ['canopy', 'under'] as const) {
        if (plants.fruitKcal(tile, layer) < BERRIES_FROM_KCAL) continue;
        const place = this.spot(tile);
        if (place === NOWHERE || plants.pick(tile, layer, BERRY_PICK_KCAL) <= 0) continue;
        world.items.add(place, ItemType.Berries);
        return;
      }

      const cover = world.coverOf(tile);
      if ((cover === Cover.Fallen || cover === Cover.Tree) && world.damp[tile]! >= DAMP_FOR_GRUBS && random() < GRUB_CHANCE) {
        const place = this.spot(tile);
        if (place !== NOWHERE) {
          world.items.add(place, ItemType.Grubs);
          return;
        }
      }
      if ((cover === Cover.Bush || cover === Cover.Scrub) && random() < EGG_CHANCE) {
        const place = this.spot(tile);
        if (place !== NOWHERE) {
          world.items.add(place, ItemType.Egg);
          return;
        }
      }
    }
  }
}
