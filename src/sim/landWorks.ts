import { hashString } from './rng.ts';
import { ItemType } from './types.ts';
import { Biome } from './types.ts';
import type { Design, DesignId, ItemType as Item } from './types.ts';

/**
 * The buildings that open the ground. They are not designs the player draws: what a parcel holds
 * is geography, and the puzzle is what gets made from it. So there is one fixed land work per
 * item the ground can give, raised straight onto a parcel that holds it, and the library is
 * left to the workshops.
 *
 * A parcel can hold several items at once — a forest on a lake shore gives water, dirt and wood —
 * and a parcel takes one building, so which of them to work there is the player's choice.
 */
export interface LandWork {
  item: Item;
  design: Design;
  /** What one shift draws out of the ground. */
  batch: number;
  /** How long a shift takes, in ticks — ten to a second at normal speed. */
  ticks: number;
  /**
   * What a shift can turn up, each with its chance, drawn once for every unit of the batch. Absent
   * when the ground gives one thing only, which is every land work but the forage camp.
   */
  pool?: readonly { item: Item; chance: number }[];
  /**
   * The ground it can stand on, when the item alone does not say: fibre grows almost everywhere,
   * but reeds only in marsh. Absent means wherever the ground gives the item.
   */
  where?: readonly Biome[];
}

/**
 * The ground gives nothing on its own; a villager has to work it. Each land work is a shift of
 * fixed length that yields a fixed batch: a bucket from the well takes five seconds, ten logs
 * take the woodcutter fifteen, five loads of earth take the dig ten. The whole batch comes out
 * when the shift ends.
 */
function landWork(
  id: DesignId,
  label: string,
  item: Item,
  batch: number,
  ticks: number,
  pool?: readonly { item: Item; chance: number }[],
  where?: readonly Biome[],
): LandWork {
  return {
    item,
    batch,
    ticks,
    ...(pool ? { pool } : {}),
    ...(where ? { where } : {}),
    design: {
      id,
      label,
      // At least a batch, because a shift is only offered when the whole of one will fit.
      capacity: Math.max(8, batch),
    },
  };
}

export const LAND_WORKS: readonly LandWork[] = [
  landWork('well', 'Well', ItemType.Water, 1, 50),
  landWork('digging', 'Dig site', ItemType.Dirt, 5, 100),
  landWork('woodcutter', 'Woodcutter', ItemType.Wood, 10, 150),
  // Deadwood, gathered rather than felled: fifteen ticks a log at the woodcutter's stump
  // against thirty-five here. Nobody has an axe in Age I, and more than doubling this is most
  // of what the axe is worth when the chapter finally grinds and hafts one (step 22).
  landWork('forage-camp', 'Forage camp', ItemType.Deadwood, 4, 140, [
    { item: ItemType.Deadwood, chance: 0.7 },
    // The first food that keeps, and not much of it: picking your own is what feeds the band
    // until something better comes along (`needs.ts`).
    { item: ItemType.Berries, chance: 0.2 },
    // A handful of stalks now and then, so a town with no marsh is never without fibre at all.
    { item: ItemType.Fibre, chance: 0.1 },
  ]),
  // Mud straight out of a bank, without carrying water — which nobody can do until there is
  // something to carry it in. This is the one way out of that circle, and so the first thing
  // a new town digs (`needs.ts`).
  landWork('bank-dig', 'Bank dig', ItemType.Mud, 4, 110),
  // What feeds the pit firing, and through it every pot and brick the town ever makes. Clay is
  // cut out of the same bank the mud comes off, from under it — heavy, wet work, so it is the
  // slowest thing anyone digs per load. Which *layer* of the bank is cut sets how fine the clay
  // is and so what can be made of it; that knob is not here yet, and this is only the siting.
  landWork('clay-pit', 'Clay pit', ItemType.Clay, 3, 120),
  // Reeds cut and retted, which is where everything twisted or woven starts. The one thing the
  // marsh gives, and the whole of the reason to claim any (`markers.ts`).
  landWork('reed-bed', 'Reed bed', ItemType.Fibre, 4, 100, undefined, [Biome.Marsh]),
  // Fibre anywhere else that grows — nettle and grass stalks, bast off the bark, rush, leaf —
  // stripped and combed by hand. Half the batch in more time than the reed bed: the marsh is
  // still the better place to be, but no town is shut out of cord by where it was founded.
  landWork('fibre-patch', 'Fibre patch', ItemType.Fibre, 2, 140, undefined, [
    Biome.Meadow,
    Biome.Forest,
    Biome.Highland,
    Biome.Tundra,
    Biome.Desert,
  ]),
];


/** Whether a land work can draw on a parcel of this biome whose ground gives these items. */
export function workServes(work: LandWork, biome: Biome, items: readonly Item[]): boolean {
  return items.includes(work.item) && (!work.where || work.where.includes(biome));
}

export function landWorkById(id: DesignId): LandWork | undefined {
  return LAND_WORKS.find((work) => work.design.id === id);
}

export function isLandWork(id: DesignId): boolean {
  return landWorkById(id) !== undefined;
}

/**
 * What one unit of a shift turns out to be. Seeded by the building, the tick and the unit, so
 * the same run finds the same berries in the same shifts.
 */
export function drawFromPool(work: LandWork, buildingId: string, tick: number, unit: number): Item {
  if (!work.pool) return work.item;
  const roll = (hashString(`${buildingId}:${tick}:${unit}`) % 10000) / 10000;
  let edge = 0;
  for (const entry of work.pool) {
    edge += entry.chance;
    if (roll < edge) return entry.item;
  }
  return work.item;
}
