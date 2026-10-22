import { parcelOf } from './terrain/parcels.ts';
import { prng } from './rng.ts';
import { Biome, ItemType } from './types.ts';
import type { CellId, ItemType as Item } from './types.ts';
import { fieldFor, freshWaterIn, isFresh, isWater } from './terrain/worldfield.ts';
import type { GameWorld } from './world.ts';

const HEAD = ['Ald', 'Bram', 'Cor', 'Dun', 'Esk', 'Fen', 'Gar', 'Hol', 'Kir', 'Mor', 'Thal', 'Wyn'];
const TAIL = ['mere', 'wick', 'dale', 'fell', 'hollow', 'reach', 'ford', 'stead', 'moor', 'bury'];

export function nameFrom(seed: number): string {
  const random = prng(seed);
  const head = HEAD[Math.floor(random() * HEAD.length)] ?? 'Ald';
  const tail = TAIL[Math.floor(random() * TAIL.length)] ?? 'mere';
  return `${head}${tail}`;
}

const FIBROUS: readonly Biome[] = [Biome.Marsh, Biome.Meadow, Biome.Forest, Biome.Highland, Biome.Tundra, Biome.Desert];

export function landYield(world: GameWorld, parcelId: CellId): Item[] {
  const parcel = parcelOf(world.seed, parcelId);
  if (isWater(parcel.biome)) return [];

  const beside = parcel.neighbors.some((id) => isFresh(parcelOf(world.seed, id).biome));
  const items: Item[] = [];
  if (beside || freshWaterIn(fieldFor(world.seed), parcel.site, parcel.vertices)) {
    items.push(ItemType.Water);
    items.push(ItemType.Mud);
    items.push(ItemType.Clay);
  }
  items.push(ItemType.Dirt);
  if (parcel.biome === Biome.Forest || parcel.biome === Biome.Meadow) items.push(ItemType.Deadwood);
  if (parcel.biome === Biome.Forest) items.push(ItemType.Wood);
  if (FIBROUS.includes(parcel.biome)) items.push(ItemType.Fibre);
  return items;
}
