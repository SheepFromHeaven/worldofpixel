import {
  acceptedItems,
  demandFor,
  depositHopper,
  inputStock,
  hopperSpace,
  isStore,
  outputPressure,
  outputStock,
  storedStock,
  supplies,
  withdraw,
} from './buildings.ts';
import { pointAlongPath } from './geometry.ts';
import { otherEnd, routeBetween } from './paths.ts';
import { CarrierState } from './types.ts';
import type {
  Building,
  BuildingId,
  Carrier,
  CarrierId,
  ItemType,
  Job,
  PathId,
  Settlement,
  TickEvent,
} from './types.ts';

/**
 * World units a carrier covers in a tick. A parcel is about 3.8 across and a tick is a tenth of
 * a second at normal speed, so this is a walk of roughly a parcel and a half a second — people
 * carrying things on their backs, not errand-runners sprinting between doors.
 */
export const CARRIER_SPEED = 0.6;
export const HANDLING_TICKS = 2;
/** Ticks a carrier will wait at a full hopper before it goes looking for another taker. */
export const STALL_LIMIT = 8;

/** Two to begin with, and another for every pair of buildings after that, up to a crowd. */
export const CARRIERS_FOR = (buildings: number): number =>
  Math.max(2, Math.min(8, Math.floor(buildings / 2) + 1));

/**
 * Hire whoever the settlement is now short of. A town that grows without carriers looks broken
 * rather than busy: the buildings fill up, nothing moves, and nothing says why.
 */
export function staffSettlement(settlement: Settlement): number {
  const hearth = settlement.buildings.get(settlement.hearthId);
  if (!hearth) return 0;

  const wanted = CARRIERS_FOR(settlement.buildings.size);
  let hired = 0;
  for (let index = settlement.carriers.size; index < wanted; index += 1) {
    const carrier = createCarrier(`${settlement.id}/carrier-${index + 1}`, hearth);
    settlement.carriers.set(carrier.id, carrier);
    hired += 1;
  }
  return hired;
}

export function createCarrier(id: CarrierId, home: Building): Carrier {
  return {
    id,
    position: { ...home.position },
    pathId: null,
    progress: 0,
    carryingItem: null,
    state: CarrierState.Idle,
    homeId: home.id,
    job: null,
    route: [],
    handling: 0,
    walked: 0,
    heading: { x: 1, y: 0 },
    atId: home.id,
    direction: 1,
  };
}

/**
 * What other carriers have already spoken for. Recomputed from the carriers themselves every
 * dispatch rather than kept as a ledger: a stale reservation is the one bug in this whole layer
 * that would be invisible — the item never moves and nothing reports an error.
 */
export interface Claims {
  /** Units promised out of a building's output buffer. */
  outgoing: Map<BuildingId, number>;
  /** Units already walking toward a building's hopper, keyed `buildingId|item`. */
  incoming: Map<string, number>;
}

const incomingKey = (buildingId: BuildingId, item: ItemType): string => `${buildingId}|${item}`;

export function collectClaims(settlement: Settlement): Claims {
  const outgoing = new Map<BuildingId, number>();
  const incoming = new Map<string, number>();

  for (const carrier of settlement.carriers.values()) {
    const job = carrier.job;
    if (!job) continue;
    if (carrier.carryingItem === null) {
      outgoing.set(job.sourceId, (outgoing.get(job.sourceId) ?? 0) + 1);
    }
    const key = incomingKey(job.destinationId, job.item);
    incoming.set(key, (incoming.get(key) ?? 0) + 1);
  }

  return { outgoing, incoming };
}

/**
 * What can be taken out of a building for a given errand. A bin feeds the workshops but never
 * another store: without that rule a load would shuttle for ever between two warehouses, each
 * taking it in because nobody else wanted it.
 */
function availableSupply(
  building: Building,
  item: ItemType,
  claims: Claims,
  toStore: boolean,
): number {
  const stock = outputStock(building, item) + (toStore ? 0 : storedStock(building, item));
  return stock - (claims.outgoing.get(building.id) ?? 0);
}

function availableSpace(building: Building, item: ItemType, claims: Claims): number {
  return hopperSpace(building, item) - (claims.incoming.get(incomingKey(building.id, item)) ?? 0);
}

interface Want {
  item: ItemType;
  /** How short of a full batch this hopper is, as a fraction — lowest is fetched first. */
  fill: number;
  order: number;
}

