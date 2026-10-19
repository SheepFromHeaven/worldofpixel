import type { Vec2 } from './geometry.ts';

export const ItemType = {
  Water: 'Water',
  Dirt: 'Dirt',
  Mud: 'Mud',
  Wood: 'Wood',
} as const;

export type ItemType = (typeof ItemType)[keyof typeof ItemType];

export const ITEM_TYPES: readonly ItemType[] = [
  ItemType.Water,
  ItemType.Dirt,
  ItemType.Mud,
  ItemType.Wood,
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
export type PathId = string;
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
   * The ground itself, opened. Draws its item out of the parcel it stands on for ever and hands
   * it straight to the square it faces: no stock, no hopper, nothing to fill up or run dry.
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
  item: ItemType;
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
}

export interface Path {
  id: PathId;
  fromId: BuildingId;
  toId: BuildingId;
  points: Vec2[];
  length: number;
}

export const CarrierState = {
  Idle: 'IDLE',
  MovingToSource: 'MOVING_TO_SOURCE',
  PickingUp: 'PICKING_UP',
  MovingToDest: 'MOVING_TO_DEST',
  DroppingOff: 'DROPPING_OFF',
} as const;

export type CarrierState = (typeof CarrierState)[keyof typeof CarrierState];

export interface Job {
  item: ItemType;
  sourceId: BuildingId;
  destinationId: BuildingId;
}

export interface Carrier {
  id: CarrierId;
  position: Vec2;
  /** The leg being walked right now; null while idle at the hut. */
  pathId: PathId | null;
  /** 0..1 along `pathId`, measured from `route`'s direction of travel, not the path's. */
  progress: number;
  carryingItem: ItemType | null;
  state: CarrierState;
  homeId: BuildingId;
  job: Job | null;
  /** Remaining legs of the walk, current leg first. */
  route: PathId[];
  /** Ticks left of the pick-up or drop-off animation. */
  handling: number;
  /** Accumulated distance walked — the renderer's walk-cycle phase. */
  walked: number;
  /** The building it is standing at; routes are planned from here. */
  atId: BuildingId;
  /** Which way along `pathId` it walks: +1 runs from the path's `fromId` to its `toId`. */
  direction: 1 | -1;
  heading: Vec2;
}

export interface Settlement {
  id: string;
  name: string;
  /** The hearth. A settlement is wherever its buildings are; it owns no territory. */
  hearthId: BuildingId;
  buildings: Map<BuildingId, Building>;
  /** Derived from `roads` — never edited directly. See `rebuildPaths`. */
  paths: Map<PathId, Path>;
  carriers: Map<CarrierId, Carrier>;
  /** Parcels the player has laid dirt on. The only hand-authored part of the road network. */
  roads: Set<CellId>;
  /** Bumped by anything that changes the settlement's shape, so the renderer can cache. */
  revision: number;
}

export interface TickEvent {
  tick: number;
  kind: 'pickup' | 'dropoff' | 'produced' | 'delivered' | 'stalled';
  carrierId?: CarrierId;
  buildingId?: BuildingId;
  item?: ItemType;
  detail?: string;
}

export interface TickReport {
  tick: number;
  events: TickEvent[];
}
