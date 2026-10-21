import { DESIGN_SIZE } from './blocks.ts';
import { BlockKind, Direction, ItemType } from './types.ts';
import type { Block, Design, DesignId } from './types.ts';

export const HEARTH_DESIGN_ID: DesignId = 'hearth';

/**
 * The one design the player does not draw. Founding sets it down and nothing else may place it:
 * a settlement has exactly one fire, and the eight bins around it are the town's store. What
 * nobody is waiting on ends up here, and anyone who needs it can be sent to fetch it back.
 */
export const HEARTH_DESIGN: Design = {
  id: HEARTH_DESIGN_ID,
  label: 'Hearth',
  width: 3,
  height: 3,
  // The band that camps round the fire, in the open. Everything above three is a roof somebody
  // built (`needs.ts`), which is why the shelter ladder is the chapter's population curve.
  beds: 3,
  blocks: [
    { kind: BlockKind.Hearth, x: 1, y: 1, facing: Direction.North },
    // Facing outward, away from the fire: a bin is a terminus, and one pointed inward would
    // tip the town's stores into the flames.
    { kind: BlockKind.Storage, x: 0, y: 0, facing: Direction.West },
    { kind: BlockKind.Storage, x: 1, y: 0, facing: Direction.North },
    { kind: BlockKind.Storage, x: 2, y: 0, facing: Direction.East },
    { kind: BlockKind.Storage, x: 0, y: 1, facing: Direction.West },
    { kind: BlockKind.Storage, x: 2, y: 1, facing: Direction.East },
    { kind: BlockKind.Storage, x: 0, y: 2, facing: Direction.West },
    { kind: BlockKind.Storage, x: 1, y: 2, facing: Direction.South },
    { kind: BlockKind.Storage, x: 2, y: 2, facing: Direction.East },
  ],
};

const belt = (x: number, y: number, facing: Direction): Block => ({
  kind: BlockKind.Transport,
  x,
  y,
  facing,
});

export const LEAN_TO_ID: DesignId = 'lean-to';

/**
 * Two beds under a roof, which is two more people — and the first thing in the chapter that
 * buys back hours rather than making something. Sleeping rough costs the waking day; a roof is
 * worth about an hour and a half of it.
 *
 * A bin because somebody sleeping here keeps their kit beside them, and because a design with
 * no way in at all would be refused. Everything it is for is in `beds` and `sheltered`.
 */
export const LEAN_TO: Design = {
  id: LEAN_TO_ID,
  label: 'Lean-to',
  width: DESIGN_SIZE,
  height: DESIGN_SIZE,
  beds: 2,
  sheltered: true,
  blocks: [{ kind: BlockKind.Storage, x: 2, y: 2, facing: Direction.South }],
};

/** What the library opens with: one workshop that takes what the land works produce. */
export const STARTER_DESIGNS: Design[] = [
  LEAN_TO,
  {
    id: 'mud-mixer',
    label: 'Mud Mixer',
    width: DESIGN_SIZE,
    height: DESIGN_SIZE,
    blocks: [
      { kind: BlockKind.Input, x: 0, y: 1, facing: Direction.East, item: ItemType.Water },
      belt(1, 1, Direction.East),
      belt(2, 1, Direction.South),
      { kind: BlockKind.Input, x: 0, y: 3, facing: Direction.East, item: ItemType.Dirt },
      belt(1, 3, Direction.East),
      belt(2, 3, Direction.North),
      { kind: BlockKind.Combine, x: 2, y: 2, facing: Direction.East, recipeId: 'mud' },
      belt(3, 2, Direction.East),
      { kind: BlockKind.Output, x: 4, y: 2, facing: Direction.East, item: ItemType.Mud },
    ],
  },
];

export function cloneDesign(design: Design, id = design.id, label = design.label): Design {
  return {
    id,
    label,
    width: design.width,
    height: design.height,
    blocks: design.blocks.map((block) => ({ ...block })),
    ...(design.beds !== undefined ? { beds: design.beds } : {}),
    ...(design.sheltered !== undefined ? { sheltered: design.sheltered } : {}),
  };
}

export function emptyDesign(id: DesignId, label: string): Design {
  return { id, label, width: DESIGN_SIZE, height: DESIGN_SIZE, blocks: [] };
}

/** A fresh library: the hearth, and the workshop a new world opens with. */
export function startingLibrary(): Map<DesignId, Design> {
  const library = new Map<DesignId, Design>();
  library.set(HEARTH_DESIGN_ID, cloneDesign(HEARTH_DESIGN));
  for (const design of STARTER_DESIGNS) library.set(design.id, cloneDesign(design));
  return library;
}

/** Lowest free `design-n`, so deleting and drawing again cannot collide on an id. */
export function nextDesignId(library: Map<DesignId, Design>): DesignId {
  for (let index = 1; ; index += 1) {
    const id = `design-${index}`;
    if (!library.has(id)) return id;
  }
}
