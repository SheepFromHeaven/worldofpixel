import type { Observation, ResolutionId } from './models/knowing.ts';
import { observe } from './models/knowing.ts';
import type { RecipeId } from './recipe.ts';
import { CHARGE_HIGH, CHARGE_LOW, CHARGE_STEADY, CHARGE_STEPS, Recipe } from './recipe.ts';
import type { ItemType as Item } from './types.ts';
import { ItemType } from './types.ts';

export interface Book {
  recipes: Map<RecipeId, Recipe>;
  rows: Row[];
  instruments: InstrumentId[];
  named: Technique[];
}

export const EMBERS_RECIPE: RecipeId = 'bank-the-fire';
export const CORD_RECIPE: RecipeId = 'twist-cord';
export const WEAVE_RECIPE: RecipeId = 'weave-a-basket';
export const DAUB_RECIPE: RecipeId = 'mix-daub';
export const SEAL_RECIPE: RecipeId = 'seal-a-basket';
export const POTS_RECIPE: RecipeId = 'fire-pots';
export const POTS_ON_CHARCOAL: RecipeId = 'fire-pots-on-charcoal';
export const CHAR_RECIPE: RecipeId = 'burn-charcoal';

export const CERAMIC_HEAT = 600;

export function startingBook(): Book {
  const recipes = new Map<RecipeId, Recipe>();
  recipes.set(CORD_RECIPE, new Recipe({
    id: CORD_RECIPE,
    label: 'Twist cord',
    process: 'hand',
    inputs: [{ item: ItemType.Fibre, amount: 3 }],
    outputs: [{ item: ItemType.Cord, amount: 1 }],
    run: { charge: CHARGE_STEADY },
    ticks: 45,
  }));
  recipes.set(WEAVE_RECIPE, new Recipe({
    id: WEAVE_RECIPE,
    label: 'Weave a basket',
    process: 'hand',
    inputs: [
      { item: ItemType.Deadwood, amount: 2 },
      { item: ItemType.Cord, amount: 1 },
    ],
    outputs: [{ item: ItemType.Basket, amount: 1 }],
    run: { charge: CHARGE_STEADY },
    ticks: 70,
  }));
  recipes.set(DAUB_RECIPE, new Recipe({
    id: DAUB_RECIPE,
    label: 'Mix daub',
    process: 'hand',
    inputs: [
      { item: ItemType.Mud, amount: 2 },
      { item: ItemType.Fibre, amount: 1 },
    ],
    outputs: [{ item: ItemType.Daub, amount: 2 }],
    run: { charge: CHARGE_STEADY },
    ticks: 35,
  }));
  recipes.set(SEAL_RECIPE, new Recipe({
    id: SEAL_RECIPE,
    label: 'Seal a basket',
    process: 'fire',
    inputs: [
      { item: ItemType.Basket, amount: 1 },
      { item: ItemType.Daub, amount: 2 },
    ],
    outputs: [{ item: ItemType.Vessel, amount: 1 }],
    run: { charge: CHARGE_LOW, fuel: 'wood' },
    ticks: 30,
  }));
  recipes.set(EMBERS_RECIPE, new Recipe({
    id: EMBERS_RECIPE,
    label: 'Embers',
    process: 'fire',
    inputs: [{ item: ItemType.Deadwood, amount: 2 }],
    outputs: [{ item: ItemType.Embers, amount: 1 }],
    run: { charge: CHARGE_LOW, fuel: 'wood' },
    ticks: 40,
  }));
  recipes.set(POTS_RECIPE, new Recipe({
    id: POTS_RECIPE,
    label: 'Fire pots',
    process: 'fire',
    inputs: [{ item: ItemType.Clay, amount: 2 }],
    outputs: [{ item: ItemType.Pot, amount: 1 }],
    run: { charge: CHARGE_HIGH, fuel: 'wood' },
    ticks: 60,
    needsHeat: CERAMIC_HEAT,
  }));
  recipes.set(POTS_ON_CHARCOAL, new Recipe({
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
  }));
  recipes.set(CHAR_RECIPE, new Recipe({
    id: CHAR_RECIPE,
    label: 'Burn charcoal',
    process: 'char',
    inputs: [
      { item: ItemType.Deadwood, amount: 4 },
      { item: ItemType.Embers, amount: 1 },
    ],
    outputs: [{ item: ItemType.Charcoal, amount: 1 }],
    run: { charge: CHARGE_STEADY, fuel: 'wood' },
    ticks: 90,
  }));

  return { ...emptyBook(), recipes };
}

