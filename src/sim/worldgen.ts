import { growTo, placeIn } from './area.ts';
import { startingBook } from './book.ts';
import { staffSettlement } from './carriers.ts';
import { crowdedBy, townIdFor } from './claims.ts';
import { addArea } from './construction.ts';
import { HEARTH_DESIGN, startingLibrary } from './designs.ts';
import { landWorkById } from './landWorks.ts';
import { nameFrom } from './markers.ts';
import { hashString } from './rng.ts';
import { parcelOf } from './terrain/parcels.ts';
import { fieldFor, waterCheck } from './terrain/worldfield.ts';
import type { CellId, Settlement } from './types.ts';
import type { GameWorld } from './world.ts';

export interface FoundingCheck {
  ok: boolean;
  reason: string;
}

export function buildingOn(world: GameWorld, parcelId: CellId): boolean {
  for (const settlement of world.settlements.values()) {
    for (const building of settlement.buildings.values()) {
      if (building.cellId === parcelId) return true;
    }
  }
  return false;
}

export function canFound(world: GameWorld, parcelId: CellId): FoundingCheck {
  const parcel = parcelOf(world.seed, parcelId);
  const standing = waterCheck(parcel.biome);
  if (standing) return { ok: false, reason: standing };
  if (buildingOn(world, parcelId)) return { ok: false, reason: 'something stands here' };
  const crowded = crowdedBy(world, parcelId);
  if (crowded) return { ok: false, reason: `too near ${crowded.name} — its claim would be cut into` };
  return { ok: true, reason: 'found a settlement here' };
}

export function foundSettlement(world: GameWorld, parcelId: CellId): Settlement {
  const check = canFound(world, parcelId);
  if (!check.ok) throw new Error(`cannot found a settlement at ${parcelId}: ${check.reason}`);

  const hearthParcel = parcelOf(world.seed, parcelId);
  const seed = hashString(`town:${parcelId}:${world.seed}`);

  const settlement: Settlement = {
    id: townIdFor(parcelId),
    name: nameFrom(seed),
    hearthId: '',
    buildings: new Map(),
    carriers: new Map(),
    book: startingBook(),
    revision: 0,
  };

  const home = addArea(world, settlement, hearthParcel);
  growTo(home, 1);
  placeIn(home, 0, HEARTH_DESIGN);
  const camp = landWorkById('forage-camp');
  if (camp) placeIn(home, 1, camp.design);
  settlement.hearthId = home.id;

  staffSettlement(settlement);

  world.settlements.set(settlement.id, settlement);
  if (!world.homeSettlementId) world.homeSettlementId = settlement.id;
  return settlement;
}

export function generateWorld(seed: number): GameWorld {
  fieldFor(seed);

  return {
    seed,
    settlements: new Map(),
    homeSettlementId: null,
    designLibrary: startingLibrary(),
    wear: new Map(),
  };
}
