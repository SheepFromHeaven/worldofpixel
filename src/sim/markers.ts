import { parcelOf } from './parcels.ts';
import { rng } from './rng.ts';
import { Biome, ItemType } from './types.ts';
import type { CellId, ItemType as Item } from './types.ts';
import { fieldFor, freshWaterIn, isFresh, isWater } from './worldfield.ts';
import type { GameWorld } from './world.ts';

const HEAD = ['Ald', 'Bram', 'Cor', 'Dun', 'Esk', 'Fen', 'Gar', 'Hol', 'Kir', 'Mor', 'Thal', 'Wyn'];
const TAIL = ['mere', 'wick', 'dale', 'fell', 'hollow', 'reach', 'ford', 'stead', 'moor', 'bury'];

export function nameFrom(seed: number): string {
  const random = rng(seed);
  const head = HEAD[Math.floor(random() * HEAD.length)] ?? 'Ald';
  const tail = TAIL[Math.floor(random() * TAIL.length)] ?? 'mere';
  return `${head}${tail}`;
}

/** How far from a hearth the land still counts as that settlement's to build on. */
export const FOUNDING_REACH = 46;

/**
 * What the land works standing on this parcel could draw out of it — every item, not one: a
 * parcel takes one building, and which of these to work there is the player's choice.
 *
 * Earth comes out of any land at all — anyone can dig — water out of any tile the water is in
 * **or next to**, and wood out of forest. That is the whole of siting: the first machine goes
 * down anywhere, and the next ones go on the bank or under the trees.
 *
 * A bank gives three things, not one. The water itself, the mud that is the ground the water
 * reaches, and the clay under it — all on the same test, because they are all the same bank seen
 * at different depths, and a parcel takes one building, so standing on a bank is a decision about
 * which of the three to work there.
 *
 * The two halves of that are not the same test and both are needed. A creek narrower than the
 * gap between two sites covers no tile's middle, so it is never any parcel's *biome* and only
 * `freshWaterIn` finds it. A lake, on the other hand, stops wherever its cells stop — which is
 * nowhere near where the lattice puts the edge between two tiles — so a quarter of the tiles
 * that visibly touch one had no water inside them at all, and refused a well for a reason the
 * player cannot see. Sharing an edge with water is a reason anyone can see.
 *
 * **Salt is not water.** `isFresh` excludes the sea, which is the one kind of shore that gives
 * nothing — and the one place this rule is most likely to be read as a bug, so the sea and a
 * lake are drawn in colours that cannot be mistaken for one another.
 *
 * **There are no deposits any more.** A spring used to be scattered on a lattice of its own and
 * marked on the map, which meant the one findable resource in the world had nothing to do with
 * the water drawn on it. The water *is* the map now, in blue, at every zoom. Don't put a marker
 * layer back on top of it.
 */
export function landYield(world: GameWorld, parcelId: CellId): Item[] {
  const parcel = parcelOf(world.seed, parcelId);
  if (isWater(parcel.biome)) return [];

  const beside = parcel.neighbors.some((id) => isFresh(parcelOf(world.seed, id).biome));
  const items: Item[] = [];
  if (beside || freshWaterIn(fieldFor(world.seed), parcel.site, parcel.vertices)) {
    items.push(ItemType.Water);
    // A wet bank is mud already: it is the same ground the water reaches, dug rather than mixed.
    items.push(ItemType.Mud);
    items.push(ItemType.Clay);
  }
  items.push(ItemType.Dirt);
  if (parcel.biome === Biome.Forest) items.push(ItemType.Wood);
  // Fibre is the marsh's and not the bank's, for two reasons. Retted fibre is reeds and bast,
  // and marsh is the one biome in the table that is standing fresh water over land. And the
  // bank already hands back three things: a fourth would make it a menu rather than a decision,
  // where marsh gives nothing but dirt and costs extra to walk over — pure penalty. Hanging
  // fibre on it turns the one biome the player avoids into somewhere worth claiming.
  if (parcel.biome === Biome.Marsh) items.push(ItemType.Fibre);
  return items;
}
