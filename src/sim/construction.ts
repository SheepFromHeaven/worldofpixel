import { staffSettlement } from './carriers.ts';
import { inClaim } from './claims.ts';
import { clearingFor } from './clearing.ts';
import { createBuilding } from './buildings.ts';
import { HEARTH_DESIGN_ID } from './designs.ts';
import { polygonCentroid } from './geometry.ts';
import { landWorkById } from './landWorks.ts';
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

/**
 * The library minus the hearth: a settlement has one fire and the player does not place it. The
 * land works are not in the library at all — see `LAND_WORKS`.
 */
export function buildableDesigns(world: GameWorld): Design[] {
  return [...world.library.values()].filter((design) => design.id !== HEARTH_DESIGN_ID);
}

export function canBuild(
  world: GameWorld,
  settlement: Settlement,
  cellId: CellId,
  design: Design,
): BuildCheck {
  if (design.id === HEARTH_DESIGN_ID) return { ok: false, reason: 'the hearth is not yours to place' };
  const work = landWorkById(design.id);
  // An unfinished machine may be raised: a works is sited empty and fitted out afterwards, in
  // the building itself (`fitting.ts`). A shed with nothing in it is legal and does nothing,
  // which is a thing the player can see — where a modal refusing to save taught nothing.
  if (buildingOnParcel(settlement, cellId)) return { ok: false, reason: 'the parcel is taken' };
  // A settlement builds on the ground its hearth claims and nowhere else (`claims.ts`).
  if (!inClaim(world, settlement, cellId)) return { ok: false, reason: `outside ${settlement.name}'s claim` };
  const standing = waterCheck(parcelOf(world.seed, cellId).biome);
  if (standing) return { ok: false, reason: standing };

  // A land work is the ground opened, so it is the one thing siting can refuse: a well wants the
  // water running through its own tile. A workshop is fed through doors — carriers reach it
  // anywhere — and never gates.
  if (!work) return { ok: true, reason: `room for a ${design.label}` };
  if (!landYield(world, cellId).includes(work.item)) {
    return { ok: false, reason: `no ${work.item} in this ground` };
  }
  return { ok: true, reason: `room for a ${design.label} · draws ${work.item} here` };
}

/** Lowest free index for a design, so razing and rebuilding cannot collide on an id. */
function nextId(settlement: Settlement, design: Design): BuildingId {
  for (let index = 1; ; index += 1) {
    const id = `${settlement.id}/${design.id}-${index}`;
    if (!settlement.buildings.has(id)) return id;
  }
}

/**
 * Put a building on a parcel. Used both by the player and by founding, which is why it does not
 * check `canBuild` — founding sets the hearth, and the player never may.
 */
export function addBuilding(
  world: GameWorld,
  settlement: Settlement,
  cell: Parcel,
  design: Design,
): Building {
  // Centred on its parcel: a building is smaller than the cell it stands on.
  const position = polygonCentroid(cell.vertices);
  const building = createBuilding(
    nextId(settlement, design),
    design,
    cell.id,
    position,
    landYield(world, cell.id),
  );
  settlement.buildings.set(building.id, building);
  return building;
}

export function placeBuilding(
  world: GameWorld,
  settlement: Settlement,
  cellId: CellId,
  design: Design,
): Building {
  const check = canBuild(world, settlement, cellId, design);
  if (!check.ok) throw new Error(`cannot build ${design.label} here: ${check.reason}`);

  const building = addBuilding(world, settlement, parcelOf(world.seed, cellId), design);
  // Placed, not raised: the site has to be prepared first, by hand — felled, then dug and levelled
  // (`clearing.ts`). Founding goes through `addBuilding` alone, so the hearth is up the moment it is set.
  const work = clearingFor(world, cellId);
  if (work.needed > 0) {
    building.clearing = { done: 0, ...work };
    building.state = BuildingState.Clearing;
  }
  staffSettlement(settlement);
  settlement.revision += 1;
  return building;
}

export function canRaze(settlement: Settlement, buildingId: BuildingId): BuildCheck {
  const building = settlement.buildings.get(buildingId);
  if (!building) return { ok: false, reason: 'nothing there' };
  if (building.id === settlement.hearthId) return { ok: false, reason: 'the hearth stays' };
  return { ok: true, reason: `raze the ${building.design.label}` };
}

/**
 * Take a building down, along with its paths. Anything a carrier was holding for it is lost —
 * there is nowhere else to put it, and leaving the carrier holding a load addressed to a
 * building that no longer exists would wedge it.
 */
export function raze(world: GameWorld, settlement: Settlement, buildingId: BuildingId): boolean {
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
