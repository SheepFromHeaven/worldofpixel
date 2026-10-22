import { CHAR_METHOD, CORD_METHOD, DAUB_METHOD, EMBERS_METHOD, POTS_METHOD, POTS_ON_CHARCOAL, WEAVE_METHOD } from './book.ts';
import type { Design, DesignId } from './types.ts';

/**
 * How much of each thing a building can hold, to begin with. Eight, everywhere: it is the figure
 * the slab writes beside every item ("3 of 8"), and it is a starting point rather than a law —
 * a bigger store is what a later age builds.
 */
export const STORE_CAPACITY = 8;

export const HEARTH_DESIGN_ID: DesignId = 'hearth';

/**
 * The one design the player does not draw. Founding sets it down and nothing else may place it:
 * a settlement has exactly one fire, and it is the town's store. What nobody is waiting on ends
 * up here, and anyone who needs it can be sent to fetch it back.
 */
export const HEARTH_DESIGN: Design = {
  id: HEARTH_DESIGN_ID,
  label: 'Hearth',
  capacity: STORE_CAPACITY,
  store: true,
  // The band that camps round the fire, in the open. Everything above three is a roof somebody
  // built (`needs.ts`), which is why the shelter ladder is the chapter's population curve.
  beds: 3,
  // The town's first rig, opening with the one method the town is born knowing: banking a fire.
  // Sealing a basket is step 10 and the town has to get there (`chapter.ts`).
  rig: 'openFire',
  methods: [EMBERS_METHOD],
};

export const LEAN_TO_ID: DesignId = 'lean-to';

/**
 * Two beds under a roof, which is two more people — and the first thing in the chapter that
 * buys back hours rather than making something. Sleeping rough costs the waking day; a roof is
 * worth about an hour and a half of it.
 *
 * It holds a little, because somebody sleeping here keeps their kit beside them. Everything
 * else it is for is in `beds` and `sheltered`.
 */
export const LEAN_TO: Design = {
  id: LEAN_TO_ID,
  label: 'Lean-to',
  capacity: STORE_CAPACITY,
  beds: 2,
  sheltered: true,
};

export const PIT_FIRING_ID: DesignId = 'pit-firing';
export const CLAMP_ID: DesignId = 'charcoal-clamp';

/**
 * The two rigs of the heat age, raised like any other building and carrying their masonry with
 * them (`Design.rig`). A rig is capital: what its build params are is settled when it goes up,
 * and the only way to change them is to tear it down and build it differently.
 *
 * What they *do* is the method running on them, which is knowledge and lives in the book: one
 * pit fires pots today and something else tomorrow. What they *hold* is a number, not a floor
 * plan — a pile of clay by the pit, which the slab shows.
 */
export const PIT_FIRING: Design = {
  id: PIT_FIRING_ID,
  label: 'Pit firing',
  capacity: STORE_CAPACITY,
  rig: 'pitFire',
  methods: [POTS_METHOD, POTS_ON_CHARCOAL],
};

export const CLAMP: Design = {
  id: CLAMP_ID,
  label: 'Charcoal clamp',
  capacity: STORE_CAPACITY,
  rig: 'clamp',
  methods: [CHAR_METHOD],
};

export const CORD_WALK_ID: DesignId = 'cord-walk';
export const WEAVING_FRAME_ID: DesignId = 'weaving-frame';
export const DAUB_PIT_ID: DesignId = 'daub-pit';

/**
 * The three rigs of Age II, which are the first floors in the game with no fire under them: a
 * walk to lay a cord along, a frame to weave against, a pit to tread daub in. They carry their
 * masonry like the heat rigs do (`Design.rig`), and like them they are a floor and a number of
 * units it holds — what they do is the method running on them.
 */
export const CORD_WALK: Design = {
  id: CORD_WALK_ID,
  label: 'Cord walk',
  capacity: STORE_CAPACITY,
  rig: 'cordWalk',
  methods: [CORD_METHOD],
};

export const WEAVING_FRAME: Design = {
  id: WEAVING_FRAME_ID,
  label: 'Weaving frame',
  capacity: STORE_CAPACITY,
  rig: 'weavingFrame',
  methods: [WEAVE_METHOD],
};

export const DAUB_PIT: Design = {
  id: DAUB_PIT_ID,
  label: 'Daub pit',
  capacity: STORE_CAPACITY,
  rig: 'daubPit',
  methods: [DAUB_METHOD],
};

/** What the library opens with: the chapter's buildings, every one of them a step in it. */
export const STARTER_DESIGNS: Design[] = [LEAN_TO, CORD_WALK, WEAVING_FRAME, DAUB_PIT, PIT_FIRING, CLAMP];

export function cloneDesign(design: Design, id = design.id, label = design.label): Design {
  return {
    id,
    label,
    capacity: design.capacity,
    ...(design.store !== undefined ? { store: design.store } : {}),
    ...(design.beds !== undefined ? { beds: design.beds } : {}),
    ...(design.sheltered !== undefined ? { sheltered: design.sheltered } : {}),
    ...(design.rig !== undefined ? { rig: design.rig } : {}),
    ...(design.methods !== undefined ? { methods: [...design.methods] } : {}),
    ...(design.needsSun !== undefined ? { needsSun: design.needsSun } : {}),
  };
}

export function emptyDesign(id: DesignId, label: string, capacity = STORE_CAPACITY): Design {
  return { id, label, capacity };
}

/** A fresh library: the hearth, and the workshop a new world opens with. */
export function startingLibrary(): Map<DesignId, Design> {
  const library = new Map<DesignId, Design>();
  library.set(HEARTH_DESIGN_ID, cloneDesign(HEARTH_DESIGN));
  for (const design of STARTER_DESIGNS) library.set(design.id, cloneDesign(design));
  return library;
}

