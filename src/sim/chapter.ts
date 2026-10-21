import { methodById } from './book.ts';
import type { MethodId } from './book.ts';
import { CLAMP_ID, CORD_WALK_ID, DAUB_PIT_ID, LEAN_TO_ID, PIT_FIRING_ID, WEAVING_FRAME_ID } from './designs.ts';
import { CORD_METHOD, DAUB_METHOD, SEAL_METHOD, WEAVE_METHOD } from './book.ts';
import type { DesignId, Settlement } from './types.ts';

/**
 * The chapter, as a spine.
 *
 * Twenty-seven steps over five ages, and the order is the game: a town opens with its fire and
 * nothing else, and everything it can build next is something the step before it earned. Without
 * this the whole chapter is on the bar at minute zero, which is not a slow version of the game —
 * it is a different one, with no opening and nothing to find out.
 *
 * **Derived, never stored.** A step is *done* when the thing it gives is standing or written
 * down, and *open* when everything it follows from is done — the same rule `claims.ts` keeps, and
 * for the same reason: a flag saved beside the world is a second copy of an answer the world
 * already holds, and the two disagree the first time anything is razed.
 *
 * **No nodes and no points.** A step opens because the town can actually do it, not because a
 * counter reached a number. The only other unlock in the design is the book naming a technique
 * once its rows show a pattern (`book.ts`), which is evidence rather than a purchase.
 */

export type StepKind = 'rig' | 'method' | 'site' | 'build' | 'sense';

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
  /** The steps this follows from. Empty means it opens with the town. */
  after: readonly number[];
  /** The land work this step sites, if it sites one. */
  work?: string;
  /** The design this step raises, if it raises one. */
  design?: DesignId;
  /** The method this step writes into the book, if it writes one. */
  method?: MethodId;
}

/**
 * The steps that are built. The document lists twenty-seven; these are the ones that exist as
 * things in the game, and the numbers are the document's own so the two can be read side by side.
 *
 * Three buildings predate the chapter and are not steps in it — the woodcutter, the dig and the
 * well. They are slotted where the chapter first needs what they give rather than being left on
 * the bar from the start: gathering deadwood is Age I work, earth is not wanted until there is
 * something to mix it into, and a well *is* step 11, the water hole, which is the biggest single
 * hour-saving there is.
 */
export const STEPS: readonly Step[] = [
  { n: 1, age: 'Hands', label: 'Hearth', kind: 'rig', after: [] },
  // The chapter's forage camp is where the band brings things back to; until there is a camp to
  // build, gathering deadwood is the Age I site, and the fire wants it from the first minute.
  { n: 2, age: 'Hands', label: 'Woodcutter', kind: 'site', after: [1], work: 'woodcutter' },
  { n: 6, age: 'Hands', label: 'Bank dig', kind: 'site', after: [1], work: 'bank-dig' },

  { n: 7, age: 'Mud and fibre', label: 'Reed bed', kind: 'site', after: [6], work: 'reed-bed' },
  { n: 7.5, age: 'Mud and fibre', label: 'Cord walk', kind: 'rig', after: [7], design: CORD_WALK_ID, method: CORD_METHOD },
  { n: 8, age: 'Mud and fibre', label: 'Weaving frame', kind: 'rig', after: [7.5], design: WEAVING_FRAME_ID, method: WEAVE_METHOD },
  { n: 9, age: 'Mud and fibre', label: 'Daub pit', kind: 'rig', after: [7], design: DAUB_PIT_ID, method: DAUB_METHOD },
  { n: 10, age: 'Mud and fibre', label: 'Sealing', kind: 'method', after: [8, 9], method: SEAL_METHOD },
  { n: 11, age: 'Mud and fibre', label: 'Water hole', kind: 'site', after: [10], work: 'well' },
  { n: 12, age: 'Mud and fibre', label: 'Dig site', kind: 'site', after: [10], work: 'digging' },
  { n: 13, age: 'Mud and fibre', label: 'Lean-to', kind: 'build', after: [10], design: LEAN_TO_ID },

  { n: 14, age: 'Fire', label: 'Pit firing', kind: 'rig', after: [13], design: PIT_FIRING_ID },
  { n: 15, age: 'Fire', label: 'Clay pit', kind: 'site', after: [13], work: 'clay-pit' },
  { n: 17, age: 'Fire', label: 'Charcoal clamp', kind: 'rig', after: [14], design: CLAMP_ID },
];

