import type { Vec2 } from './geometry.ts';
import type { Book } from './book.ts';
import type { Rig } from './process.ts';

export const ItemType = {
  Water: 'Water',
  Dirt: 'Dirt',
  Mud: 'Mud',
  Wood: 'Wood',
  /** What a banked fire leaves. The hearth's own product, and the start of the heat ladder. */
  Embers: 'Embers',
  /**
   * Something to carry water in. Until the town has one nobody fetches for anybody and everyone
   * walks to the river for every drink, which is most of what the first age costs (`needs.ts`).
   */
  Vessel: 'Vessel',
} as const;

export type ItemType = (typeof ItemType)[keyof typeof ItemType];

export const ITEM_TYPES: readonly ItemType[] = [
  ItemType.Water,
  ItemType.Dirt,
  ItemType.Mud,
  ItemType.Wood,
  ItemType.Embers,
  ItemType.Vessel,
];

export const Biome = {
  Meadow: 'Meadow',
  Forest: 'Forest',
  Highland: 'Highland',
  Marsh: 'Marsh',
  Tundra: 'Tundra',
  Desert: 'Desert',
  Ocean: 'Ocean',
  Lake: 'Lake',
  River: 'River',
} as const;

export type Biome = (typeof Biome)[keyof typeof Biome];

export type CellId = string;
export type BuildingId = string;
export type CarrierId = string;
export type DesignId = string;
export type RecipeId = string;

/**
 * Physical properties of a patch of ground, all 0..1.
 *
 * `elevation` is the ground, not the water over it: a lake stands above sea level and a river
 * runs over land, so the sea test is the biome and never this. The field keeps these in degrees
 * and rainfall; what comes out here is the normalised form the rest of the game reads.
 */
export interface Environment {
  temperature: number;
  humidity: number;
  elevation: number;
}

export const Direction = {
  North: 'North',
  East: 'East',
  South: 'South',
  West: 'West',
} as const;

export type Direction = (typeof Direction)[keyof typeof Direction];

export const DIRECTIONS: readonly Direction[] = [
  Direction.North,
  Direction.East,
  Direction.South,
  Direction.West,
];

/** y runs downward, as it does on the map and in the blueprint. */
export const STEP: Record<Direction, { x: number; y: number }> = {
  [Direction.North]: { x: 0, y: -1 },
  [Direction.East]: { x: 1, y: 0 },
  [Direction.South]: { x: 0, y: 1 },
  [Direction.West]: { x: -1, y: 0 },
};

export const BlockKind = {
  /**
   * The ground itself, opened. Draws its item out of the parcel it stands on and hands it
   * straight to the square it faces: no stock, no hopper, nothing to fill up or run dry. It
   * draws only while a villager is working it — the ground gives nothing on its own.
   */
  Source: 'Source',
  /** The door. What carriers bring is left here, and it holds what has not been used yet. */
  Input: 'Input',
  /** The way out: what carriers collect from. */
  Output: 'Output',
  /** One recipe, worked on whatever the belts bring it. */
  Combine: 'Combine',
  /** A belt. Moves one thing, one square, the way it faces. */
  Transport: 'Transport',
  /**
   * A bin. Holds eight of whatever reaches it first and keeps them until something wants them —
   * untyped on purpose, so a row of them is a warehouse rather than eight separate decisions.
   */
  Storage: 'Storage',
  /** The settlement's fire: where the carriers live and the town is named. Not a player block. */
  Hearth: 'Hearth',
} as const;

export type BlockKind = (typeof BlockKind)[keyof typeof BlockKind];

/**
 * The kinds a design may be drawn from. The hearth is the settlement's, and a source belongs to
 * the land works: a workshop never touches the ground, it is fed through its doors.
 */
export const PLACEABLE_BLOCKS: readonly BlockKind[] = [
  BlockKind.Input,
  BlockKind.Transport,
  BlockKind.Combine,
  BlockKind.Storage,
  BlockKind.Output,
];

interface BlockAt {
  x: number;
  y: number;
  /** Which way the block hands its load on. Every block has one, so rotation always means something. */
  facing: Direction;
}

export interface SourceBlock extends BlockAt {
  kind: typeof BlockKind.Source;
  item: ItemType;
}

export interface InputBlock extends BlockAt {
  kind: typeof BlockKind.Input;
  item: ItemType;
}

export interface OutputBlock extends BlockAt {
  kind: typeof BlockKind.Output;
  /**
   * What the crate is *expected* to hold, where anyone knows in advance — a land work's crate
   * takes what its source draws, and nothing else ever reaches it. It is a label for the
   * drawing and never a rule: a pick-up bay the player lays has none, and what may be collected
   * from a crate is whatever is standing in it (`blockSpace`).
   */
  item?: ItemType;
  /**
   * How much the crate holds, when it is not the usual. Only the land works set it: a worker's
   * batch has to fit in the crate at once, and the woodcutter's ten logs are more than eight.
   */
  capacity?: number;
}

export interface CombineBlock extends BlockAt {
  kind: typeof BlockKind.Combine;
  recipeId: RecipeId;
}

export interface TransportBlock extends BlockAt {
  kind: typeof BlockKind.Transport;
}

export interface StorageBlock extends BlockAt {
  kind: typeof BlockKind.Storage;
}

export interface HearthBlock extends BlockAt {
  kind: typeof BlockKind.Hearth;
}

export type Block =
  | SourceBlock
  | InputBlock
  | OutputBlock
  | CombineBlock
  | TransportBlock
  | StorageBlock
  | HearthBlock;

/**
 * A building the player drew. The blocks are the whole of it: there is no building type behind
 * them, and two designs with the same blocks are the same machine.
 */
