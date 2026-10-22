import { hasDesign, stations } from './area.ts';
import { CORD_RECIPE, DAUB_RECIPE, recipeById, SEAL_RECIPE, WEAVE_RECIPE } from './book.ts';
import {
  CLAMP_ID,
  CORD_WALK_ID,
  DAUB_PIT_ID,
  HEARTH_DESIGN_ID,
  LEAN_TO_ID,
  PIT_FIRING_ID,
  WEAVING_FRAME_ID,
} from './designs.ts';
import { landWorkById } from './landWorks.ts';
import type { RecipeId } from './recipe.ts';
import type { DesignId, ItemType, Settlement } from './types.ts';

export type StepKind = 'rig' | 'recipe' | 'site' | 'build' | 'sense';

export const AGES = [
  'Hands',
  'Mud and fibre',
  'Fire',
  'The axe',
  'Clay houses',
] as const;

export type Age = (typeof AGES)[number];

export interface Step {
  n: number;
  age: Age;
  label: string;
  kind: StepKind;
  after: readonly number[];
  afterAny?: readonly number[];
  work?: string;
  design?: DesignId;
  recipe?: RecipeId;
}

export const STEPS: readonly Step[] = [
  { n: 1, age: 'Hands', label: 'Fireplace', kind: 'rig', after: [] },
  { n: 2, age: 'Hands', label: 'Forage camp', kind: 'site', after: [1], work: 'forage-camp' },
  { n: 6, age: 'Hands', label: 'Bank dig', kind: 'site', after: [1], work: 'bank-dig' },

  { n: 6.5, age: 'Mud and fibre', label: 'Reed bed', kind: 'site', after: [6], work: 'reed-bed' },
  { n: 6.6, age: 'Mud and fibre', label: 'Fibre patch', kind: 'site', after: [6], work: 'fibre-patch' },
  { n: 7, age: 'Mud and fibre', label: 'Cord walk', kind: 'rig', after: [6], afterAny: [6.5, 6.6], design: CORD_WALK_ID, recipe: CORD_RECIPE },
  { n: 8, age: 'Mud and fibre', label: 'Weaving frame', kind: 'rig', after: [7], design: WEAVING_FRAME_ID, recipe: WEAVE_RECIPE },
  { n: 9, age: 'Mud and fibre', label: 'Daub pit', kind: 'rig', after: [6], afterAny: [6.5, 6.6], design: DAUB_PIT_ID, recipe: DAUB_RECIPE },
  { n: 10, age: 'Mud and fibre', label: 'Sealing', kind: 'recipe', after: [8, 9], recipe: SEAL_RECIPE },
  { n: 11, age: 'Mud and fibre', label: 'Water hole', kind: 'site', after: [10], work: 'well' },
  { n: 13, age: 'Mud and fibre', label: 'Lean-to', kind: 'build', after: [10], design: LEAN_TO_ID },

  { n: 14, age: 'Fire', label: 'Pit firing', kind: 'rig', after: [13], design: PIT_FIRING_ID },
  { n: 15, age: 'Fire', label: 'Clay pit', kind: 'site', after: [13], work: 'clay-pit' },
  { n: 17, age: 'Fire', label: 'Charcoal clamp', kind: 'rig', after: [14], design: CLAMP_ID },

  { n: 12.5, age: 'Mud and fibre', label: 'Dig site', kind: 'site', after: [12], work: 'digging' },
  { n: 23.5, age: 'The axe', label: 'Woodcutter', kind: 'site', after: [23], work: 'woodcutter' },
];

function isDone(settlement: Settlement, step: Step): boolean {
  if (step.n === 1) return settlement.buildings.has(settlement.hearthId);

  if (step.design === undefined && step.work === undefined) {
    if (step.recipe === undefined) return false;
    for (const building of settlement.buildings.values()) {
      if (building.queue.some((line) => line.recipeId === step.recipe)) return true;
    }
    return false;
  }

  for (const building of settlement.buildings.values()) {
    if (step.work !== undefined && hasDesign(building, step.work)) return true;
    if (step.design !== undefined && hasDesign(building, step.design)) return true;
  }
  return false;
}

export interface Progress {
  done: Set<number>;
  open: Set<number>;
  age: Age;
}

const reached = new Map<string, { revision: number; progress: Progress }>();

export function chapterProgress(settlement: Settlement): Progress {
  const known = reached.get(settlement.id);
  if (known && known.revision === settlement.revision) return known.progress;
  const progress = walkChapter(settlement);
  reached.set(settlement.id, { revision: settlement.revision, progress });
  return progress;
}

function walkChapter(settlement: Settlement): Progress {
  const done = new Set<number>();
  for (const step of STEPS) if (isDone(settlement, step)) done.add(step.n);

  const open = new Set<number>();
  for (const step of STEPS) {
    if (done.has(step.n)) continue;
    if (!step.after.every((earlier) => done.has(earlier))) continue;
    if (step.afterAny && !step.afterAny.some((earlier) => done.has(earlier))) continue;
    open.add(step.n);
  }

  let age: Age = AGES[0];
  for (const step of STEPS) {
    if (done.has(step.n) && AGES.indexOf(step.age) > AGES.indexOf(age)) age = step.age;
  }

  return { done, open, age };
}

export function designOpen(settlement: Settlement, designId: DesignId): boolean {
  const progress = chapterProgress(settlement);
  const step = STEPS.find((entry) => entry.design === designId);
  return step !== undefined && (progress.open.has(step.n) || progress.done.has(step.n));
}

export function workOpen(settlement: Settlement, workId: string): boolean {
  const progress = chapterProgress(settlement);
  const step = STEPS.find((entry) => entry.work === workId);
  return step !== undefined && (progress.open.has(step.n) || progress.done.has(step.n));
}

export function learnRecipes(settlement: Settlement): RecipeId[] {
  const { done } = chapterProgress(settlement);
  const hearth = settlement.buildings.get(settlement.hearthId);
  const fire = hearth ? stations(hearth).find((station) => station.design.id === HEARTH_DESIGN_ID) : undefined;
  if (!hearth || !fire) return [];

  const learnt: RecipeId[] = [];
  for (const step of STEPS) {
    if (step.recipe === undefined || step.design !== undefined || step.work !== undefined) continue;
    if (done.has(step.n) || !step.after.every((earlier) => done.has(earlier))) continue;
    if (recipeById(settlement.book, step.recipe) === undefined) continue;
    hearth.queue.unshift({ recipeId: step.recipe, slot: fire.slot });
    learnt.push(step.recipe);
  }
  if (learnt.length > 0) settlement.revision += 1;
  return learnt;
}

export function openingItems(): ItemType[] {
  const items: ItemType[] = [];
  for (const step of STEPS) {
    if (step.work === undefined || !step.after.every((earlier) => earlier === 1)) continue;
    const work = landWorkById(step.work);
    if (work && !items.includes(work.item)) items.push(work.item);
  }
  return items;
}

export function nextSteps(settlement: Settlement): Step[] {
  const { open } = chapterProgress(settlement);
  return STEPS.filter((step) => open.has(step.n)).sort((a, b) => a.n - b.n);
}