export const stepFor = (n: number): Step | undefined => STEPS.find((step) => step.n === n);

/**
 * What the town has actually done.
 *
 * A site or a rig is done when one is standing — including one still being cleared, since the
 * decision was taken the moment it was placed and a step that un-opened while its building was
 * being dug would take the next one off the bar again. A method is done when it has a rig to run
 * on, which is what writing it into the book means here.
 */
function isDone(settlement: Settlement, step: Step): boolean {
  if (step.n === 1) return settlement.buildings.has(settlement.hearthId);

  // A method with no rig of its own — sealing lives on the fire the town already has — is done
  // once it is on a queue. That is the only sense in which a town has taken a recipe up, and it
  // is why the hearth is founded knowing how to bank a fire and nothing else: a method the town
  // was born with is not a step it took.
  if (step.design === undefined && step.work === undefined) {
    if (step.method === undefined) return false;
    for (const building of settlement.buildings.values()) {
      if (building.rig?.queue.includes(step.method)) return true;
    }
    return false;
  }

  for (const building of settlement.buildings.values()) {
    if (step.work !== undefined && building.designId === step.work) return true;
    if (step.design !== undefined && building.designId === step.design) return true;
  }
  return false;
}

export interface Progress {
  done: Set<number>;
  open: Set<number>;
  age: Age;
}

/** Where the town has got to. Worked out from what is standing, on every call. */
export function chapterProgress(settlement: Settlement): Progress {
  const done = new Set<number>();
  for (const step of STEPS) if (isDone(settlement, step)) done.add(step.n);

  const open = new Set<number>();
  for (const step of STEPS) {
    if (done.has(step.n)) continue;
    if (step.after.every((earlier) => done.has(earlier))) open.add(step.n);
  }

  // The age a town is in is the newest one it has finished anything in — the map's mark and the
  // ledger's surface already turn over on building count, and this is the chapter's own measure.
  let age: Age = AGES[0];
  for (const step of STEPS) if (done.has(step.n)) age = step.age;

  return { done, open, age };
}

/** Whether the town may raise this design yet. Anything not in the chapter at all is refused. */
export function designOpen(settlement: Settlement, designId: DesignId): boolean {
  const progress = chapterProgress(settlement);
  const step = STEPS.find((entry) => entry.design === designId);
  return step !== undefined && (progress.open.has(step.n) || progress.done.has(step.n));
}

/** Whether the town may site this land work yet. */
export function workOpen(settlement: Settlement, workId: string): boolean {
  const progress = chapterProgress(settlement);
  const step = STEPS.find((entry) => entry.work === workId);
  return step !== undefined && (progress.open.has(step.n) || progress.done.has(step.n));
}

/**
 * Write up any recipe the town has just earned.
 *
 * A step of kind `method` is "a new recipe for a rig you already have", so there is nothing to
 * raise and nothing for the player to click: the moment the steps it follows from are done, the
 * town knows it, and it goes on the fire's queue above the method it supersedes. Called wherever
 * the shape of the settlement changes, beside `staffSettlement`, since that is exactly when a
 * step can have become done.
 */
export function learnMethods(settlement: Settlement): MethodId[] {
  const { done } = chapterProgress(settlement);
  const hearth = settlement.buildings.get(settlement.hearthId);
  if (!hearth?.rig) return [];

  const learnt: MethodId[] = [];
  for (const step of STEPS) {
    if (step.method === undefined || step.design !== undefined || step.work !== undefined) continue;
    if (done.has(step.n) || !step.after.every((earlier) => done.has(earlier))) continue;
    if (methodById(settlement.book, step.method) === undefined) continue;
    // At the head, because a recipe the town has just worked out is the one it wants running.
    hearth.rig.queue.unshift(step.method);
    learnt.push(step.method);
  }
  return learnt;
}

/** What the town could do next, in order, for the ledger to say so in one line. */
export function nextSteps(settlement: Settlement): Step[] {
  const { open } = chapterProgress(settlement);
  return STEPS.filter((step) => open.has(step.n)).sort((a, b) => a.n - b.n);
}
