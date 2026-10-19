import { designSources, validateDesign } from './blocks.ts';
import { staffSettlement } from './carriers.ts';
import { createBuilding } from './buildings.ts';
import { HEARTH_DESIGN_ID } from './designs.ts';
import { polygonCentroid } from './geometry.ts';
import { landYield } from './markers.ts';
import { parcelOf } from './parcels.ts';
import type { Parcel } from './parcels.ts';
import { rebuildPaths } from './roads.ts';
import { CarrierState } from './types.ts';
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

/** The library minus the hearth: a settlement has one fire and the player does not place it. */
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
  const drawn = validateDesign(design);
  if (!drawn.ok) return { ok: false, reason: `the design is unfinished — ${drawn.reason}` };
  if (buildingOnParcel(settlement, cellId)) return { ok: false, reason: 'the parcel is taken' };
  const standing = waterCheck(parcelOf(world.seed, cellId).biome);
  if (standing) return { ok: false, reason: standing };

  // A source *is* the ground opened, so it is the one thing siting can refuse: a well wants the
  // water running through its own tile. An input block is only a door — carriers feed it
  // anywhere — and never gates.
  const ground = landYield(world, cellId);
  const sources = designSources(design);
  const missing = sources.filter((item) => !ground.includes(item));
  if (missing.length > 0) {
    return { ok: false, reason: `no ${missing.join(' or ')} in this ground` };
  }

  const fed = sources.length > 0 ? ` · draws ${sources.join(' and ')} here` : '';
  return { ok: true, reason: `room for a ${design.label}${fed}` };
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
  staffSettlement(settlement);
  // A parcel is dirt or a building, never both: the road under it is covered by the floor, and
  // leaving it in the set would let `canPaveRoad`'s refusal disagree with what is on the ground.
  settlement.roads.delete(cellId);
  rebuildPaths(world, settlement);
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
    carrier.route = [];
    carrier.pathId = null;
    carrier.state = CarrierState.Idle;
    if (carrier.atId === buildingId) {
      carrier.atId = carrier.homeId;
      const home = settlement.buildings.get(carrier.homeId);
      if (home) carrier.position = { ...home.position };
    }
  }

  rebuildPaths(world, settlement);
  return true;
}
