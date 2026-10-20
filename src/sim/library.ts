import { validateDesign } from './blocks.ts';
import { createBuilding } from './buildings.ts';
import { HEARTH_DESIGN_ID, cloneDesign, nextDesignId } from './designs.ts';
import { isLandWork } from './landWorks.ts';
import { WORKS_DESIGN, isWorks } from './works.ts';
import type { Building, Design, DesignId } from './types.ts';
import type { GameWorld } from './world.ts';

export interface LibraryCheck {
  ok: boolean;
  reason: string;
}

/**
 * Put a design in the library, under its own id if it has a free one and a fresh one otherwise.
 * The library stores a copy: the editor goes on mutating the draft the player is holding, and
 * a half-rotated belt has no business appearing in a design someone already saved.
 */
export function saveDesign(world: GameWorld, draft: Design): Design | null {
  if (draft.id === HEARTH_DESIGN_ID || isLandWork(draft.id) || isWorks(draft.id)) return null;
  if (!validateDesign(draft).ok) return null;

  const id = draft.id === '' ? nextDesignId(world.library) : draft.id;
  const design = cloneDesign(draft, id, draft.label.trim() || id);
  world.library.set(id, design);
  return design;
}

export function removeDesign(world: GameWorld, designId: DesignId): boolean {
  if (designId === HEARTH_DESIGN_ID) return false;
  return world.library.delete(designId);
}

/** Is anything standing on this design? Raising it again after an edit is the player's call. */
export function buildingsUsing(world: GameWorld, designId: DesignId): number {
  let count = 0;
  for (const settlement of world.settlements.values()) {
    for (const building of settlement.buildings.values()) {
      if (building.designId === designId) count += 1;
    }
  }
  return count;
}

/**
 * Re-tool every standing building raised from a design: swap in the library's current blocks and
 * start the interior over. Whatever was on the belts is lost, which is why this is a deliberate
 * act and not something a save quietly does behind the player's back.
 */
export function retool(world: GameWorld, designId: DesignId): number {
  const design = world.library.get(designId);
  if (!design) return 0;

  let retooled = 0;
  for (const settlement of world.settlements.values()) {
    for (const [id, building] of settlement.buildings) {
      if (building.designId !== designId) continue;
      const fresh = createBuilding(id, design, building.cellId, building.position, building.yields);
      fresh.delivered = building.delivered;
      fresh.producedTotal = building.producedTotal;
      settlement.buildings.set(id, fresh);
      retooled += 1;
    }
  }
  return retooled;
}

/**
 * Keep a copy of a works that is standing and working, as a pattern to stamp again.
 *
 * The library is filled by success, not by speculation: you get a pattern by pointing at
 * something that already does what you wanted, which is a far better teacher than an empty grid
 * — and it is a *copy*, so going on to change the building it came from leaves the pattern
 * alone, and raising the pattern again leaves the building alone.
 */
export function saveAsPattern(world: GameWorld, building: Building, label?: string): Design | null {
  if (building.design.blocks.length === 0) return null;
  const id = nextDesignId(world.library);
  const named = (label ?? building.design.label).trim();
  const design = cloneDesign(building.design, id, named === '' || named === WORKS_DESIGN.label ? id : named);
  world.library.set(id, design);
  return design;
}
