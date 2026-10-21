import type { FuelId } from './models/heat.ts';
import { observe } from './models/knowing.ts';
import type { Observation, ResolutionId } from './models/knowing.ts';
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
 *
 * `hand` is the third and has no fire under it at all: walking a cord, weaving withies, treading
 * daub. Calling that `fire` would be cheap and wrong — the time a batch takes would be divided
 * by a burn rate, and the rig would be asked for a chamber it does not have.
 */
export type ProcessId = 'fire' | 'char' | 'hand';

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
  /** Every trial ever run, oldest first. The same rule holds: never iterate it any other way. */
  rows: Row[];
  /** What the town can read with, in the order the instruments arrived. */
  instruments: InstrumentId[];
  /** What the rows have earned a name for (`nameTechniques`). The whole of the tech tree. */
  named: Technique[];
}

export const EMBERS_METHOD: MethodId = 'bank-the-fire';
/**
 * One, to open on: a banked fire needs a single ember to carry, and a town that has not yet got
 * the wood to spare for more should not be burning it for a stock nobody is waiting on. The
 * player moves the scratch when something wants more.
 *
 * Kept inside the shelf the panel draws (`ui/rigView.ts`'s `SHELF_SLOTS`). A stop condition is
 * a scratch on the shelf, so a target with no board to scratch is a setting the player can read
 * and never put back once they have moved it.
 */
