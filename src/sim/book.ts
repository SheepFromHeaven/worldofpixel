import type { FuelId } from './models/heat.ts';
import { ItemType } from './types.ts';
import type { ItemType as Item } from './types.ts';

/**
 * The town's book: what it has worked out how to do.
 *
 * A method is knowledge, not capital. It is a recipe with its settings written down — what fuel,
 * how fast, how much air, how long — and it is portable: stamp it onto any rig whose envelope
 * can take it. The rig is the thing on the floor; the book is the thing the game is about.
 *
 * Keeping the two apart is what lets one kiln run lime today and brick tomorrow, and it is why
 * a rig that cannot reach white heat refuses the lime method in plain words rather than quietly
 * making bad lime.
 *
 * The book is the settlement's, not the world's: a second town founded later starts ignorant,
 * which is a real cost and a real story. Methods travel by being carried, not by existing.
 */

export type MethodId = string;

/**
 * What kind of rig a method may be stamped onto. A method is useless on the wrong floor.
 *
 * `fire` is a fire in a chamber: air is pulled through it and the knobs set how hard. `char` is
 * a pile cooking itself — the heat that drives the charring comes from burning part of the
 * wood, so its one knob sets the temperature and the temperature sets both how much charcoal is
 * left and how good it is, in opposite directions. They are two models, so they are two
 * processes, and a method written for one cannot be stamped onto the other.
 */
export type ProcessId = 'fire' | 'char';

/**
 * How hard the fire is driven, as one of a handful of settings you can tell apart by eye.
 *
 * Ordinal on purpose, and this is the rule the whole parameter layer turns on: nobody can set a
 * damper to 62% before anybody can measure anything. What they can do is bank the fire low,
 * middling or high, run it, and see what comes out. The knob gets finer only when an instrument
 * arrives that can read it finer.
 */
export const CHARGE_STEPS = [
  { name: 'banked', rate: 0.5 },
  { name: 'steady', rate: 1.0 },
  { name: 'roaring', rate: 1.6 },
] as const;

export const CHARGE_LOW = 0;
export const CHARGE_STEADY = 1;
export const CHARGE_HIGH = 2;

export interface RunSettings {
  /** Which banking, as an index into `CHARGE_STEPS`. The hearth's one knob. */
  charge: number;
  damper?: number;
  fuel?: FuelId;
}

/**
 * A stop condition, which every queue entry needs or the first one starves everything below it
 * for ever. A stock target is the honest form — make this until we have N — and in the hand it
 * is a scratch on the shelf saying fill to here.
 */
export interface StopWhen {
  item: Item;
  target: number;
}

export interface Method {
  id: MethodId;
  label: string;
  process: ProcessId;
  inputs: { item: Item; amount: number }[];
  /** A list, not one item, so a process that makes a by-product can say so. */
  outputs: { item: Item; amount: number }[];
  run: RunSettings;
  /** Ticks of work at the steady banking; the charge scales it. */
  ticks: number;
  /** Omitted means run for ever — legal, and the reason a queue needs an order. */
  until?: StopWhen;
  /** The chamber heat this needs to work at all. A rig short of it refuses, and says so. */
  needsHeat?: number;
}

export interface Book {
  /** Insertion order is part of the trace: nothing here may iterate any other way. */
  methods: Map<MethodId, Method>;
}

export const EMBERS_METHOD: MethodId = 'bank-the-fire';
export const EMBERS_TARGET = 12;
export const SEAL_METHOD: MethodId = 'seal-a-basket';
export const VESSEL_TARGET = 3;
export const POTS_METHOD: MethodId = 'fire-pots';
export const CHAR_METHOD: MethodId = 'burn-charcoal';

/**
 * The heat a pit firing has to reach before clay is ware at all.
 *
 * Below it the pots come back out of the fire as dried mud and fall apart in the first rain,
 * which is the lesson the ordinal knob is there to teach: bank it low and nothing happens.
 */
export const CERAMIC_HEAT = 600;

/**
 * What a town knows the day it is founded. Every rig opens with a working default, so a player
 * who never tunes anything still gets a functioning town — just a wasteful one.
 */
