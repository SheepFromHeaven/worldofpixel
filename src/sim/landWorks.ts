import { DESIGN_SIZE } from './blocks.ts';
import { BlockKind, Direction, ItemType } from './types.ts';
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
}

function landWork(id: DesignId, label: string, item: Item): LandWork {
  return {
    item,
    design: {
      id,
      label,
      width: DESIGN_SIZE,
      height: DESIGN_SIZE,
      blocks: [
        { kind: BlockKind.Source, x: 1, y: 2, facing: Direction.East, item },
        { kind: BlockKind.Transport, x: 2, y: 2, facing: Direction.East },
        { kind: BlockKind.Output, x: 3, y: 2, facing: Direction.East, item },
      ],
    },
  };
}

export const LAND_WORKS: readonly LandWork[] = [
  landWork('well', 'Well', ItemType.Water),
  landWork('digging', 'Dig site', ItemType.Dirt),
  landWork('woodcutter', 'Woodcutter', ItemType.Wood),
];

export function landWorkById(id: DesignId): LandWork | undefined {
  return LAND_WORKS.find((work) => work.design.id === id);
}

export function isLandWork(id: DesignId): boolean {
  return landWorkById(id) !== undefined;
}