export const EMBERS_TARGET = 1;
export const CORD_METHOD: MethodId = 'twist-cord';
export const CORD_TARGET = 6;
export const WEAVE_METHOD: MethodId = 'weave-a-basket';
export const BASKET_TARGET = 4;
export const DAUB_METHOD: MethodId = 'mix-daub';
export const DAUB_TARGET = 8;
export const SEAL_METHOD: MethodId = 'seal-a-basket';
export const VESSEL_TARGET = 3;
export const POTS_METHOD: MethodId = 'fire-pots';
export const POTS_ON_CHARCOAL: MethodId = 'fire-pots-on-charcoal';
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
  // Age II in order, and the order is the chain: reeds are combed into fibre, fibre is walked
  // into cord, cord binds the withies into a basket, and the basket is daubed and dried at the
  // fire. Three of the four are cold work done with the hands, which is what `hand` is for.
  methods.set(CORD_METHOD, {
    id: CORD_METHOD,
    label: 'Twist cord',
    process: 'hand',
    inputs: [{ item: ItemType.Fibre, amount: 3 }],
    outputs: [{ item: ItemType.Cord, amount: 1 }],
    run: { charge: CHARGE_STEADY },
    ticks: 45,
    until: { item: ItemType.Cord, target: CORD_TARGET },
  });
  methods.set(WEAVE_METHOD, {
    id: WEAVE_METHOD,
    label: 'Weave a basket',
    process: 'hand',
    inputs: [
      // Withies, gathered: nobody is felling anything in Age II.
      { item: ItemType.Deadwood, amount: 2 },
      { item: ItemType.Cord, amount: 1 },
    ],
    outputs: [{ item: ItemType.Basket, amount: 1 }],
    run: { charge: CHARGE_STEADY },
    ticks: 70,
    until: { item: ItemType.Basket, target: BASKET_TARGET },
  });
  methods.set(DAUB_METHOD, {
    id: DAUB_METHOD,
    label: 'Mix daub',
    process: 'hand',
    inputs: [
      { item: ItemType.Mud, amount: 2 },
      { item: ItemType.Fibre, amount: 1 },
    ],
    outputs: [{ item: ItemType.Daub, amount: 2 }],
    run: { charge: CHARGE_STEADY },
    ticks: 35,
    until: { item: ItemType.Daub, target: DAUB_TARGET },
  });
  // First in the fire's queue, because until the town has something to carry water in everybody
  // walks to the river for every drink, and that is most of what the first age costs
  // (`needs.ts`). A daubed basket is dried at the fire, which is why it lives here.
  methods.set(SEAL_METHOD, {
    id: SEAL_METHOD,
    label: 'Seal a basket',
    process: 'fire',
    inputs: [
      { item: ItemType.Basket, amount: 1 },
      { item: ItemType.Daub, amount: 2 },
    ],
    outputs: [{ item: ItemType.Vessel, amount: 1 }],
    run: { charge: CHARGE_LOW, fuel: 'wood' },
    ticks: 30,
    until: { item: ItemType.Vessel, target: VESSEL_TARGET },
  });
  methods.set(EMBERS_METHOD, {
    id: EMBERS_METHOD,
    label: 'Embers',
    process: 'fire',
    // Two at the steady banking, which `costOf` scales with the fire: one banked, three
    // roaring. The woodpile is the price of the hurry.
    inputs: [{ item: ItemType.Deadwood, amount: 2 }],
    outputs: [{ item: ItemType.Embers, amount: 1 }],
    // Banked, because a town opens with next to no wood and the thrifty fire is the one it can
    // afford; the hotter two are earned by having the pile to feed them.
    run: { charge: CHARGE_LOW, fuel: 'wood' },
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
  /**
   * The same pots on the other fuel, which is the chapter's best teaching moment and needs a
   * way to be reached. Charcoal carries twice the energy of wood and wants nearly twice the
   * air, so a pit firing — which has barely any flue — runs *colder* on it and smokes while it
   * does. Nothing warns the player: they switch to the better fuel and the ware comes out raw,
   * and the answer is a taller flue rather than a different recipe.
   */
  methods.set(POTS_ON_CHARCOAL, {
    id: POTS_ON_CHARCOAL,
    label: 'Fire pots on charcoal',
    process: 'fire',
    inputs: [
      { item: ItemType.Clay, amount: 2 },
      { item: ItemType.Charcoal, amount: 2 },
    ],
    outputs: [{ item: ItemType.Pot, amount: 1 }],
    run: { charge: CHARGE_HIGH, fuel: 'charcoal' },
    ticks: 60,
    until: { item: ItemType.Pot, target: 6 },
    needsHeat: CERAMIC_HEAT,
  });
  methods.set(CHAR_METHOD, {
    id: CHAR_METHOD,
    label: 'Burn charcoal',
    process: 'char',
    // Wood to char and embers to light it with. "A charcoal works: wood and mud in, stack,
    // clamp, embers from the hearth, charcoal and mud back out" — a clamp is not kindled from
    // nothing, and this is the one thing in the chapter the hearth's own product is *for*.
    inputs: [
      { item: ItemType.Deadwood, amount: 4 },
      { item: ItemType.Embers, amount: 1 },
    ],
    // Opening the vents is what decides whether these come out charcoal or brands; the outputs
    // written here are the clamp's *intent*, and `runRig` substitutes what the pile actually
    // gave (`process.ts`).
    outputs: [{ item: ItemType.Charcoal, amount: 1 }],
    run: { charge: CHARGE_STEADY, fuel: 'wood' },
    ticks: 90,
    until: { item: ItemType.Charcoal, target: 8 },
  });

  return { ...emptyBook(), methods };
}

/** A book with nothing in it. The eye is owned from the first minute, so it is never empty. */
export function emptyBook(): Book {
  return { methods: new Map(), rows: [], instruments: ['eye'], named: [] };
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
  return {
    methods,
    rows: book.rows.map(cloneRow),
    instruments: [...book.instruments],
    named: book.named.map(cloneTechnique),
  };
}

/** Lowest free `method-n`, so deleting one and writing another cannot collide on an id. */
export function nextMethodId(book: Book): MethodId {
  for (let index = 1; ; index += 1) {
    const id = `method-${index}`;
    if (!book.methods.has(id)) return id;
  }
}

/**
 * Trials, sweeps and what the book is allowed to say.
 *
 * A method's worth is not predicted here, it is watched: run it, wait, and the town reports what
 * came out. The estimate tightens with every trial and it is floored by the instrument that read
 * it — by eye alone it never gets better than about a fifth either way, however long anyone
 * watches. That floor is the whole point. A number finer than the thing that measured it is a
 * number the game invented, and the fog over the player's knowledge is the progress.
 *
 * Nothing in here is random. The spread stands in for variation the simulation will have for
 * real, so the tick stays deterministic and two runs of a seed still trace alike.
 */

/** Which knob a row moved. One per row, and `sweep` can express no other shape (see below). */
export type ParamId = 'charge' | 'damper';

/** A trial, written down: the method, the knob, where it was set, and what came out. */
export interface Row {
  methodId: MethodId;
  param: ParamId;
  value: number;
  /** Output per hundred ticks, the units `rateOf` is in. */
  outcome: number;
}

export type InstrumentId = 'eye' | 'test-ring' | 'cone';

export interface Instrument {
  label: string;
  reads: ResolutionId;
  note: string;
}

export const INSTRUMENTS: Record<InstrumentId, Instrument> = {
  eye: {
    label: 'the eye',
    reads: 'ordinal',
    note: 'Glow colour, a band about 150 °C wide. Owned from the first minute, and costs nothing.',
  },
  'test-ring': {
    label: 'a test ring',
    reads: 'graded',
    note: 'Shrinkage, so peak heat within about 70 °C. One clay ring per firing.',
  },
  cone: {
    label: 'a pyrometric cone',
    reads: 'continuous',
    note: 'Heat work within about 15 °C, and the first readout a curve may be drawn through.',
  },
};

/** Coarsest first: one instrument beats another exactly when it reads further along this. */
const FINENESS: readonly ResolutionId[] = ['ordinal', 'graded', 'continuous'];

export function ownsInstrument(book: Book, id: InstrumentId): boolean {
  return book.instruments.includes(id);
}

export function addInstrument(book: Book, id: InstrumentId): void {
  if (!book.instruments.includes(id)) book.instruments.push(id);
}

/** The finest the town can read anything. Everything the book says is floored by this. */
export function bestResolution(book: Book): ResolutionId {
  let best = 0;
  for (const id of book.instruments) {
    const rank = FINENESS.indexOf(INSTRUMENTS[id].reads);
    if (rank > best) best = rank;
  }
  return FINENESS[best] ?? 'ordinal';
}

/**
 * What a method really gives, per hundred ticks at the banking written into it.
 *
 * The truth, which the player never sees: `believed` is the only way to it, and it hands back a
 * band rather than this number.
 */
export function rateOf(method: Method): number {
  const step = CHARGE_STEPS[Math.min(Math.max(0, method.run.charge), CHARGE_STEPS.length - 1)];
  const made = method.outputs.reduce((sum, output) => sum + output.amount, 0);
  return (made * (step?.rate ?? 1) * 100) / Math.max(1, method.ticks);
}

export function rowsFor(book: Book, methodId: MethodId, param?: ParamId): Row[] {
  return book.rows.filter(
    (row) => row.methodId === methodId && (param === undefined || row.param === param),
  );
}

export function writeRow(book: Book, row: Row): Row {
  const written = cloneRow(row);
  book.rows.push(written);
  return written;
}

/**
 * What the town currently believes about a method: the sample it has, read by the best
 * instrument it owns.
 *
 * With no rows at all the answer is *not known* — never zero. A town that has never fired a kiln
 * does not believe the kiln makes nothing; it has no opinion, and the readout must say so.
 */
export function believed(book: Book, method: Method): Observation {
  return observe(rateOf(method), rowsFor(book, method.id).length, bestResolution(book));
}

/** A trial costs a worker and a fifth of the materials a real batch would. */
export const TRIAL_SHARE = 0.2;

/** The smallest number of settings that can show a pattern rather than a pair of points. */
export const SWEEP_SETTINGS = 3;

export interface Trial {
  methodId: MethodId;
  param: ParamId;
  value: number;
  inputs: { item: Item; amount: number }[];
  ticks: number;
}

/**
 * The queue of one-batch trials a sweep would run: the same method at several values of **one**
 * parameter, one small batch each.
 *
 * One parameter is the whole signature, and deliberately so. Two at once is a grid, costs
 * twenty-five batches and turns the book into a mess — so there is no way to ask for one.
 */
export function sweep(
  book: Book,
  methodId: MethodId,
  param: ParamId,
  values: readonly number[],
): Trial[] {
  const method = methodById(book, methodId);
  if (!method) return [];
  return values.map((value) => ({
    methodId,
    param,
    value,
    inputs: method.inputs.map((input) => ({
      item: input.item,
      amount: Math.max(1, Math.round(input.amount * TRIAL_SHARE)),
    })),
    ticks: Math.max(1, Math.round(method.ticks * TRIAL_SHARE)),
  }));
}

/** What a trial would run as: the method with its one knob moved to the trial's value. */
export function methodFor(book: Book, trial: Trial): Method | undefined {
  const method = methodById(book, trial.methodId);
  if (!method) return undefined;
  return { ...cloneMethod(method), run: { ...method.run, [trial.param]: trial.value } };
}

export function recordTrial(book: Book, trial: Trial, outcome: number): Row {
  return writeRow(book, {
    methodId: trial.methodId,
    param: trial.param,
    value: trial.value,
    outcome,
  });
}

export type TechniqueId = string;

export interface Technique {
  id: TechniqueId;
  label: string;
  methodId: MethodId;
  param: ParamId;
  /** The setting the rows say is best, at the resolution they were read at. */
  value: number;
  resolution: ResolutionId;
}

export function techniqueId(methodId: MethodId, param: ParamId): TechniqueId {
  return `${methodId}:${param}`;
}

export function isNamed(book: Book, id: TechniqueId): boolean {
  return book.named.some((technique) => technique.id === id);
}

/**
 * What the rows have earned a name for.
 *
 * This is the only unlock in the design — no nodes and no points — so it must be the evidence
 * that does it and not a counter. A sweep earns its name when the best setting's band clears the
 * worst setting's entirely: three settings at least, and a difference between them the
 * instrument can actually see. Run the same trial a hundred times at one value and nothing is
 * named, because nothing has been compared; sweep a knob that changes nothing and nothing is
 * named either, because the bands lie on top of each other however long anyone watches.
 */
export function earnedTechniques(book: Book): Technique[] {
  const resolution = bestResolution(book);
  const sweeps = new Map<TechniqueId, Row[]>();
  for (const row of book.rows) {
    const id = techniqueId(row.methodId, row.param);
    const rows = sweeps.get(id);
    if (rows) rows.push(row);
    else sweeps.set(id, [row]);
  }

  const earned: Technique[] = [];
  for (const [id, rows] of sweeps) {
    const first = rows[0];
    if (!first) continue;
    const settings = bandsBySetting(rows, resolution);
    if (settings.length < SWEEP_SETTINGS) continue;
    let best = settings[0];
    let worst = settings[0];
    if (!best || !worst) continue;
    for (const setting of settings) {
      if (setting.estimate > best.estimate) best = setting;
      if (setting.estimate < worst.estimate) worst = setting;
    }
    if (best.lo <= worst.hi) continue;
    earned.push({
      id,
      label: labelFor(book, first, best.value),
      methodId: first.methodId,
      param: first.param,
      value: best.value,
      resolution,
    });
  }
  return earned;
}

/** Write down whatever the rows have earned since last time, and say what is new. */
export function nameTechniques(book: Book): Technique[] {
  const fresh = earnedTechniques(book).filter((technique) => !isNamed(book, technique.id));
  for (const technique of fresh) book.named.push(cloneTechnique(technique));
  return fresh;
}

interface Band {
  value: number;
  estimate: number;
  lo: number;
  hi: number;
}

/** One band per distinct setting, in the order the settings were first tried. */
function bandsBySetting(rows: Row[], resolution: ResolutionId): Band[] {
  const totals = new Map<number, { sum: number; runs: number }>();
  for (const row of rows) {
    const total = totals.get(row.value);
    if (total) {
      total.sum += row.outcome;
      total.runs += 1;
    } else totals.set(row.value, { sum: row.outcome, runs: 1 });
  }

  const bands: Band[] = [];
  for (const [value, { sum, runs }] of totals) {
    const seen = observe(sum / runs, runs, resolution);
    if (seen.estimate === null || seen.lo === null || seen.hi === null) continue;
    bands.push({ value, estimate: seen.estimate, lo: seen.lo, hi: seen.hi });
  }
  return bands;
}

function labelFor(book: Book, row: Row, value: number): string {
  const method = methodById(book, row.methodId);
  const name = row.param === 'charge' ? CHARGE_STEPS[value]?.name : undefined;
  return `${method?.label ?? row.methodId}, ${name ?? `${row.param} ${value}`}`;
}

export function cloneRow(row: Row): Row {
  return { methodId: row.methodId, param: row.param, value: row.value, outcome: row.outcome };
}

export function cloneTechnique(technique: Technique): Technique {
  return { ...technique };
}
