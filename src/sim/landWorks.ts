import { ItemType } from './types.ts';
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
}

/**
 * The ground gives nothing on its own; a villager has to work it. Each land work is a shift of
 * fixed length that yields a fixed batch: a bucket from the well takes five seconds, ten logs
 * take the woodcutter fifteen, five loads of earth take the dig ten. Drawn one unit at a time
 * across the shift, so the line inside the building moves while someone is in there.
 */
function landWork(id: DesignId, label: string, item: Item, batch: number, ticks: number): LandWork {
  return {
    item,
    batch,
    ticks,
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
  landWork('forage-camp', 'Forage camp', ItemType.Deadwood, 4, 140),
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
  landWork('reed-bed', 'Reed bed', ItemType.Fibre, 4, 100),
];


export function landWorkById(id: DesignId): LandWork | undefined {
  return LAND_WORKS.find((work) => work.design.id === id);
}

export function isLandWork(id: DesignId): boolean {
  return landWorkById(id) !== undefined;
}
