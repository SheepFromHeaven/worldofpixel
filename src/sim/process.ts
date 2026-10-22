import type { Book } from './book.ts';
import { recipeById } from './book.ts';
import { depositHopper, roomFor, storedStock, withdraw } from './buildings.ts';
import type { GlowStep } from './models/heat.ts';
import { AMBIENT, RIGS, char, envelopeOf, fire, glowOf } from './models/heat.ts';
import type { Recipe, RecipeId } from './recipe.ts';
import { CHARGE_STEPS } from './recipe.ts';
import type { Rig, RigSpecId } from './rig.ts';
import { CLAMP_BUILD, CLAMP_VENTS, heldBuild, isHandRig } from './rig.ts';
import type { Building, ItemType as Item } from './types.ts';

export const CHANGEOVER_TICKS = 45;

export const TICKS_PER_SECOND = 10;

export function linesFor(building: Building, slot: number): RecipeId[] {
  return building.queue.filter((line) => line.slot === slot).map((line) => line.recipeId);
}

export function heldFor(building: Building, item: Item): number {
  return storedStock(building, item);
}

export function createRig(spec: RigSpecId): Rig {
  return {
    spec,
    process: spec === 'clamp' ? 'char' : isHandRig(spec) ? 'hand' : 'fire',
    build:
      spec === 'clamp' || isHandRig(spec)
        ? { vent: 1, flue: 0, wall: 1, chamber: 1, maxRate: 0 }
        : { ...RIGS[spec].build },
    crew: { min: 1, max: spec === 'clamp' || isHandRig(spec) ? 3 : 2 },
    running: null,
    changeover: 0,
  };
}

export function cloneRig(rig: Rig): Rig {
  return {
    spec: rig.spec,
    process: rig.process,
    build: { ...rig.build },
    crew: { ...rig.crew },
    running: rig.running ? { ...rig.running } : null,
    changeover: rig.changeover,
    ...(rig.last !== undefined ? { last: rig.last } : {}),
    ...(rig.warm ? { warm: rig.warm } : {}),
  };
}

export function ceilingOf(rig: Rig): number {
  if (rig.spec === 'clamp') return char({ ...CLAMP_BUILD, vent: CLAMP_VENTS[2] }).T;
  if (isHandRig(rig.spec)) return AMBIENT;
  return envelopeOf({ ...RIGS[rig.spec], build: heldBuild(rig) }).T;
}

export function heatOf(rig: Rig, book: Book): { T: number; glow: GlowStep; starved: boolean } {
  const recipe = rig.running ? recipeById(book, rig.running.recipeId) : undefined;
  if (!recipe || isHandRig(rig.spec)) return { T: AMBIENT, glow: glowOf(AMBIENT), starved: false };
  if (rig.spec === 'clamp') {
    const pile = recipe.pile();
    return { T: pile.T, glow: glowOf(pile.T), starved: pile.grade === 'brands' };
  }
  const out = fire({ ...heldBuild(rig), ...recipe.firing() });
  return { T: out.T, glow: out.glow, starved: out.starved };
}

export function affordableBankings(rig: Rig, recipe: Recipe, building: Building): boolean[] {
  return CHARGE_STEPS.map((_, charge) =>
    recipe.withCharge(charge).cost(rig).every((input) => heldFor(building, input.item) >= input.amount),
  );
}

export type RefusalKind = 'unknown' | 'wrong-process' | 'envelope' | 'inputs' | 'full';

export interface Refusal {
  recipeId: RecipeId;
  kind: RefusalKind;
  why: string;
}

export interface Scan {
  recipe: Recipe | null;
  refused: Refusal[];
}

export function scanQueue(rig: Rig, book: Book, building: Building, slot: number): Scan {
  const refused: Refusal[] = [];
  const ceiling = ceilingOf(rig);

  for (const recipeId of linesFor(building, slot)) {
    const recipe = recipeById(book, recipeId);
    if (!recipe) {
      refused.push({ recipeId, kind: 'unknown', why: 'nothing in the book by that name' });
      continue;
    }
    if (recipe.process !== rig.process) {
      refused.push({ recipeId, kind: 'wrong-process', why: 'not a method for this kind of rig' });
      continue;
    }
    if (recipe.needsHeat !== undefined && recipe.needsHeat > ceiling) {
      refused.push({
        recipeId,
        kind: 'envelope',
        why: `needs ${glowOf(recipe.needsHeat).name}; this rig tops out at ${glowOf(ceiling).name}`,
      });
      continue;
    }
    const short = recipe.cost(rig).find((input) => heldFor(building, input.item) < input.amount);
    if (short) {
      refused.push({ recipeId, kind: 'inputs', why: `no ${short.item}` });
      continue;
    }
    const nowhere = recipe.yield(rig).find(
      (output) => roomFor(building, output.item) < output.amount,
    );
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

export function runRig(building: Building, slot: number, book: Book, manned: boolean): RigOutcome {
  const rig = building.slots[slot]?.rig ?? null;
  const idle: RigOutcome = { produced: [], running: null, changingOver: false };
  if (!rig) return idle;
  if (building.clearing) return idle;
  if (!manned) return idle;

  if (rig.changeover > 0) {
    rig.changeover -= 1;
    return { produced: [], running: null, changingOver: true };
  }

  if (!rig.running && !begin(rig, book, building, slot)) return idle;

  const running = rig.running;
  const recipe = running ? recipeById(book, running.recipeId) : undefined;
  if (!running || !recipe) {
    rig.running = null;
    return idle;
  }

  running.progress += 1;
  if (running.progress < recipe.batchTicks(rig)) {
    return { produced: [], running: recipe.id, changingOver: false };
  }

  const produced: { item: Item; amount: number }[] = [];
  const short = recipe.needsHeat !== undefined && heatOf(rig, book).T < recipe.needsHeat;
  for (const output of short ? [] : recipe.yield(rig)) {
    const placed = depositHopper(building, output.item, output.amount);
    if (placed > 0) produced.push({ item: output.item, amount: placed });
  }
  building.producedTotal += produced.reduce((sum, entry) => sum + entry.amount, 0);
  rig.running = null;
  rig.last = recipe.id;

  const next = begin(rig, book, building, slot) ? recipe.id : null;
  return { produced, running: next, changingOver: rig.changeover > 0 };
}

function begin(rig: Rig, book: Book, building: Building, slot: number): boolean {
  const chosen = scanQueue(rig, book, building, slot).recipe;
  if (!chosen) return false;

  if (rig.last !== undefined && rig.last !== chosen.id && rig.process !== 'hand') {
    rig.changeover = CHANGEOVER_TICKS;
    rig.last = chosen.id;
    return false;
  }

  for (const input of chosen.cost(rig)) withdraw(building, input.item, input.amount);
  rig.last = chosen.id;
  rig.running = { recipeId: chosen.id, progress: 0 };
  return true;
}
