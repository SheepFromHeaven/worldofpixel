import type { Book } from './book.ts';
import { recipeById } from './book.ts';
import { depositHopper, roomFor, storedStock, withdraw } from './buildings.ts';
import type { Recipe, RecipeId } from './recipe.ts';
import { CHARGE_STEPS, ChargedRecipe } from './recipe.ts';
import type { Heat, Refusal, RefusalKind, Station } from './station.ts';
import { CHANGEOVER_TICKS } from './station.ts';
import type { Building, ItemType as Item } from './types.ts';

export { CHANGEOVER_TICKS };
export type { Refusal, RefusalKind };

export const TICKS_PER_SECOND = 10;

export function linesFor(building: Building, slot: number): RecipeId[] {
  return building.queue.filter((line) => line.slot === slot).map((line) => line.recipeId);
}

export function heldFor(building: Building, item: Item): number {
  return storedStock(building, item);
}

export const ceilingOf = (station: Station): number => station.ceiling();

export function heatOf(station: Station, book: Book): Heat {
  const recipe = station.running ? recipeById(book, station.running.recipeId) : undefined;
  return station.heat(recipe);
}

export function affordableBankings(station: Station, recipe: Recipe, building: Building): boolean[] {
  if (!(recipe instanceof ChargedRecipe)) return CHARGE_STEPS.map(() => true);
  return CHARGE_STEPS.map((_, charge) =>
    station
      .cost(recipe.withCharge(charge))
      .every((input) => heldFor(building, input.item) >= input.amount),
  );
}

export interface Scan {
  recipe: Recipe | null;
  refused: Refusal[];
}

export function scanQueue(station: Station, book: Book, building: Building, slot: number): Scan {
  const refused: Refusal[] = [];

  for (const recipeId of linesFor(building, slot)) {
    const recipe = recipeById(book, recipeId);
    if (!recipe) {
      refused.push({ recipeId, kind: 'unknown', why: 'nothing in the book by that name' });
      continue;
    }
    const refusal = station.refuse(recipe);
    if (refusal) {
      refused.push({ recipeId, ...refusal });
      continue;
    }
    const short = station.cost(recipe).find((input) => heldFor(building, input.item) < input.amount);
    if (short) {
      refused.push({ recipeId, kind: 'inputs', why: `no ${short.item}` });
      continue;
    }
    const nowhere = station
      .yields(recipe)
      .find((output) => roomFor(building, output.item) < output.amount);
    if (nowhere) {
      refused.push({ recipeId, kind: 'full', why: `nowhere to put the ${nowhere.item}` });
      continue;
    }
    return { recipe, refused };
  }

  return { recipe: null, refused };
}

export interface RigOutcome {
  produced: { item: Item; amount: number }[];
  running: RecipeId | null;
  changingOver: boolean;
}

export function runStation(
  building: Building,
  slot: number,
  book: Book,
  manned: boolean,
): RigOutcome {
  const station = building.slots[slot]?.station ?? null;
  const idle: RigOutcome = { produced: [], running: null, changingOver: false };
  if (!station) return idle;
  if (building.clearing) return idle;
  if (!manned) return idle;

  if (station.changeover > 0) {
    station.changeover -= 1;
    return { produced: [], running: null, changingOver: true };
  }

  if (!station.running && !begin(station, book, building, slot)) return idle;

  const running = station.running;
  const recipe = running ? recipeById(book, running.recipeId) : undefined;
  if (!running || !recipe) {
    station.running = null;
    return idle;
  }

  running.progress += 1;
  if (running.progress < station.duration(recipe)) {
    return { produced: [], running: recipe.id, changingOver: false };
  }

  const produced: { item: Item; amount: number }[] = [];
  for (const output of station.spoiled(recipe) ? [] : station.yields(recipe)) {
    const placed = depositHopper(building, output.item, output.amount);
    if (placed > 0) produced.push({ item: output.item, amount: placed });
  }
  building.producedTotal += produced.reduce((sum, entry) => sum + entry.amount, 0);
  station.running = null;
  station.last = recipe.id;

  const next = begin(station, book, building, slot) ? recipe.id : null;
  return { produced, running: next, changingOver: station.changeover > 0 };
}

function begin(station: Station, book: Book, building: Building, slot: number): boolean {
  const chosen = scanQueue(station, book, building, slot).recipe;
  if (!chosen) return false;

  if (station.last !== undefined && station.last !== chosen.id && station.changeoverTicks > 0) {
    station.changeover = station.changeoverTicks;
    station.last = chosen.id;
    return false;
  }

  for (const input of station.cost(chosen)) withdraw(building, input.item, input.amount);
  station.last = chosen.id;
  station.running = { recipeId: chosen.id, progress: 0 };
  return true;
}