export interface Design {
  id: DesignId;
  label: string;
  width: number;
  height: number;
  /** Declaration order is the order the interior ticks in, so it is part of the trace. */
  blocks: Block[];
  /**
   * Somewhere to sleep. A town can be no bigger than the beds it has built — the shelter ladder
   * is how a band of three becomes a village (`needs.ts`), and it is the only thing that hires.
   */
  beds?: number;
  /** Whether those beds have a roof over them. Sleeping rough costs waking hours. */
  sheltered?: boolean;
}

export interface Buffer {
  item: ItemType;
  amount: number;
  capacity: number;
}

/** What one square of a standing building is holding right now. */
export interface BlockState {
  /** The load on the square: a belt's parcel, an input's catch, an output's stock. */
  held: Buffer | null;
  /** A combine block's ingredients, one hopper per item its recipe asks for. */
  hoppers: Map<ItemType, Buffer>;
  /** Ticks into the current craft, 0 when not working. */
  progress: number;
  /** Ticks before the square may hand anything on again — what makes a belt take time. */
  cooldown: number;
}

export const BuildingState = {
  /** Placed, and its site still being cleared: it does nothing until that is done. */
  Clearing: 'CLEARING',
  Idle: 'IDLE',
  Starved: 'STARVED',
  Working: 'WORKING',
  Blocked: 'BLOCKED',
} as const;

export type BuildingState = (typeof BuildingState)[keyof typeof BuildingState];

export interface Building {
  id: BuildingId;
  designId: DesignId;
  /**
   * The building's own copy of the blueprint it was raised from. A library design the player
   * edits afterwards does not quietly re-tool what is already standing — `retool` does that,
   * and it is a deliberate act.
   */
  design: Design;
  cellId: CellId;
  position: Vec2;
  /** One per block of the design, in the same order. */
  blocks: BlockState[];
  /** What the ground under it hands its input blocks for free. */
  yields: ItemType[];
  state: BuildingState;
  /** Everything the hearth has swallowed for good — the settlement's score. */
  delivered: Map<ItemType, number>;
  producedTotal: number;
  /**
   * The work still standing between it and use: its site has to be prepared — the trees on its
   * parcel and the ring round it felled, then the plot dug and levelled — before it does anything.
   * `felling` is how much of `needed` is the felling, which comes first. Null once it is done.
   */
  clearing: { done: number; needed: number; felling: number } | null;
  /**
   * Ticks the works is stopped for while a vessel is being installed or pulled out
   * (`fitting.ts`). Nobody has to walk over for it and the bays go on being filled — the
   * machine is simply not running. Zero when it is.
   */
  retooling: number;
  /**
   * The rig standing on this floor, if it is one: its build params and the queue of methods it
   * works down (`process.ts`). A building without one is the machine its blocks make it, and
   * ticks exactly as it always did.
   */
  rig?: Rig;
}

export const CarrierState = {
  Idle: 'IDLE',
  MovingToSource: 'MOVING_TO_SOURCE',
  PickingUp: 'PICKING_UP',
  MovingToDest: 'MOVING_TO_DEST',
  DroppingOff: 'DROPPING_OFF',
  /** Walking to a land work to work it. */
  MovingToWork: 'MOVING_TO_WORK',
  /** Inside a land work, drawing a batch out of the ground — off the map until it is done. */
  Working: 'WORKING',
  /** At a new building's site, felling what stands on it. */
  Clearing: 'CLEARING',
} as const;

export type CarrierState = (typeof CarrierState)[keyof typeof CarrierState];

/**
 * An errand. A *haul* takes one unit from a source to a destination. A *work* job is a shift at
 * a land work: the villager walks there, goes in, and draws a batch out of the ground. A *clear*
 * job is felling the site of a building just placed. For both of those, source and destination
 * are the same building, so anything that asks whether a carrier is bound for a building (razing
 * it, say) gets the right answer without knowing which kind it is.
 */
export interface Job {
  kind: 'haul' | 'work' | 'clear';
  item: ItemType;
  sourceId: BuildingId;
  destinationId: BuildingId;
}

export interface Carrier {
  id: CarrierId;
  position: Vec2;
  carryingItem: ItemType | null;
  state: CarrierState;
  homeId: BuildingId;
  job: Job | null;
  /**
   * The nodes of the ground still to step on, the next one first (`footpaths.ts`): the walk to
   * wherever it is going, found by cost when the errand was taken. Empty when standing still.
   */
  trail: string[];
  /** Ticks left of the pick-up or drop-off animation, or until the next unit of a shift. */
  handling: number;
  /** Units still to draw before a shift is done; 0 when not working. */
  left: number;
  /** Accumulated distance walked — the renderer's walk-cycle phase. */
  walked: number;
  /** The building it is standing at, or last left; walks are planned from here. */
  atId: BuildingId;
  heading: Vec2;
}

export interface Settlement {
  id: string;
  name: string;
  /** The hearth. Its parcel is the centre of the ground the settlement claims (`claims.ts`). */
  hearthId: BuildingId;
  buildings: Map<BuildingId, Building>;
  carriers: Map<CarrierId, Carrier>;
  /**
   * What the town has worked out how to do (`book.ts`). Per settlement rather than per world:
   * a second town founded later starts ignorant, and methods travel by being carried.
   */
  book: Book;
  /** Bumped by anything that changes the settlement's shape, so the renderer can cache. */
  revision: number;
}

export interface TickEvent {
  tick: number;
  kind: 'pickup' | 'dropoff' | 'produced' | 'delivered' | 'stalled' | 'cleared';
  carrierId?: CarrierId;
  buildingId?: BuildingId;
  item?: ItemType;
  detail?: string;
}

export interface TickReport {
  tick: number;
  events: TickEvent[];
}
