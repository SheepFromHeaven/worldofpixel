import { DESIGN_SIZE } from './blocks.ts';
import type { Design, DesignId } from './types.ts';

/**
 * The empty shed.
 *
 * A works is raised before it is a machine. The player sites four walls and a floor, and fits it
 * out afterwards, in the building itself (`fitting.ts`) — so the decision about *where* is taken
 * on the map, with the river and the dig and the walking distances all on screen, and the
 * decision about *how* is taken inside, where the squares are.
 *
 * It is not in the library and never can be: the library holds patterns, which are works that
 * already do something. An empty shed is the thing you start from, like the hearth is the thing
 * a town starts from, so it lives here beside the rule that nothing may save over it.
 */
export const WORKS_DESIGN_ID: DesignId = 'works';

export const WORKS_DESIGN: Design = {
  id: WORKS_DESIGN_ID,
  label: 'Works',
  width: DESIGN_SIZE,
  height: DESIGN_SIZE,
  blocks: [],
};

export const isWorks = (designId: DesignId): boolean => designId === WORKS_DESIGN_ID;