export function emptyBook(): Book {
  return { recipes: new Map(), rows: [], instruments: ['eye'], named: [] };
}

export function recipeById(book: Book, id: RecipeId): Recipe | undefined {
  return book.recipes.get(id);
}

export function addRecipe(book: Book, recipe: Recipe): Recipe {
  book.recipes.set(recipe.id, recipe);
  return recipe;
}

export type ParamId = 'charge' | 'damper';

export interface Row {
  recipeId: RecipeId;
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

export function rateOf(recipe: Recipe): number {
  const step = CHARGE_STEPS[Math.min(Math.max(0, recipe.run.charge), CHARGE_STEPS.length - 1)];
  const made = recipe.outputs.reduce((sum, output) => sum + output.amount, 0);
  return (made * (step?.rate ?? 1) * 100) / Math.max(1, recipe.ticks);
}

export function rowsFor(book: Book, recipeId: RecipeId, param?: ParamId): Row[] {
  return book.rows.filter(
    (row) => row.recipeId === recipeId && (param === undefined || row.param === param),
  );
}

export function writeRow(book: Book, row: Row): Row {
  const written = cloneRow(row);
  book.rows.push(written);
  return written;
}

export function believed(book: Book, recipe: Recipe): Observation {
  return observe(rateOf(recipe), rowsFor(book, recipe.id).length, bestResolution(book));
}

export const TRIAL_SHARE = 0.2;

export const SWEEP_SETTINGS = 3;

export interface Trial {
  recipeId: RecipeId;
  param: ParamId;
  value: number;
  inputs: { item: Item; amount: number }[];
  ticks: number;
}

export function sweep(
  book: Book,
  recipeId: RecipeId,
  param: ParamId,
  values: readonly number[],
): Trial[] {
  const recipe = recipeById(book, recipeId);
  if (!recipe) return [];
  return values.map((value) => ({
    recipeId,
    param,
    value,
    inputs: recipe.inputs.map((input) => ({
      item: input.item,
      amount: Math.max(1, Math.round(input.amount * TRIAL_SHARE)),
    })),
    ticks: Math.max(1, Math.round(recipe.ticks * TRIAL_SHARE)),
  }));
}

export function recipeFor(book: Book, trial: Trial): Recipe | undefined {
  const recipe = recipeById(book, trial.recipeId);
  if (!recipe) return undefined;
  return recipe.with({ run: { ...recipe.run, [trial.param]: trial.value } });
}

export function recordTrial(book: Book, trial: Trial, outcome: number): Row {
  return writeRow(book, {
    recipeId: trial.recipeId,
    param: trial.param,
    value: trial.value,
    outcome,
  });
}

export type TechniqueId = string;

export interface Technique {
  id: TechniqueId;
  label: string;
  recipeId: RecipeId;
  param: ParamId;
  value: number;
  resolution: ResolutionId;
}

export function techniqueId(recipeId: RecipeId, param: ParamId): TechniqueId {
  return `${recipeId}:${param}`;
}

export function isNamed(book: Book, id: TechniqueId): boolean {
  return book.named.some((technique) => technique.id === id);
}

export function earnedTechniques(book: Book): Technique[] {
  const resolution = bestResolution(book);
  const sweeps = new Map<TechniqueId, Row[]>();
  for (const row of book.rows) {
    const id = techniqueId(row.recipeId, row.param);
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
      recipeId: first.recipeId,
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
  const recipe = recipeById(book, row.recipeId);
  const name = row.param === 'charge' ? CHARGE_STEPS[value]?.name : undefined;
  return `${recipe?.label ?? row.recipeId}, ${name ?? `${row.param} ${value}`}`;
}

export function cloneRow(row: Row): Row {
  return { recipeId: row.recipeId, param: row.param, value: row.value, outcome: row.outcome };
}

export function cloneTechnique(technique: Technique): Technique {
  return { ...technique };
}