export function startingBook(): Book {
  const methods = new Map<MethodId, Method>();
  // First in the queue, because until the town has something to carry water in everybody walks
  // to the river for every drink, and that is most of what the first age costs (`needs.ts`).
  methods.set(SEAL_METHOD, {
    id: SEAL_METHOD,
    label: 'Seal a basket',
    process: 'fire',
    inputs: [{ item: ItemType.Mud, amount: 2 }],
    outputs: [{ item: ItemType.Vessel, amount: 1 }],
    run: { charge: CHARGE_LOW, fuel: 'wood' },
    ticks: 30,
    until: { item: ItemType.Vessel, target: VESSEL_TARGET },
  });
  methods.set(EMBERS_METHOD, {
    id: EMBERS_METHOD,
    label: 'Bank the fire',
    process: 'fire',
    inputs: [{ item: ItemType.Wood, amount: 1 }],
    outputs: [{ item: ItemType.Embers, amount: 1 }],
    run: { charge: CHARGE_STEADY, fuel: 'wood' },
    ticks: 40,
    until: { item: ItemType.Embers, target: EMBERS_TARGET },
  });
  methods.set(POTS_METHOD, {
    id: POTS_METHOD,
    label: 'Fire pots',
    process: 'fire',
    inputs: [{ item: ItemType.Clay, amount: 2 }],
    outputs: [{ item: ItemType.Pot, amount: 1 }],
    run: { charge: CHARGE_HIGH, fuel: 'wood' },
    ticks: 60,
    until: { item: ItemType.Pot, target: 6 },
    needsHeat: CERAMIC_HEAT,
  });
  methods.set(CHAR_METHOD, {
    id: CHAR_METHOD,
    label: 'Burn charcoal',
    process: 'char',
    inputs: [{ item: ItemType.Wood, amount: 4 }],
    // Opening the vents is what decides whether these come out charcoal or brands; the outputs
    // written here are the clamp's *intent*, and `runRig` substitutes what the pile actually
    // gave (`process.ts`).
    outputs: [{ item: ItemType.Charcoal, amount: 1 }],
    run: { charge: CHARGE_STEADY, fuel: 'wood' },
    ticks: 90,
    until: { item: ItemType.Charcoal, target: 8 },
  });

  return { methods };
}

export function methodById(book: Book, id: MethodId): Method | undefined {
  return book.methods.get(id);
}

export function addMethod(book: Book, method: Method): Method {
  book.methods.set(method.id, cloneMethod(method));
  return method;
}

export function cloneMethod(method: Method, id = method.id, label = method.label): Method {
  return {
    id,
    label,
    process: method.process,
    inputs: method.inputs.map((input) => ({ ...input })),
    outputs: method.outputs.map((output) => ({ ...output })),
    run: { ...method.run },
    ticks: method.ticks,
    ...(method.until ? { until: { ...method.until } } : {}),
    ...(method.needsHeat !== undefined ? { needsHeat: method.needsHeat } : {}),
  };
}

export function cloneBook(book: Book): Book {
  const methods = new Map<MethodId, Method>();
  for (const [id, method] of book.methods) methods.set(id, cloneMethod(method));
  methods.set(POTS_METHOD, {
    id: POTS_METHOD,
    label: 'Fire pots',
    process: 'fire',
    inputs: [{ item: ItemType.Clay, amount: 2 }],
    outputs: [{ item: ItemType.Pot, amount: 1 }],
    run: { charge: CHARGE_HIGH, fuel: 'wood' },
    ticks: 60,
    until: { item: ItemType.Pot, target: 6 },
    needsHeat: CERAMIC_HEAT,
  });
  methods.set(CHAR_METHOD, {
    id: CHAR_METHOD,
    label: 'Burn charcoal',
    process: 'char',
    inputs: [{ item: ItemType.Wood, amount: 4 }],
    // Opening the vents is what decides whether these come out charcoal or brands; the outputs
    // written here are the clamp's *intent*, and `runRig` substitutes what the pile actually
    // gave (`process.ts`).
    outputs: [{ item: ItemType.Charcoal, amount: 1 }],
    run: { charge: CHARGE_STEADY, fuel: 'wood' },
    ticks: 90,
    until: { item: ItemType.Charcoal, target: 8 },
  });

  return { methods };
}

/** Lowest free `method-n`, so deleting one and writing another cannot collide on an id. */
export function nextMethodId(book: Book): MethodId {
  for (let index = 1; ; index += 1) {
    const id = `method-${index}`;
    if (!book.methods.has(id)) return id;
  }
}
