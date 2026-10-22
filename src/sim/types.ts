import type { Vec2 } from './geometry.ts';
import type { Book } from './book.ts';
import type { MethodId } from './book.ts';
import type { Rig, RigSpecId } from './process.ts';

export const ItemType = {
  Water: 'Water',
  Dirt: 'Dirt',
  Mud: 'Mud',
  /**
   * Fallen wood, gathered rather than felled. The first rung of the chapter's fuel ladder —
   * deadwood, then cut wood, then charcoal — and the only one a town has before it owns an axe.
   */
  Deadwood: 'Deadwood',
  /** Cut wood: a felled log. Nobody has one until the axe is ground and hafted (Age IV). */
  Wood: 'Wood',
  /** What a banked fire leaves. The hearth's own product, and the start of the heat ladder. */
  Embers: 'Embers',
  /**
   * Something to carry water in. Until the town has one nobody fetches for anybody and everyone
   * walks to the river for every drink, which is most of what the first age costs (`needs.ts`).
   */
  Vessel: 'Vessel',
  /** Dug clay, worked and ready to form. What the pit firing turns into ware. */
  Clay: 'Clay',
  /** Fired ware. A hard pot carries a day's water, which is how a firing buys back hours. */
  Pot: 'Pot',
  /** Properly charred wood: twice the energy of wood, and nearly twice the air to burn it. */
  Charcoal: 'Charcoal',
  /** Half-burnt wood, which is what a clamp gives when its vents are kept shut. */
  Brands: 'Brands',
  /** Plant stalk retted and combed. Nothing on its own; everything that is twisted or woven. */
  Fibre: 'Fibre',
  /** Fibre twisted into two plies. What binds a withy, a stake and later an axe head. */
  Cord: 'Cord',
  /** Woven withies, open and dry. A basket carries grain; it does not carry water. */
  Basket: 'Basket',
  /** Mud with chopped fibre in it: it shrinks less, so it cracks less. The first mix. */
  Daub: 'Daub',
  /** Stones turned up gathering, which every area is walled with. */
  Stone: 'Stone',
  /** Fired brick. Nothing in the chapter makes it yet; a stone works is built of it. */
  Brick: 'Brick',
  /** Lime mortar, which a stone works is laid in. Nothing makes it yet. */
  Mortar: 'Mortar',
  /** What a forage camp turns up beside its deadwood, now and then. The first food that keeps. */
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

/**
 * A building the chapter hands over.
 *
 * There is no floor plan. A building was a grid of squares the player laid out — doors, chutes,
 * bays, bins — and the parameter layer replaced all of it: what a building is *for* is a method
 * in the book run on a rig, and where its goods sit is nobody's decision. So a design is what it
 * is, what it can run and how much it can hold, and the stock inside it is a list rather than a
 * map of the floor. What is in a building is shown on its slab, which is where a player would
 * look anyway.
 */
export interface Design {
  id: DesignId;
  label: string;
  /** How much of *each* item it can hold. Every line on its shelf has the same ceiling. */
  capacity: number;
  /**
   * A place anything may be left. The hearth is the town's, and a store is the destination of
   * last resort — what nobody else wanted ends up there rather than standing in the open.
   */
  store?: boolean;
  /**
   * Somewhere to sleep. A town can be no bigger than the beds it has built — the shelter ladder
   * is how a band of three becomes a village (`needs.ts`), and it is the only thing that hires.
   */
  beds?: number;
  /** Whether those beds have a roof over them. Sleeping rough costs waking hours. */
  sheltered?: boolean;
  /**
   * The rig this design raises, if it raises one (`process.ts`). A rig is capital: the build
   * params are fixed in its masonry when it goes up, and the only way to change them is to
   * tear it down and build it differently.
   */
  rig?: RigSpecId;
  /**
   * What that rig opens with, in scan order.
   *
   * "Nothing is ever blocked on tuning. Every rig opens with a working default method, so a
   * player who never runs a trial still gets a functioning town — just a wasteful one." A rig
   * raised with an empty queue is not a mediocre default, it is the failing one: it stands
   * there doing nothing and refusing nothing, with no words on it to say why.
   */
  methods?: MethodId[];
  /** Dries in the sun, so it refuses to stand under a roof (`area.ts`). */
  needsSun?: true;
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

/**
 * One place in a work area where a thing can stand (`area.ts`): a land work, if the parcel yields
 * what it draws and no other land work stands here, or any station the book knows. Empty is null.
 */
export interface Slot {
  design: Design | null;
  /** The station's own masonry and the batch it is part-way through, when it is a rig. */
  rig: Rig | null;
  /** Which recipe a land work with more than one is set to. Omitted for the first. */
  recipe?: number;
}

/** One line of an area's production list: a method, bound to the station that provides it. */
export interface QueueLine {
  methodId: MethodId;
  slot: number;
}

/**
 * A work area: one parcel, cleared and worked, with a few slots in it (`area.ts`). Everything
 * standing in it shares one shelf and one door, and hands on to everything else for nothing.
 * Still called a building in the code, since it is the thing that stands on a parcel.
 */
export interface Building {
  id: BuildingId;
  cellId: CellId;
  position: Vec2;
  /**
   * The area's shelf, by item, shared by everything standing in it. Insertion order is part of
   * the trace, so a depleted line is deleted rather than left at zero — two towns that reached
   * the same stock by different routes have to hash the same.
   */
  stock: Map<ItemType, number>;
  /** What the ground under it gives. */
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
  /** How far it has been built around: an index into `STAGES`, which sets the slot count. */
  stage: number;
  slots: Slot[];
  /** What is made here, in order, each line bound to the station that makes it. */
  queue: QueueLine[];
  /**
   * The next stage being built round it, once ordered: what it costs, delivered to the shelf
   * first, and then the labour. Absent when nothing is being built.
   */
  raising?: { to: number; done: number; needed: number };
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
  /** Walking off to drink, eat or sleep. */
  MovingToNeed: 'MOVING_TO_NEED',
  /** Drinking, eating or asleep; off the map when it is a bed under a roof. */
  SeeingToNeed: 'SEEING_TO_NEED',
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
  /**
   * `tend` is a watch at a rig rather than a batch drawn out of the ground: the engine works
   * the rig while somebody is inside it, and they come out when its queue has nothing left.
   */
  kind: 'haul' | 'work' | 'clear' | 'tend' | NeedKind;
  item: ItemType;
  sourceId: BuildingId;
  destinationId: BuildingId;
  /** For a watch at a station: which slot of the area it stands in. */
  slot?: number;
  /**
   * For a need seen to out on open ground (a drink at the bank, berries picked by hand): the
   * node it is walked to. Absent when the need is met at a building.
   */
  spot?: string;
}

/** The three things that come out of the same day as work. */
export type NeedKind = 'drink' | 'eat' | 'sleep';

/** How full each need is, 1 sated and 0 empty. They only ever run down on their own. */
export interface Needs {
  thirst: number;
  hunger: number;
  rest: number;
}

/** Where the town's ticks went, by villager, over a day. */
export type Activity = 'rest' | 'water' | 'food' | 'work' | 'idle';

export interface Diary {
  since: number;
  today: Record<Activity, number>;
  /** The last whole day, once there has been one. */
  last: Record<Activity, number> | null;
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
  needs: Needs;
  /** The node it is standing on when that is open ground rather than a building. */
  away: string | null;
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