function wantsOf(building: Building, claims: Claims): Want[] {
  const wants: Want[] = [];

  acceptedItems(building).forEach((item, order) => {
    if (availableSpace(building, item, claims) <= 0) return;
    const held =
      inputStock(building, item) +
      (claims.incoming.get(incomingKey(building.id, item)) ?? 0);
    const needed = demandFor(building, item) || 1;
    wants.push({ item, fill: held / needed, order });
  });

  return wants.sort((a, b) => a.fill - b.fill || a.order - b.order);
}

/**
 * The best job on offer, not the first one found. Scanning in order and taking the first match
 * starves whatever sits late in the list: the well always has water waiting, so the mixer at the
 * far end would never see a load of earth. Scoring instead lets a chain drain from the far end —
 *
 *   urgency  how empty the destination hopper is, measured against the batch it needs
 *   pressure how backed up the source is, so a full output block gets relieved first
 *   legs     a mild preference for the nearer of two equal suppliers
 *
 * The town store is the destination of last resort: an empty bin takes anything, so left to
 * compete it would swallow the water a mixer was waiting on. A store is only offered jobs once
 * nothing that *makes* something wants the load — a rule, rather than the thumb on the scale a
 * flat penalty was.
 *
 * Every tie breaks on insertion order, so the choice is reproducible rather than merely stable.
 */
const LEG_PENALTY = 0.1;

function bestJob(
  settlement: Settlement,
  carrier: Carrier,
  claims: Claims,
  stores: boolean,
): Job | null {
  let best: { job: Job; score: number } | null = null;

  for (const destination of settlement.buildings.values()) {
    if (isStore(destination) !== stores) continue;

    for (const want of wantsOf(destination, claims)) {
      for (const source of settlement.buildings.values()) {
        if (source.id === destination.id) continue;
        if (availableSupply(source, want.item, claims, stores) <= 0) continue;

        const toSource = routeBetween(settlement, carrier.atId, source.id);
        if (!toSource) continue;
        const toDestination = routeBetween(settlement, source.id, destination.id);
        if (!toDestination) continue;

        const urgency = Math.max(0, 1 - want.fill);
        const pressure = outputPressure(source, want.item);
        const legs = toSource.length + toDestination.length;
        const score = urgency + pressure - legs * LEG_PENALTY;

        if (!best || score > best.score) {
          best = { job: { item: want.item, sourceId: source.id, destinationId: destination.id }, score };
        }
      }
    }
  }

  return best?.job ?? null;
}

export function findJob(settlement: Settlement, carrier: Carrier, claims: Claims): Job | null {
  return bestJob(settlement, carrier, claims, false) ?? bestJob(settlement, carrier, claims, true);
}

function beginLeg(settlement: Settlement, carrier: Carrier): void {
  const legs = carrier.route;
  const next = legs[0];
  if (next === undefined) {
    carrier.pathId = null;
    return;
  }
  const path = settlement.paths.get(next);
  if (!path) {
    carrier.pathId = null;
    carrier.route = [];
    return;
  }
  carrier.pathId = path.id;
  carrier.direction = path.fromId === carrier.atId ? 1 : -1;
  carrier.progress = carrier.direction === 1 ? 0 : 1;
}

function setRoute(settlement: Settlement, carrier: Carrier, route: PathId[]): void {
  carrier.route = [...route];
  beginLeg(settlement, carrier);
}

export function assignJob(settlement: Settlement, carrier: Carrier, job: Job): boolean {
  const route = routeBetween(settlement, carrier.atId, job.sourceId);
  if (!route) return false;

  carrier.job = job;
  setRoute(settlement, carrier, route);
  carrier.state = route.length === 0 ? CarrierState.PickingUp : CarrierState.MovingToSource;
  carrier.handling = route.length === 0 ? HANDLING_TICKS : 0;
  return true;
}

function syncPosition(settlement: Settlement, carrier: Carrier): void {
  if (carrier.pathId === null) {
    const standing = settlement.buildings.get(carrier.atId);
    if (standing) carrier.position = { ...standing.position };
    return;
  }
  const path = settlement.paths.get(carrier.pathId);
  if (!path) return;
  const { position, heading } = pointAlongPath(path.points, carrier.progress);
  carrier.position = position;
  carrier.heading = carrier.direction === 1 ? heading : { x: -heading.x, y: -heading.y };
}

