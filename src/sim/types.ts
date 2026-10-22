import type { Book } from './book.ts';
import type { Vec2 } from './geometry.ts';
import type { RecipeId } from './recipe.ts';
import type { Rig, RigSpecId } from './rig.ts';

export const ItemType = {
  Water: 'Water',
  Dirt: 'Dirt',
  Mud: 'Mud',
  Deadwood: 'Deadwood',
  Wood: 'Wood',
  Embers: 'Embers',
  Vessel: 'Vessel',
  Clay: 'Clay',
  Pot: 'Pot',
  Charcoal: 'Charcoal',
  Brands: 'Brands',
  Fibre: 'Fibre',
  Cord: 'Cord',
  Basket: 'Basket',
  Daub: 'Daub',
  Stone: 'Stone',
  Brick: 'Brick',
  Mortar: 'Mortar',
  Berries: 'Berries',
} as const;

export type ItemType = (typeof ItemType)[keyof typeof ItemType];

export const ITEM_TYPES: readonly ItemType[] = [
  ItemType.Water,
  ItemType.Dirt,
  ItemType.Mud,
  ItemType.Deadwood,
  ItemType.Wood,
  ItemType.Embers,
  ItemType.Vessel,
  ItemType.Clay,
  ItemType.Pot,
  ItemType.Charcoal,
  ItemType.Brands,
  ItemType.Fibre,
  ItemType.Cord,
  ItemType.Basket,
  ItemType.Daub,
  ItemType.Berries,
  ItemType.Stone,
  ItemType.Brick,
  ItemType.Mortar,
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

export interface Environment {
  temperature: number;
  humidity: number;
  elevation: number;
}

export interface Design {
  id: DesignId;
  label: string;
  capacity: number;
  store?: boolean;
  beds?: number;
  sheltered?: boolean;
  rig?: RigSpecId;
  recipes?: RecipeId[];
  needsSun?: true;
}

export const BuildingState = {
  Clearing: 'CLEARING',
  Idle: 'IDLE',
  Starved: 'STARVED',
  Working: 'WORKING',
  Blocked: 'BLOCKED',
} as const;

export type BuildingState = (typeof BuildingState)[keyof typeof BuildingState];

export interface Slot {
  design: Design | null;
  rig: Rig | null;
  pool?: number;
}

export interface QueueLine {
  recipeId: RecipeId;
  slot: number;
}

export interface Building {
  id: BuildingId;
  cellId: CellId;
  position: Vec2;
  stock: Map<ItemType, number>;
  yields: ItemType[];
  state: BuildingState;
  delivered: Map<ItemType, number>;
  producedTotal: number;
  clearing: { done: number; needed: number; felling: number } | null;
  stage: number;
  slots: Slot[];
  queue: QueueLine[];
  raising?: { to: number; done: number; needed: number };
}

export const CarrierState = {
  Idle: 'IDLE',
  MovingToSource: 'MOVING_TO_SOURCE',
  PickingUp: 'PICKING_UP',
  MovingToDest: 'MOVING_TO_DEST',
  DroppingOff: 'DROPPING_OFF',
  MovingToWork: 'MOVING_TO_WORK',
  Working: 'WORKING',
  Clearing: 'CLEARING',
  MovingToNeed: 'MOVING_TO_NEED',
  SeeingToNeed: 'SEEING_TO_NEED',
} as const;

export type CarrierState = (typeof CarrierState)[keyof typeof CarrierState];

export interface Job {
  kind: 'haul' | 'work' | 'clear' | 'tend' | NeedKind;
  item: ItemType;
  sourceId: BuildingId;
  destinationId: BuildingId;
  slot?: number;
  spot?: string;
}

export type NeedKind = 'drink' | 'eat' | 'sleep';

export interface Needs {
  thirst: number;
  hunger: number;
  rest: number;
}

export type Activity = 'rest' | 'water' | 'food' | 'work' | 'idle';

export interface Diary {
  since: number;
  today: Record<Activity, number>;
  last: Record<Activity, number> | null;
}

export interface Carrier {
  id: CarrierId;
  position: Vec2;
  carryingItem: ItemType | null;
  state: CarrierState;
  homeId: BuildingId;
  job: Job | null;
  trail: string[];
  handling: number;
  left: number;
  walked: number;
  atId: BuildingId;
  heading: Vec2;
  needs: Needs;
  away: string | null;
}

export interface Settlement {
  id: string;
  name: string;
  hearthId: BuildingId;
  buildings: Map<BuildingId, Building>;
  carriers: Map<CarrierId, Carrier>;
  book: Book;
  revision: number;
  diary?: Diary;
}

export interface TickEvent {
  tick: number;
  kind: 'pickup' | 'dropoff' | 'produced' | 'delivered' | 'stalled' | 'cleared' | 'tended' | 'raised';
  carrierId?: CarrierId;
  buildingId?: BuildingId;
  item?: ItemType;
  detail?: string;
}

export interface TickReport {
  tick: number;
  events: TickEvent[];
}
