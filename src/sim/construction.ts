import { staffSettlement } from './carriers.ts';
import { designOpen, learnMethods, workOpen } from './chapter.ts';
import { inClaim } from './claims.ts';
import { clearingFor } from './clearing.ts';
import { createBuilding, labelOf } from './buildings.ts';
import { CHIMNEY, clearSlot, lastStanding, placeIn, slotFor } from './area.ts';
import { HEARTH_DESIGN_ID } from './designs.ts';
import { polygonCentroid } from './geometry.ts';
import { landWorkById, workServes } from './landWorks.ts';
import { landYield } from './markers.ts';
import { parcelOf } from './parcels.ts';
import type { Parcel } from './parcels.ts';
import { BuildingState, CarrierState } from './types.ts';
import type { Building, BuildingId, CellId, Design, Settlement } from './types.ts';
import type { GameWorld } from './world.ts';
import { waterCheck } from './worldfield.ts';

export interface BuildCheck {
  ok: boolean;
  reason: string;
}

export function buildingOnParcel(settlement: Settlement, cellId: CellId): Building | undefined {
  for (const building of settlement.buildings.values()) {
    if (building.cellId === cellId) return building;
  }
  return undefined;
}

export function canBuild(
  world: GameWorld,
  settlement: Settlement,
  cellId: CellId,
  design: Design,
): BuildCheck {
  if (design.id === HEARTH_DESIGN_ID) return { ok: false, reason: 'the hearth is not yours to place' };
  const work = landWorkById(design.id);
  // The chapter is an order, and the bar only ever offers what the town has reached — but the
  // refusal lives here rather than only in the bar, so nothing can be raised round the back of
  // it (`chapter.ts`).
  if (!(work ? workOpen(settlement, design.id) : designOpen(settlement, design.id))) {
    return { ok: false, reason: `${settlement.name} has not worked out the ${design.label} yet` };
  }
  // An unfinished machine may be raised: a works is sited empty and fitted out afterwards, in
  // the building itself (`fitting.ts`). A shed with nothing in it is legal and does nothing,
  // which is a thing the player can see — where a modal refusing to save taught nothing.
  // A parcel already worked is an area, and what goes there goes into one of its slots: a land
  // work into the ground slot if the ground yields it, anything else into a free work slot.
  const area = buildingOnParcel(settlement, cellId);
  if (area) {
    const fits = slotFor(area, design, parcelOf(world.seed, cellId).biome);
    return { ok: fits.ok, reason: fits.ok ? `into this area: ${fits.reason}` : fits.reason };
  }
  // A settlement builds on the ground its hearth claims and nowhere else (`claims.ts`).
  if (!inClaim(world, settlement, cellId)) return { ok: false, reason: `outside ${settlement.name}'s claim` };
  const standing = waterCheck(parcelOf(world.seed, cellId).biome);
  if (standing) return { ok: false, reason: standing };

  // A land work is the ground opened, so it is the one thing siting can refuse: a well wants the
  // water running through its own tile. A workshop is fed through doors — carriers reach it
  // anywhere — and never gates.
  if (!work) return { ok: true, reason: `room for a ${design.label}` };
  const biome = parcelOf(world.seed, cellId).biome;
  if (!workServes(work, biome, landYield(world, cellId))) {
    return { ok: false, reason: `no ${work.item} for a ${design.label} in this ground` };
  }
  return { ok: true, reason: `room for a ${design.label} · draws ${work.item} here` };
}

/** Lowest free index for an area, so razing and rebuilding cannot collide on an id. */
function nextId(settlement: Settlement): BuildingId {
  for (let index = 1; ; index += 1) {
    const id = `${settlement.id}/area-${index}`;
    if (!settlement.buildings.has(id)) return id;
  }
}

/**
 * A work area on a parcel with nothing in it: a clearing with one slot. Founding and the player
 * both start here, and what stands in it is filled in afterwards.
 */
export function addArea(world: GameWorld, settlement: Settlement, cell: Parcel): Building {
  // Centred on its parcel: an area is smaller than the cell it stands on.
  const position = polygonCentroid(cell.vertices);
  const area = createBuilding(nextId(settlement), cell.id, position, landYield(world, cell.id));
  settlement.buildings.set(area.id, area);
  // Here, where the map of buildings actually changes, rather than in the callers. Anything
  // derived and cached on the revision — the claims, the chapter — is read between this line
  // and the end of `placeBuilding`, and a bump that came afterwards handed those a stale
  // answer about a building that was already standing.
  settlement.revision += 1;
  return area;
}

/**
 * Put a design on a fresh parcel as an area with that one thing in it. For levels and for
 * anything that sets a station down in one go: the player starts with `placeArea` and fills the
 * slot from the sheet.
 */
export function addBuilding(
  world: GameWorld,
  settlement: Settlement,
  cell: Parcel,
  design: Design,
): Building {
  const area = addArea(world, settlement, cell);
  placeIn(area, slotFor(area, design, cell.biome).slot ?? 0, design);
  return area;
}

