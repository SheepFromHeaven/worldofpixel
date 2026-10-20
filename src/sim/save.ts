import { createBlockState } from './blocks.ts';
import { cloneDesign } from './designs.ts';
import type { Vec2 } from './geometry.ts';
import type {
  BlockState,
  Buffer,
  Building,
  BuildingState,
  Carrier,
  CarrierState,
  CellId,
  Design,
  DesignId,
  ItemType,
  Job,
  Settlement,
} from './types.ts';
import type { GameWorld } from './world.ts';
import { fieldFor } from './worldfield.ts';

/**
 * Writing a world down and reading it back.
 *
 * What is saved is exactly `GameWorld` and the tick count, because that is already the whole of
 * the state: the terrain, the lattice, the claims, the trees and the paths' *shape* are all
 * functions of the seed and of what stands on the ground, so there is nothing else to keep. The
 * one thing that is state and does not look like it is the wear — it is in the trace hash, so a
 * world restored without it is a different world.
 *
 * The format is plain JSON: every `Map` becomes a list of pairs, and nothing is a class. Where
 * `sim` keeps something, `ui/storage.ts` decides.
 */

/** Bumped whenever the shape below changes; a save from another version is not read. */
export const SAVE_VERSION = 2;

interface SavedBlockState {
  held: Buffer | null;
  /** Amounts only: which hoppers a square has is the recipe's business, and it is rebuilt. */
  hoppers: [ItemType, number][];
  progress: number;
  cooldown: number;
}

interface SavedBuilding {
  id: string;
  designId: DesignId;
  design: Design;
  cellId: CellId;
  position: Vec2;
  blocks: SavedBlockState[];
  yields: ItemType[];
  state: BuildingState;
  delivered: [ItemType, number][];
  producedTotal: number;
  clearing: { done: number; needed: number; felling: number } | null;
  retooling: number;
}

interface SavedCarrier {
  id: string;
  position: Vec2;
  carryingItem: ItemType | null;
  state: CarrierState;
  homeId: string;
  job: Job | null;
  trail: string[];
  handling: number;
  left: number;
  walked: number;
  atId: string;
  heading: Vec2;
}

interface SavedSettlement {
  id: string;
  name: string;
  hearthId: string;
  buildings: SavedBuilding[];
  carriers: SavedCarrier[];
  revision: number;
}

export interface SavedGame {
  version: number;
  seed: number;
  tick: number;
  homeSettlementId: string | null;
  library: Design[];
  settlements: SavedSettlement[];
  wear: [string, number][];
}

export function saveWorld(world: GameWorld, tick: number): SavedGame {
  return {
    version: SAVE_VERSION,
    seed: world.seed,
    tick,
    homeSettlementId: world.homeSettlementId,
    library: [...world.library.values()].map((design) => cloneDesign(design)),
    settlements: [...world.settlements.values()].map(saveSettlement),
    wear: [...world.wear],
  };
}

function saveSettlement(settlement: Settlement): SavedSettlement {
  return {
    id: settlement.id,
    name: settlement.name,
    hearthId: settlement.hearthId,
    buildings: [...settlement.buildings.values()].map(saveBuilding),
    carriers: [...settlement.carriers.values()].map(saveCarrier),
    revision: settlement.revision,
  };
}

function saveBuilding(building: Building): SavedBuilding {
  return {
    id: building.id,
    designId: building.designId,
    design: cloneDesign(building.design),
    cellId: building.cellId,
    position: { ...building.position },
    blocks: building.blocks.map((state) => ({
      held: state.held ? { ...state.held } : null,
      hoppers: [...state.hoppers.values()].map((hopper): [ItemType, number] => [
        hopper.item,
        hopper.amount,
      ]),
      progress: state.progress,
      cooldown: state.cooldown,
    })),
    yields: [...building.yields],
    state: building.state,
    delivered: [...building.delivered],
    producedTotal: building.producedTotal,
    clearing: building.clearing ? { ...building.clearing } : null,
    retooling: building.retooling,
  };
}

