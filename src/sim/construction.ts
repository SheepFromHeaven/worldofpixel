import { CHIMNEY, clearSlot, lastStanding, placeIn, slotFor } from './area.ts';
import { createBuilding, labelOf } from './buildings.ts';
import { staffSettlement } from './carriers.ts';
import { designOpen, learnRecipes, workOpen } from './chapter.ts';
import { inClaim } from './claims.ts';
import { clearingFor } from './clearing.ts';
import { HEARTH_DESIGN_ID } from './designs.ts';
import { polygonCentroid } from './geometry.ts';
import { landWorkById } from './landWorks.ts';
import { landYield } from './markers.ts';
import type { Parcel } from './terrain/parcels.ts';
import { parcelOf } from './terrain/parcels.ts';
import { waterCheck } from './terrain/worldfield.ts';
import type { Building, BuildingId, CellId, Design, Settlement } from './types.ts';
import { BuildingState, CarrierState } from './types.ts';
import type { GameWorld } from './world.ts';

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
  if (!(work ? workOpen(settlement, design.id) : designOpen(settlement, design.id))) {
    return { ok: false, reason: `${settlement.name} has not worked out the ${design.label} yet` };
  }
  const area = buildingOnParcel(settlement, cellId);
  if (area) {
    const fits = slotFor(area, design, parcelOf(world.seed, cellId).biome);
    return { ok: fits.ok, reason: fits.ok ? `into this area: ${fits.reason}` : fits.reason };
  }
  if (!inClaim(world, settlement, cellId)) return { ok: false, reason: `outside ${settlement.name}'s claim` };
  const standing = waterCheck(parcelOf(world.seed, cellId).biome);
  if (standing) return { ok: false, reason: standing };

  if (!work) return { ok: true, reason: `room for a ${design.label}` };
  const biome = parcelOf(world.seed, cellId).biome;
  if (!work.serves(biome, landYield(world, cellId))) {
    return { ok: false, reason: `no ${work.item} for a ${design.label} in this ground` };
  }
  return { ok: true, reason: `room for a ${design.label} · draws ${work.item} here` };
}

function nextId(settlement: Settlement): BuildingId {
  for (let index = 1; ; index += 1) {
    const id = `${settlement.id}/area-${index}`;
    if (!settlement.buildings.has(id)) return id;
  }
}

export function addArea(world: GameWorld, settlement: Settlement, cell: Parcel): Building {
  const position = polygonCentroid(cell.vertices);
  const area = createBuilding(nextId(settlement), cell.id, position, landYield(world, cell.id));
  settlement.buildings.set(area.id, area);
  settlement.revision += 1;
  return area;
}

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

export function canPlaceArea(world: GameWorld, settlement: Settlement, cellId: CellId): BuildCheck {
  if (buildingOnParcel(settlement, cellId)) return { ok: false, reason: 'the parcel is taken' };
  if (!inClaim(world, settlement, cellId)) return { ok: false, reason: `outside ${settlement.name}'s claim` };
  const standing = waterCheck(parcelOf(world.seed, cellId).biome);
  if (standing) return { ok: false, reason: standing };
  return { ok: true, reason: 'mark out a work area here' };
}

export function placeArea(world: GameWorld, settlement: Settlement, cellId: CellId): Building {
  const check = canPlaceArea(world, settlement, cellId);
  if (!check.ok) throw new Error(`cannot mark out an area here: ${check.reason}`);
  const area = addArea(world, settlement, parcelOf(world.seed, cellId));
  clearSite(world, area, cellId);
  staffSettlement(settlement);
  return area;
}

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

  const existing = buildingOnParcel(settlement, cellId);
  if (existing) {
    const fits = slotFor(existing, design, parcelOf(world.seed, cellId).biome);
    if (fits.slot === null) throw new Error(`no slot for a ${design.label} here`);
    placeIn(existing, fits.slot, design);
    settlement.revision += 1;
    staffSettlement(settlement);
    learnRecipes(settlement);
    return existing;
  }

  const building = addBuilding(world, settlement, parcelOf(world.seed, cellId), design);
  clearSite(world, building, cellId);
  staffSettlement(settlement);
  learnRecipes(settlement);
  return building;
}

export function canRaze(settlement: Settlement, buildingId: BuildingId): BuildCheck {
  const building = settlement.buildings.get(buildingId);
  if (!building) return { ok: false, reason: 'nothing there' };
  if (building.id === settlement.hearthId) return { ok: false, reason: 'the hearth stays' };
  return { ok: true, reason: `raze the ${labelOf(building)}` };
}

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
