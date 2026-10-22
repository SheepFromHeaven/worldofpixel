import { CHAR_METHOD, CORD_METHOD, DAUB_METHOD, EMBERS_METHOD, POTS_METHOD, POTS_ON_CHARCOAL, WEAVE_METHOD } from './book.ts';
import type { Design, DesignId } from './types.ts';

export const STORE_CAPACITY = 8;

export const HEARTH_DESIGN_ID: DesignId = 'fireplace';

export const HEARTH_DESIGN: Design = {
  id: HEARTH_DESIGN_ID,
  label: 'Fireplace',
  capacity: STORE_CAPACITY,
  store: true,
  beds: 3,
  rig: 'openFire',
  methods: [EMBERS_METHOD],
};

export const WORK_AREA: Design = { id: 'work-area', label: 'Work area', capacity: STORE_CAPACITY };

export const LEAN_TO_ID: DesignId = 'lean-to';

export const LEAN_TO: Design = {
  id: LEAN_TO_ID,
  label: 'Lean-to',
  capacity: STORE_CAPACITY,
  beds: 2,
  sheltered: true,
};

export const PIT_FIRING_ID: DesignId = 'pit-firing';
export const CLAMP_ID: DesignId = 'charcoal-clamp';

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

export function startingLibrary(): Map<DesignId, Design> {
  const library = new Map<DesignId, Design>();
  library.set(HEARTH_DESIGN_ID, cloneDesign(HEARTH_DESIGN));
  for (const design of STARTER_DESIGNS) library.set(design.id, cloneDesign(design));
  return library;
}

