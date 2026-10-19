import { polygonCentroid, totalPathLength } from './geometry.ts';
import { parcelOf } from './parcels.ts';
import type { Vec2 } from './geometry.ts';
import { CarrierState } from './types.ts';
import { isWater } from './worldfield.ts';
import type { Building, BuildingId, CellId, Path, Settlement } from './types.ts';
import type { GameWorld } from './world.ts';

function buildingByParcel(settlement: Settlement): Map<CellId, Building> {
  const index = new Map<CellId, Building>();
  for (const building of settlement.buildings.values()) index.set(building.cellId, building);
  return index;
}

export function canPaveRoad(world: GameWorld, settlement: Settlement, cellId: CellId): boolean {
  // Dirt is not laid in water. A river narrower than the gap between two sites runs *between*
  // parcels rather than over one, so a road still crosses it — the ford is the parcel that the
  // water misses, and finding it is the player's problem.
  if (isWater(parcelOf(world.seed, cellId).biome)) return false;
  return !buildingByParcel(settlement).has(cellId);
}

export function paveRoad(world: GameWorld, settlement: Settlement, cellId: CellId): boolean {
  if (settlement.roads.has(cellId) || !canPaveRoad(world, settlement, cellId)) return false;
  settlement.roads.add(cellId);
  rebuildPaths(world, settlement);
  return true;
}

export function clearRoad(world: GameWorld, settlement: Settlement, cellId: CellId): boolean {
  if (!settlement.roads.delete(cellId)) return false;
  rebuildPaths(world, settlement);
  return true;
}

const pathIdFor = (a: BuildingId, b: BuildingId): string => (a < b ? `${a}~${b}` : `${b}~${a}`);

/**
 * Walk the dirt outward from one building until another is reached, recording the parcels crossed.
 * Building parcels are terminals rather than corridor: a route that ran *through* the mill to get
 * to the bakery would make the two look directly linked, and carriers would be routed through a
 * building they have no business entering.
 */
function tracksFrom(
  world: GameWorld,
  settlement: Settlement,
  start: Building,
  occupied: Map<CellId, Building>,
): { to: Building; tiles: CellId[] }[] {
  const found: { to: Building; tiles: CellId[] }[] = [];
  const cameFrom = new Map<CellId, CellId>();
  const seen = new Set<CellId>([start.cellId]);
  const queue: CellId[] = [start.cellId];

  const chainTo = (cellId: CellId): CellId[] => {
    const tiles: CellId[] = [];
    let current: CellId | undefined = cameFrom.get(cellId);
    while (current !== undefined && current !== start.cellId) {
      tiles.unshift(current);
      current = cameFrom.get(current);
    }
    return tiles;
  };

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    for (const neighborId of parcelOf(world.seed, currentId).neighbors) {
      if (seen.has(neighborId)) continue;
      const building = occupied.get(neighborId);

      if (building) {
        seen.add(neighborId);
        cameFrom.set(neighborId, currentId);
        if (building.id !== start.id) found.push({ to: building, tiles: chainTo(neighborId) });
        continue;
      }

      if (!settlement.roads.has(neighborId)) continue;
      seen.add(neighborId);
      cameFrom.set(neighborId, currentId);
      queue.push(neighborId);
    }
  }

  return found;
}

/**
 * The walk between two buildings: their own positions and the centre of every parcel of dirt in
 * between, with nothing smoothed. The renderer draws the road network from the same centres, so
 * leaving these exact means a carrier walks down the middle of the line on screen; smoothing
 * pulled the walk off the road at every corner.
 */
function trackPoints(world: GameWorld, from: Building, tiles: CellId[], to: Building): Vec2[] {
  const middle = tiles.map((cellId) => polygonCentroid(parcelOf(world.seed, cellId).vertices));
  return [from.position, ...middle, to.position];
}

/**
 * Rebuild the whole path network from the dirt on the ground. Paths are derived, never authored:
 * the player paints parcels, and what the carriers can walk follows from that one source. Keeping
 * a hand-edited path list beside the roads would let the two disagree, and the disagreement would
 * only show up as a carrier refusing to move for no visible reason.
 */
export function rebuildPaths(world: GameWorld, settlement: Settlement): void {
  settlement.revision += 1;
  const occupied = buildingByParcel(settlement);
  const paths = new Map<string, Path>();

  for (const building of settlement.buildings.values()) {
    for (const track of tracksFrom(world, settlement, building, occupied)) {
      const id = pathIdFor(building.id, track.to.id);
      if (paths.has(id)) continue;
      const points = trackPoints(world, building, track.tiles, track.to);
      paths.set(id, {
        id,
        fromId: building.id,
        toId: track.to.id,
        points,
        length: totalPathLength(points),
      });
    }
  }

  settlement.paths = paths;
  releaseStrandedCarriers(settlement);
}

/** A carrier walking a path that no longer exists is sent home rather than left mid-air. */
function releaseStrandedCarriers(settlement: Settlement): void {
  for (const carrier of settlement.carriers.values()) {
    const legMissing = carrier.pathId !== null && !settlement.paths.has(carrier.pathId);
    const routeMissing = carrier.route.some((pathId) => !settlement.paths.has(pathId));
    const placeMissing = !settlement.buildings.has(carrier.atId);
    if (!legMissing && !routeMissing && !placeMissing) continue;

    carrier.job = null;
    carrier.carryingItem = null;
    carrier.route = [];
    carrier.pathId = null;
    carrier.state = CarrierState.Idle;
    if (placeMissing) carrier.atId = carrier.homeId;
    const standing = settlement.buildings.get(carrier.atId);
    if (standing) carrier.position = { ...standing.position };
  }
}

/**
 * Pave the shortest run of parcels between two buildings, ignoring what is already dirt. Used to
 * lay the settlement's first track at founding, and by the levels; the player does this by hand.
 */
export function layTrack(
  world: GameWorld,
  settlement: Settlement,
  fromId: BuildingId,
  toId: BuildingId,
): boolean {
  const from = settlement.buildings.get(fromId);
  const to = settlement.buildings.get(toId);
  if (!from || !to) return false;

  const occupied = buildingByParcel(settlement);
  const cameFrom = new Map<CellId, CellId>();
  const seen = new Set<CellId>([from.cellId]);
  const queue: CellId[] = [from.cellId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (currentId === to.cellId) {
      let step = cameFrom.get(currentId);
      while (step !== undefined && step !== from.cellId) {
        settlement.roads.add(step);
        step = cameFrom.get(step);
      }
      rebuildPaths(world, settlement);
      return true;
    }

    for (const neighborId of parcelOf(world.seed, currentId).neighbors) {
      if (seen.has(neighborId)) continue;
      const blocked = occupied.has(neighborId) && neighborId !== to.cellId;
      if (blocked) continue;
      if (isWater(parcelOf(world.seed, neighborId).biome)) continue;
      seen.add(neighborId);
      cameFrom.set(neighborId, currentId);
      queue.push(neighborId);
    }
  }

  return false;
}
