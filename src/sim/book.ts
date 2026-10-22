import type { FuelId } from './models/heat.ts';
import { observe } from './models/knowing.ts';
import type { Observation, ResolutionId } from './models/knowing.ts';
import { ItemType } from './types.ts';
import type { ItemType as Item } from './types.ts';

export type MethodId = string;

export type ProcessId = 'fire' | 'char' | 'hand';

export const CHARGE_STEPS = [
  { name: 'banked', rate: 0.5 },
  { name: 'steady', rate: 1.0 },
  { name: 'roaring', rate: 1.6 },
] as const;

export const CHARGE_LOW = 0;
export const CHARGE_STEADY = 1;
export const CHARGE_HIGH = 2;

export interface RunSettings {
  charge: number;
  damper?: number;
  fuel?: FuelId;
}

export interface Method {
  id: MethodId;
  label: string;
  process: ProcessId;
  inputs: { item: Item; amount: number }[];
  outputs: { item: Item; amount: number }[];
  run: RunSettings;
  ticks: number;
  needsHeat?: number;
}

export interface Book {
  methods: Map<MethodId, Method>;
  rows: Row[];
  instruments: InstrumentId[];
  named: Technique[];
}

export const EMBERS_METHOD: MethodId = 'bank-the-fire';
export const CORD_METHOD: MethodId = 'twist-cord';
export const WEAVE_METHOD: MethodId = 'weave-a-basket';
export const DAUB_METHOD: MethodId = 'mix-daub';
export const SEAL_METHOD: MethodId = 'seal-a-basket';
export const POTS_METHOD: MethodId = 'fire-pots';
export const POTS_ON_CHARCOAL: MethodId = 'fire-pots-on-charcoal';
export const CHAR_METHOD: MethodId = 'burn-charcoal';

export const CERAMIC_HEAT = 600;

export function startingBook(): Book {
  const methods = new Map<MethodId, Method>();
  methods.set(CORD_METHOD, {
    id: CORD_METHOD,
    label: 'Twist cord',
    process: 'hand',
    inputs: [{ item: ItemType.Fibre, amount: 3 }],
    outputs: [{ item: ItemType.Cord, amount: 1 }],
    run: { charge: CHARGE_STEADY },
    ticks: 45,
  });
  methods.set(WEAVE_METHOD, {
    id: WEAVE_METHOD,
    label: 'Weave a basket',
    process: 'hand',
    inputs: [
      { item: ItemType.Deadwood, amount: 2 },
      { item: ItemType.Cord, amount: 1 },
    ],
    outputs: [{ item: ItemType.Basket, amount: 1 }],
    run: { charge: CHARGE_STEADY },
    ticks: 70,
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
  });
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
  });
  methods.set(EMBERS_METHOD, {
    id: EMBERS_METHOD,
    label: 'Embers',
    process: 'fire',
    inputs: [{ item: ItemType.Deadwood, amount: 2 }],
    outputs: [{ item: ItemType.Embers, amount: 1 }],
    run: { charge: CHARGE_LOW, fuel: 'wood' },
    ticks: 40,
  });
  methods.set(POTS_METHOD, {
    id: POTS_METHOD,
    label: 'Fire pots',
    process: 'fire',
    inputs: [{ item: ItemType.Clay, amount: 2 }],
    outputs: [{ item: ItemType.Pot, amount: 1 }],
    run: { charge: CHARGE_HIGH, fuel: 'wood' },
    ticks: 60,
    needsHeat: CERAMIC_HEAT,
  });
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
    needsHeat: CERAMIC_HEAT,
  });
  methods.set(CHAR_METHOD, {
    id: CHAR_METHOD,
    label: 'Burn charcoal',
    process: 'char',
    inputs: [
      { item: ItemType.Deadwood, amount: 4 },
      { item: ItemType.Embers, amount: 1 },
    ],
    outputs: [{ item: ItemType.Charcoal, amount: 1 }],
    run: { charge: CHARGE_STEADY, fuel: 'wood' },
    ticks: 90,
  });

  return { ...emptyBook(), methods };
}

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
    ...(method.needsHeat !== undefined ? { needsHeat: method.needsHeat } : {}),
  };
}

export type ParamId = 'charge' | 'damper';

export interface Row {
  methodId: MethodId;
  param: ParamId;
  value: number;
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

const FINENESS: readonly ResolutionId[] = ['ordinal', 'graded', 'continuous'];

export function addInstrument(book: Book, id: InstrumentId): void {
  if (!book.instruments.includes(id)) book.instruments.push(id);
}

export function bestResolution(book: Book): ResolutionId {
  let best = 0;
  for (const id of book.instruments) {
    const rank = FINENESS.indexOf(INSTRUMENTS[id].reads);
    if (rank > best) best = rank;
  }
  return FINENESS[best] ?? 'ordinal';
}

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

export function believed(book: Book, method: Method): Observation {
  return observe(rateOf(method), rowsFor(book, method.id).length, bestResolution(book));
}

export const TRIAL_SHARE = 0.2;

export const SWEEP_SETTINGS = 3;

export interface Trial {
  methodId: MethodId;
  param: ParamId;
  value: number;
  inputs: { item: Item; amount: number }[];
  ticks: number;
}

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
  value: number;
  resolution: ResolutionId;
}

export function techniqueId(methodId: MethodId, param: ParamId): TechniqueId {
  return `${methodId}:${param}`;
}

export function isNamed(book: Book, id: TechniqueId): boolean {
  return book.named.some((technique) => technique.id === id);
}

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