/** Whether a work area could be marked out here: free land inside the claim. */
export function canPlaceArea(world: GameWorld, settlement: Settlement, cellId: CellId): BuildCheck {
  if (buildingOnParcel(settlement, cellId)) return { ok: false, reason: 'the parcel is taken' };
  if (!inClaim(world, settlement, cellId)) return { ok: false, reason: `outside ${settlement.name}'s claim` };
  const standing = waterCheck(parcelOf(world.seed, cellId).biome);
  if (standing) return { ok: false, reason: standing };
  return { ok: true, reason: 'mark out a work area here' };
}

/**
 * Mark out a work area: one open slot, and the site cleared by hand first like any other
 * (`clearing.ts`). It stands there doing nothing until something is put in its slot.
 */
export function placeArea(world: GameWorld, settlement: Settlement, cellId: CellId): Building {
  const check = canPlaceArea(world, settlement, cellId);
  if (!check.ok) throw new Error(`cannot mark out an area here: ${check.reason}`);
  const area = addArea(world, settlement, parcelOf(world.seed, cellId));
  clearSite(world, area, cellId);
  staffSettlement(settlement);
  return area;
}

/** Fell and dig the plot of a newly placed area, if there is anything to do. */
function clearSite(world: GameWorld, area: Building, cellId: CellId): void {
  const work = clearingFor(world, cellId);
  if (work.needed > 0) {
    area.clearing = { done: 0, ...work };
    area.state = BuildingState.Clearing;
  }
}

export function placeBuilding(
  world: GameWorld,
  settlement: Settlement,
  cellId: CellId,
  design: Design,
): Building {
  const check = canBuild(world, settlement, cellId, design);
  if (!check.ok) throw new Error(`cannot build ${design.label} here: ${check.reason}`);

  // Into an area already standing: no new ground to clear, only a slot filled. Only the walk
  // inside an area is free, never the work, so the station still takes its own time to run.
  const existing = buildingOnParcel(settlement, cellId);
  if (existing) {
    const fits = slotFor(existing, design, parcelOf(world.seed, cellId).biome);
    if (fits.slot === null) throw new Error(`no slot for a ${design.label} here`);
    placeIn(existing, fits.slot, design);
    settlement.revision += 1;
    staffSettlement(settlement);
    learnMethods(settlement);
    return existing;
  }

  const building = addBuilding(world, settlement, parcelOf(world.seed, cellId), design);
  // Placed, not raised: the site has to be prepared first, by hand — felled, then dug and levelled
  // (`clearing.ts`). Founding does not go through here, so the first area is up the moment it is set.
  clearSite(world, building, cellId);
  staffSettlement(settlement);
  // Raising something can finish a step, and finishing a step can teach a recipe.
  learnMethods(settlement);
  return building;
}

export function canRaze(settlement: Settlement, buildingId: BuildingId): BuildCheck {
  const building = settlement.buildings.get(buildingId);
  if (!building) return { ok: false, reason: 'nothing there' };
  if (building.id === settlement.hearthId) return { ok: false, reason: 'the hearth stays' };
  return { ok: true, reason: `raze the ${labelOf(building)}` };
}

/**
 * Take a building down, along with its paths. Anything a carrier was holding for it is lost —
 * there is nowhere else to put it, and leaving the carrier holding a load addressed to a
 * building that no longer exists would wedge it.
 */
export function raze(settlement: Settlement, buildingId: BuildingId): boolean {
  if (!canRaze(settlement, buildingId).ok) return false;
  const building = settlement.buildings.get(buildingId);
  if (!building) return false;

  settlement.buildings.delete(buildingId);

  for (const carrier of settlement.carriers.values()) {
    const touched =
      carrier.job?.sourceId === buildingId ||
      carrier.job?.destinationId === buildingId ||
      carrier.atId === buildingId;
    if (!touched) continue;

    carrier.job = null;
    carrier.carryingItem = null;
    carrier.left = 0;
    carrier.trail = [];
    carrier.state = CarrierState.Idle;
    if (carrier.atId === buildingId) {
      carrier.atId = carrier.homeId;
      const home = settlement.buildings.get(carrier.homeId);
      if (home) carrier.position = { ...home.position };
    }
  }

  settlement.revision += 1;
  return true;
}

/**
 * Take one station out of an area. The last thing standing takes the area with it, and the
 * hearth never goes. Whoever was at the station comes out; what is on the shelf stays.
 */
export function razeSlot(settlement: Settlement, buildingId: BuildingId, slot: number): boolean {
  const area = settlement.buildings.get(buildingId);
  const design = area?.slots[slot]?.design;
  if (!area || !design || design.id === HEARTH_DESIGN_ID || design.id === CHIMNEY.id) return false;
  if (lastStanding(area)) return raze(settlement, buildingId);
  clearSlot(area, slot);
  for (const carrier of settlement.carriers.values()) {
    if (carrier.job?.sourceId !== buildingId || (carrier.job.slot ?? -1) !== slot) continue;
    carrier.job = null;
    carrier.state = CarrierState.Idle;
  }
  settlement.revision += 1;
  return true;
}