function saveCarrier(carrier: Carrier): SavedCarrier {
  return {
    id: carrier.id,
    position: { ...carrier.position },
    carryingItem: carrier.carryingItem,
    state: carrier.state,
    homeId: carrier.homeId,
    job: carrier.job ? { ...carrier.job } : null,
    trail: [...carrier.trail],
    handling: carrier.handling,
    left: carrier.left,
    walked: carrier.walked,
    atId: carrier.atId,
    heading: { ...carrier.heading },
  };
}

/**
 * Read a world back, or give up and say so.
 *
 * Giving up is the whole of the error handling: a save is this module's own writing, so the only
 * failures worth planning for are a version that has moved on and a file somebody has edited by
 * hand. Either way the answer is null and the caller rolls the world from its seed instead —
 * which is also why the restore below reads the saved shape directly rather than validating
 * every field: anything that does slip through throws in here and is caught.
 */
export function restoreWorld(data: unknown, seed: number): { world: GameWorld; tick: number } | null {
  try {
    const saved = data as SavedGame;
    if (!saved || typeof saved !== 'object') return null;
    if (saved.version !== SAVE_VERSION || saved.seed !== seed) return null;

    // As in `generateWorld`: the field is built here rather than inside the first question the
    // renderer asks of it.
    fieldFor(seed);

    const library = new Map<DesignId, Design>();
    for (const design of saved.library) library.set(design.id, cloneDesign(design));

    const settlements = new Map<string, Settlement>();
    for (const entry of saved.settlements) {
      const settlement = restoreSettlement(entry);
      settlements.set(settlement.id, settlement);
    }

    const world: GameWorld = {
      seed,
      settlements,
      homeSettlementId: saved.homeSettlementId ?? null,
      library,
      wear: new Map(saved.wear),
    };

    return { world, tick: saved.tick };
  } catch {
    return null;
  }
}

function restoreSettlement(saved: SavedSettlement): Settlement {
  const buildings = new Map<string, Building>();
  for (const entry of saved.buildings) buildings.set(entry.id, restoreBuilding(entry));
  if (!buildings.has(saved.hearthId)) throw new Error(`${saved.id} has no hearth`);

  const carriers = new Map<string, Carrier>();
  for (const entry of saved.carriers) carriers.set(entry.id, restoreCarrier(entry));

  return {
    id: saved.id,
    name: saved.name,
    hearthId: saved.hearthId,
    buildings,
    carriers,
    revision: saved.revision,
  };
}

function restoreBuilding(saved: SavedBuilding): Building {
  const design = cloneDesign(saved.design);

  return {
    id: saved.id,
    designId: saved.designId,
    design,
    cellId: saved.cellId,
    position: { ...saved.position },
    blocks: restoreBlocks(design, saved.blocks),
    yields: [...saved.yields],
    state: saved.state,
    delivered: new Map(saved.delivered),
    producedTotal: saved.producedTotal,
    clearing: saved.clearing ? { ...saved.clearing } : null,
    retooling: saved.retooling ?? 0,
  };
}

/**
 * Every square is built from the design first and then filled, so what a square *is* always
 * agrees with the blueprint standing on the parcel; only what is lying on it comes out of the
 * save.
 */
function restoreBlocks(design: Design, saved: SavedBlockState[]): BlockState[] {
  return design.blocks.map((block, index) => {
    const state = createBlockState(block);
    const was = saved[index];
    if (!was) return state;

    state.held = was.held ? { ...was.held } : null;
    for (const [item, amount] of was.hoppers) {
      const hopper = state.hoppers.get(item);
      if (hopper) hopper.amount = amount;
    }
    state.progress = was.progress;
    state.cooldown = was.cooldown;
    return state;
  });
}

function restoreCarrier(saved: SavedCarrier): Carrier {
  return {
    id: saved.id,
    position: { ...saved.position },
    carryingItem: saved.carryingItem,
    state: saved.state,
    homeId: saved.homeId,
    job: saved.job ? { ...saved.job } : null,
    trail: [...saved.trail],
    handling: saved.handling,
    left: saved.left,
    walked: saved.walked,
    atId: saved.atId,
    heading: { ...saved.heading },
  };
}
