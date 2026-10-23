import type { Book, InstrumentId, Row, Technique } from './book.ts';
import { cloneRow, cloneTechnique, emptyBook } from './book.ts';
import { cloneDesign } from './designs.ts';
import type { Vec2 } from './geometry.ts';
import type { SavedRecipe } from './recipe.ts';
import { recipeFrom } from './recipe.ts';
import type { StationState } from './station.ts';
import { stationFrom, stationState } from './station.ts';
import { fieldFor } from './terrain/worldfield.ts';
import type {
  Building,
  BuildingState,
  Carrier,
  CarrierState,
  CellId,
  Design,
  DesignId,
  Diary,
  ItemType,
  Job,
  Needs,
  QueueLine,
  Settlement,
  Slot,
} from './types.ts';
import type { GameWorld } from './world.ts';

export const SAVE_VERSION = 14;

interface SavedSlot {
  design: Design | null;
  station: StationState | null;
  pool?: number;
}

interface SavedBuilding {
  id: string;
  cellId: CellId;
  position: Vec2;
  stock: [ItemType, number][];
  yields: ItemType[];
  state: BuildingState;
  delivered: [ItemType, number][];
  producedTotal: number;
  clearing: { done: number; needed: number; felling: number } | null;
  stage: number;
  slots: SavedSlot[];
  queue: QueueLine[];
  raising: { to: number; done: number; needed: number } | null;
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
  recipes: SavedRecipe[];
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
    library: [...world.designLibrary.values()].map((design) => cloneDesign(design)),
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
    recipes: [...settlement.book.recipes.values()].map((recipe) => recipe.save()),
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
    cellId: building.cellId,
    position: { ...building.position },
    stock: [...building.stock],
    yields: [...building.yields],
    state: building.state,
    delivered: [...building.delivered],
    producedTotal: building.producedTotal,
    clearing: building.clearing ? { ...building.clearing } : null,
    stage: building.stage,
    slots: building.slots.map(saveSlot),
    queue: building.queue.map((line) => ({ ...line })),
    raising: building.raising ? { ...building.raising } : null,
  };
}

function saveSlot(slot: Slot): SavedSlot {
  return {
    design: slot.design ? cloneDesign(slot.design) : null,
    station: slot.station ? stationState(slot.station) : null,
    ...(slot.pool ? { pool: slot.pool } : {}),
  };
}

function restoreSlot(saved: SavedSlot): Slot {
  return {
    design: saved.design ? cloneDesign(saved.design) : null,
    station: saved.station ? stationFrom(saved.station) : null,
    ...(saved.pool ? { pool: saved.pool } : {}),
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

export function restoreWorld(data: unknown, seed: number): { world: GameWorld; tick: number } | null {
  try {
    const saved = data as SavedGame;
    if (!saved || typeof saved !== 'object') return null;
    if (saved.version !== SAVE_VERSION || saved.seed !== seed) return null;

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
      designLibrary: library,
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
  for (const entry of saved.recipes) book.recipes.set(entry.id, recipeFrom(entry));
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

function restoreBuilding(saved: SavedBuilding): Building {
  return {
    id: saved.id,
    cellId: saved.cellId,
    position: { ...saved.position },
    stock: new Map(saved.stock),
    yields: [...saved.yields],
    state: saved.state,
    delivered: new Map(saved.delivered),
    producedTotal: saved.producedTotal,
    clearing: saved.clearing ? { ...saved.clearing } : null,
    stage: saved.stage,
    slots: saved.slots.map(restoreSlot),
    queue: saved.queue.map((line) => ({ ...line })),
    ...(saved.raising ? { raising: { ...saved.raising } } : {}),
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