/** Advance along the current leg; returns true once the whole route is walked. */
function walk(settlement: Settlement, carrier: Carrier): boolean {
  if (carrier.pathId === null) return true;
  const path = settlement.paths.get(carrier.pathId);
  if (!path) return true;

  const step = CARRIER_SPEED / Math.max(1, path.length);
  carrier.progress += step * carrier.direction;
  carrier.walked += CARRIER_SPEED;

  const arrived = carrier.direction === 1 ? carrier.progress >= 1 : carrier.progress <= 0;
  if (!arrived) {
    syncPosition(settlement, carrier);
    return false;
  }

  carrier.progress = carrier.direction === 1 ? 1 : 0;
  carrier.atId = otherEnd(path, carrier.atId);
  carrier.route.shift();

  if (carrier.route.length === 0) {
    carrier.pathId = null;
    syncPosition(settlement, carrier);
    return true;
  }

  beginLeg(settlement, carrier);
  syncPosition(settlement, carrier);
  return false;
}

function otherTakerFor(settlement: Settlement, item: ItemType, exclude: BuildingId): BuildingId | null {
  for (const building of settlement.buildings.values()) {
    if (building.id === exclude) continue;
    if (hopperSpace(building, item) > 0) return building.id;
  }
  return null;
}

export function stepCarrier(settlement: Settlement, carrier: Carrier, tick: number): TickEvent[] {
  const events: TickEvent[] = [];
  const job = carrier.job;

  switch (carrier.state) {
    case CarrierState.Idle:
      syncPosition(settlement, carrier);
      break;

    case CarrierState.MovingToSource:
      if (walk(settlement, carrier)) {
        carrier.state = CarrierState.PickingUp;
        carrier.handling = HANDLING_TICKS;
      }
      break;

    case CarrierState.PickingUp: {
      carrier.handling -= 1;
      if (carrier.handling > 0 || !job) break;
      const source = settlement.buildings.get(job.sourceId);
      const taken = source ? withdraw(source, job.item, 1) : 0;
      if (taken === 0) {
        carrier.state = CarrierState.Idle;
        carrier.job = null;
        break;
      }
      carrier.carryingItem = job.item;
      events.push({ tick, kind: 'pickup', carrierId: carrier.id, buildingId: job.sourceId, item: job.item });
      const route = routeBetween(settlement, carrier.atId, job.destinationId);
      if (!route) {
        carrier.state = CarrierState.Idle;
        break;
      }
      setRoute(settlement, carrier, route);
      carrier.state = route.length === 0 ? CarrierState.DroppingOff : CarrierState.MovingToDest;
      carrier.handling = route.length === 0 ? HANDLING_TICKS : 0;
      break;
    }

    case CarrierState.MovingToDest:
      if (walk(settlement, carrier)) {
        carrier.state = CarrierState.DroppingOff;
        carrier.handling = HANDLING_TICKS;
      }
      break;

    case CarrierState.DroppingOff: {
      carrier.handling -= 1;
      if (carrier.handling > 0) break;
      const item = carrier.carryingItem;
      const destination = job ? settlement.buildings.get(job.destinationId) : undefined;
      const placed = destination && item ? depositHopper(destination, item, 1) : 0;

      if (placed > 0 && item && destination) {
        events.push({ tick, kind: 'dropoff', carrierId: carrier.id, buildingId: destination.id, item });
        carrier.carryingItem = null;
        carrier.job = null;
        carrier.state = CarrierState.Idle;
        break;
      }

      // Hopper filled up while we walked. Wait a little, then take the load somewhere it fits —
      // a carrier that stands at a full door forever strands the item it is holding.
      carrier.handling = 1;
      carrier.walked += 1;
      if (carrier.walked % STALL_LIMIT === 0 && item && job) {
        const taker = otherTakerFor(settlement, item, job.destinationId);
        if (taker) {
          const route = routeBetween(settlement, carrier.atId, taker);
          if (route) {
            carrier.job = { ...job, destinationId: taker };
            setRoute(settlement, carrier, route);
            carrier.state = route.length === 0 ? CarrierState.DroppingOff : CarrierState.MovingToDest;
            carrier.handling = route.length === 0 ? HANDLING_TICKS : 0;
            break;
          }
        }
        events.push({
          tick,
          kind: 'stalled',
          carrierId: carrier.id,
          item,
          detail: `no taker for ${item}`,
        });
      }
      break;
    }
  }

  return events;
}
