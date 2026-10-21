import { cloneMethod, cloneRow, cloneTechnique, emptyBook } from './book.ts';
import type { Book, InstrumentId, Method, Row, Technique } from './book.ts';
import { cloneDesign } from './designs.ts';
import { cloneRig } from './process.ts';
import type { Rig } from './process.ts';
import type { Vec2 } from './geometry.ts';
import type {
  Building,
  BuildingState,
  Carrier,
  CarrierState,
  Diary,
  Needs,
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

/**
 * Bumped whenever the shape below changes; a save from another version is not read.
 *
 * The library and the book are both written down, so a world saved before Age II carries a
 * library with no cord walk in it and a fire that still seals a basket out of mud — a town
 * that could never be brought into the age. That is a change to what a save *says* rather than
 * to the fields it says it in, and it is refused for the same reason.
 */
export const SAVE_VERSION = 8;

interface SavedBuilding {
  id: string;
  designId: DesignId;
  design: Design;
  cellId: CellId;
  position: Vec2;
  /**
   * What is standing in it. A `Map` does not serialise, and the order of these pairs is the
   * order the Map is rebuilt in — which is in the trace hash, so it is part of the save.
   */
  stock: [ItemType, number][];
  yields: ItemType[];
  state: BuildingState;
  delivered: [ItemType, number][];
  producedTotal: number;
  clearing: { done: number; needed: number; felling: number } | null;
  rig: Rig | null;
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
  needs: Needs;
  away: string | null;
}

interface SavedSettlement {
  id: string;
  name: string;
  hearthId: string;
  buildings: SavedBuilding[];
  carriers: SavedCarrier[];
  /** The book is knowledge and so is state: nothing else in the world derives it. */
  methods: Method[];
  /** The trials, in the order they were run — which is the order the book reads them back in. */
  rows: Row[];
  instruments: InstrumentId[];
  named: Technique[];
  revision: number;
  diary: Diary | null;
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
    methods: [...settlement.book.methods.values()].map((method) => cloneMethod(method)),
    rows: settlement.book.rows.map(cloneRow),
    instruments: [...settlement.book.instruments],
    named: settlement.book.named.map(cloneTechnique),
    revision: settlement.revision,
    diary: settlement.diary ? cloneDiary(settlement.diary) : null,
  };
}

function saveBuilding(building: Building): SavedBuilding {
  return {
    id: building.id,
    designId: building.designId,
    design: cloneDesign(building.design),
    cellId: building.cellId,
    position: { ...building.position },
    stock: [...building.stock],
    yields: [...building.yields],
    state: building.state,
    delivered: [...building.delivered],
    producedTotal: building.producedTotal,
    clearing: building.clearing ? { ...building.clearing } : null,
    rig: building.rig ? cloneRig(building.rig) : null,
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
    needs: { ...carrier.needs },
    away: carrier.away,
  };
}

function cloneDiary(diary: Diary): Diary {
  return { since: diary.since, today: { ...diary.today }, last: diary.last ? { ...diary.last } : null };
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

  const book: Book = emptyBook();
  for (const method of saved.methods) book.methods.set(method.id, cloneMethod(method));
  book.rows = saved.rows.map(cloneRow);
  book.instruments = [...saved.instruments];
  book.named = saved.named.map(cloneTechnique);

  return {
    id: saved.id,
    name: saved.name,
    hearthId: saved.hearthId,
    buildings,
    carriers,
    book,
    revision: saved.revision,
    ...(saved.diary ? { diary: cloneDiary(saved.diary) } : {}),
  };
}

/**
 * A building comes back from its own blueprint, filled from the save: what it *is* always
 * agrees with the design standing on the parcel, and only what is lying in it comes out of the
 * file. The stock is rebuilt in saved order, because that order is in the trace hash.
 */
function restoreBuilding(saved: SavedBuilding): Building {
  return {
    id: saved.id,
    designId: saved.designId,
    design: cloneDesign(saved.design),
    cellId: saved.cellId,
    position: { ...saved.position },
    stock: new Map(saved.stock),
    yields: [...saved.yields],
    state: saved.state,
    delivered: new Map(saved.delivered),
    producedTotal: saved.producedTotal,
    clearing: saved.clearing ? { ...saved.clearing } : null,
    ...(saved.rig ? { rig: cloneRig(saved.rig) } : {}),
  };
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
    needs: { ...saved.needs },
    away: saved.away,
  };
}
