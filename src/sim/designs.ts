import { DESIGN_SIZE } from './blocks.ts';
import { CHAR_METHOD, CORD_METHOD, DAUB_METHOD, POTS_METHOD, POTS_ON_CHARCOAL, WEAVE_METHOD } from './book.ts';
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

export const PIT_FIRING_ID: DesignId = 'pit-firing';
export const CLAMP_ID: DesignId = 'charcoal-clamp';

/**
 * The two rigs of the heat age, raised like any other building and carrying their masonry with
 * them (`Design.rig`). A rig is capital: what its build params are is settled when it goes up,
 * and the only way to change them is to tear it down and build it differently.
 *
 * Both are doors and bins and nothing else. What they *do* is the method running on them, which
 * is knowledge and lives in the book — one pit fires pots today and something else tomorrow.
 */
export const PIT_FIRING: Design = {
  id: PIT_FIRING_ID,
  label: 'Pit firing',
  width: DESIGN_SIZE,
  height: DESIGN_SIZE,
  rig: 'pitFire',
  methods: [POTS_METHOD, POTS_ON_CHARCOAL],
  blocks: [
    { kind: BlockKind.Input, x: 0, y: 2, facing: Direction.East, item: ItemType.Clay },
    { kind: BlockKind.Input, x: 1, y: 0, facing: Direction.South, item: ItemType.Deadwood },
    { kind: BlockKind.Storage, x: 2, y: 2, facing: Direction.South },
    { kind: BlockKind.Storage, x: 3, y: 2, facing: Direction.East },
  ],
};

export const CLAMP: Design = {
  id: CLAMP_ID,
  label: 'Charcoal clamp',
  width: DESIGN_SIZE,
  height: DESIGN_SIZE,
  rig: 'clamp',
  methods: [CHAR_METHOD],
  blocks: [
    { kind: BlockKind.Input, x: 0, y: 2, facing: Direction.East, item: ItemType.Deadwood },
    { kind: BlockKind.Input, x: 1, y: 0, facing: Direction.South, item: ItemType.Embers },
    { kind: BlockKind.Storage, x: 2, y: 2, facing: Direction.South },
    { kind: BlockKind.Storage, x: 3, y: 2, facing: Direction.East },
  ],
};

export const CORD_WALK_ID: DesignId = 'cord-walk';
export const WEAVING_FRAME_ID: DesignId = 'weaving-frame';
export const DAUB_PIT_ID: DesignId = 'daub-pit';

/**
 * The three rigs of Age II, which are the first floors in the game with no fire under them: a
 * walk to lay a cord along, a frame to weave against, a pit to tread daub in. They carry their
 * masonry like the heat rigs do (`Design.rig`), and like them they are doors and bins and
 * nothing else — what they do is the method running on them.
 */
export const CORD_WALK: Design = {
  id: CORD_WALK_ID,
  label: 'Cord walk',
  width: DESIGN_SIZE,
  height: DESIGN_SIZE,
  rig: 'cordWalk',
  methods: [CORD_METHOD],
  blocks: [
    { kind: BlockKind.Input, x: 0, y: 2, facing: Direction.East, item: ItemType.Fibre },
    { kind: BlockKind.Storage, x: 3, y: 2, facing: Direction.East },
  ],
};

export const WEAVING_FRAME: Design = {
  id: WEAVING_FRAME_ID,
  label: 'Weaving frame',
  width: DESIGN_SIZE,
  height: DESIGN_SIZE,
  rig: 'weavingFrame',
  methods: [WEAVE_METHOD],
  blocks: [
    { kind: BlockKind.Input, x: 0, y: 2, facing: Direction.East, item: ItemType.Deadwood },
    { kind: BlockKind.Input, x: 1, y: 0, facing: Direction.South, item: ItemType.Cord },
    { kind: BlockKind.Storage, x: 3, y: 2, facing: Direction.East },
  ],
};

export const DAUB_PIT: Design = {
  id: DAUB_PIT_ID,
  label: 'Daub pit',
  width: DESIGN_SIZE,
  height: DESIGN_SIZE,
  rig: 'daubPit',
  methods: [DAUB_METHOD],
  blocks: [
    { kind: BlockKind.Input, x: 0, y: 2, facing: Direction.East, item: ItemType.Mud },
    { kind: BlockKind.Input, x: 1, y: 0, facing: Direction.South, item: ItemType.Fibre },
    { kind: BlockKind.Storage, x: 2, y: 2, facing: Direction.South },
    { kind: BlockKind.Storage, x: 3, y: 2, facing: Direction.East },
  ],
};

/** What the library opens with: the chapter's buildings, every one of them a step in it. */
export const STARTER_DESIGNS: Design[] = [LEAN_TO, CORD_WALK, WEAVING_FRAME, DAUB_PIT, PIT_FIRING, CLAMP];

export function cloneDesign(design: Design, id = design.id, label = design.label): Design {
  return {
    id,
    label,
    width: design.width,
    height: design.height,
    blocks: design.blocks.map((block) => ({ ...block })),
    ...(design.beds !== undefined ? { beds: design.beds } : {}),
    ...(design.sheltered !== undefined ? { sheltered: design.sheltered } : {}),
    ...(design.rig !== undefined ? { rig: design.rig } : {}),
    ...(design.methods !== undefined ? { methods: [...design.methods] } : {}),
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
