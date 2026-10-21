import { CHARGE_STEPS, methodById } from './book.ts';
import type { Book, Method, MethodId, ProcessId, RunSettings } from './book.ts';
import { blocksOf, depositHopper, hopperSpace, storedStock, withdraw } from './buildings.ts';
import { takeFromBlock } from './blocks.ts';
import { BlockKind } from './types.ts';
import { RIGS, char, envelopeOf, fire, glowOf } from './models/heat.ts';
import type { BuildParams, CharResult, FuelId, GlowStep, RigId } from './models/heat.ts';
import type { Building, ItemType as Item } from './types.ts';

/**
 * A rig: capital, as opposed to the book, which is knowledge.
 *
 * A physical thing on a works floor, built once from materials carried to its square. Its build
 * params are fixed in its masonry — flue height, wall thickness, chamber size, firebox — and
 * they set its envelope: the hottest it can ever get and the biggest batch it can hold. Changing
 * one means tearing it down.
 *
 * The queue is the third thing, and it is policy: an ordered list of methods, each with a stop
 * condition. A worker scans down it and takes the first that can run, which is how one fire
 * serves many purposes and how the town keeps working when a material runs out.
 */

/**
 * A charcoal clamp, which has no chamber and so no entry in `RIGS`.
 *
 * Its build params are the pile: how much wood it holds and how evenly it is stacked. The one
 * knob is the vent, and the banking sets it — kept nearly shut the pile smoulders cool and
 * gives a lot of half-burnt brands, opened it runs hot, gives proper charcoal, and gives less.
 *
 * Five billets rather than four, which is the document's own figure and is not arbitrary: at
 * four the pile gives 1.3 shut and 0.8 open, and both round to one. The grade still turned over
 * but the *amount* did not, so the whole of section 7's decision — better charcoal, and less of
 * it — never reached the player. A trade that rounds away is not a trade.
 */
export const CLAMP_BUILD = { wood: 5, billet: 0.45 };

/** Where each banking puts the clamp's vents. The same three settings, on a different knob. */
export const CLAMP_VENTS = [0.12, 0.4, 0.75] as const;

/**
 * What a design raises.
 *
 * A clamp is not one of `RIGS` and must not pretend to be: those four are chambers the document
 * fits ceilings for, and a pile cooking itself has no chamber at all. Keeping it out of `RigId`
 * is what stops `envelopeOf` ever being asked a question it cannot answer about one.
 */
export type RigSpecId = RigId | 'clamp';

export interface Rig {
  /** What was built here. The build params and the knobs come from it. */
  spec: RigSpecId;
  process: ProcessId;
  build: BuildParams;
  /** Declaration order is the scan order, so it is part of the trace. */
  queue: MethodId[];
  /**
   * How many may work it at once. A kiln has one chamber and takes one to two — a second stoker
   * speeds the climb but not the soak — where a knapping floor has room for three at three
   * different methods. Dispatch reads `crew.max` to decide whether another villager may go in.
   */
  crew: { min: number; max: number };
  /** The entry running now and how far into its batch. Null when nothing in the queue can run. */
  running: { methodId: MethodId; progress: number } | null;
  /** The entry last run here, which is what the next one is charged a changeover against. */
  last?: MethodId;
  /**
   * Ticks of changeover still owed. Switching a fire rig from one method to another means the
   * fire comes down and goes back up, which is what pushes the player into firing campaigns —
   * all the lime, then all the brick, the way kilns were actually run.
   */
  changeover: number;
}

/** A fire rig's changeover. On a knapping floor this is zero: you just pick up a different core. */
export const CHANGEOVER_TICKS = 45;

/**
 * What a rig has to hand, which is its doors *and* its bins.
 *
 * Carriers leave a load at the door cut for it, and a door is a terminus — nothing inside the
 * building moves it on. Reading only the bins, as this did, meant the first eight loads of clay
 * delivered to a pit firing sat in its clay door while the rig reported "no Clay" for ever.
 */
export function heldFor(building: Building, item: Item): number {
  let held = 0;
  for (const { block, state } of blocksOf(building)) {
    if (block.kind === BlockKind.Input && block.item === item) held += state.held?.amount ?? 0;
    if (block.kind === BlockKind.Storage && state.held?.item === item) held += state.held.amount;
  }
  return held;
}

/** Take a batch's worth: out of the doors first, since that is where it was left. */
function takeForRig(building: Building, item: Item, amount: number): number {
  let left = amount;
  for (const { block, state } of blocksOf(building)) {
    if (left <= 0) break;
    if (block.kind !== BlockKind.Input || block.item !== item) continue;
    left -= takeFromBlock(state, left);
  }
  return amount - left + withdraw(building, item, left);
}

export function createRig(spec: RigSpecId, queue: MethodId[] = []): Rig {
  return {
    spec,
    process: spec === 'clamp' ? 'char' : 'fire',
    // A clamp's masonry is its pile, which `CLAMP_BUILD` holds; it has no chamber to describe.
    build: spec === 'clamp' ? { vent: 1, flue: 0, wall: 1, chamber: 1, maxRate: 0 } : { ...RIGS[spec].build },
    queue: [...queue],
    crew: { min: 1, max: spec === 'clamp' ? 3 : 2 },
    running: null,
    changeover: 0,
  };
}

export function cloneRig(rig: Rig): Rig {
  return {
    spec: rig.spec,
    process: rig.process,
    build: { ...rig.build },
    queue: [...rig.queue],
    crew: { ...rig.crew },
    running: rig.running ? { ...rig.running } : null,
    changeover: rig.changeover,
    ...(rig.last !== undefined ? { last: rig.last } : {}),
  };
}

/** The hottest this masonry can ever be driven, whatever is written in the book. */
export function ceilingOf(rig: Rig): number {
  // A pile cooking itself has no chamber to hold heat in, so what it reaches is what its vents
  // let it reach — and nothing is ever *fired* in a clamp, so nothing asks this of one.
  if (rig.spec === 'clamp') return char({ ...CLAMP_BUILD, vent: CLAMP_VENTS[2] }).T;
  return envelopeOf({ ...RIGS[rig.spec], build: rig.build }).T;
}

/** What the chamber is doing right now, at the settings of whatever is running in it. */
export function heatOf(rig: Rig, book: Book): { T: number; glow: GlowStep; starved: boolean } {
  const method = rig.running ? methodById(book, rig.running.methodId) : undefined;
  if (!method) return { T: 20, glow: glowOf(20), starved: false };
  if (rig.spec === 'clamp') {
    const pile = charOf(method);
    return { T: pile.T, glow: glowOf(pile.T), starved: pile.grade === 'brands' };
  }
  const out = fire({ ...rig.build, ...runToFire(method.run) });
  return { T: out.T, glow: out.glow, starved: out.starved };
}

/** A method's settings as the heat model wants them. */
export function runToFire(run: RunSettings): { fuel: FuelId; damper: number; fuelRate: number } {
  const step = CHARGE_STEPS[Math.min(Math.max(0, run.charge), CHARGE_STEPS.length - 1)];
  return {
    fuel: run.fuel ?? 'wood',
    damper: run.damper ?? 1,
    fuelRate: step ? step.rate : 1,
  };
}

/**
 * How long one batch takes here. Stoking harder shortens it, and that is the whole of the
 * hearth's one knob: how fast deadwood becomes embers, and how fast the woodpile goes.
 *
 * Against the burn rather than against the setting, so the firebox is read: a rig charged past
 * what its box can hold burns no faster, which is what stops every rig being stoked to the same
 * output and build params meaning nothing.
 */
export function batchTicks(rig: Rig, method: Method): number {
  if (rig.process === 'char') {
    // A clamp is timed by its own model: the wider the vents, the faster the pile cooks itself.
    return Math.max(1, Math.round(charOf(method).minutes * (method.ticks / 12)));
  }
  const out = fire({ ...rig.build, ...runToFire(method.run) });
  return Math.max(1, Math.round(method.ticks / Math.max(0.05, out.burn)));
}

/** What the pile gives at this method's banking. */
export function charOf(method: Method): CharResult {
  const step = Math.min(Math.max(0, method.run.charge), CLAMP_VENTS.length - 1);
  return char({ ...CLAMP_BUILD, vent: CLAMP_VENTS[step] ?? CLAMP_VENTS[1] });
}

/**
 * What a batch actually yields.
 *
 * For a fire this is what the method says. For a clamp it is not: the vent decides the grade
 * as well as the amount, so a method asking for charcoal and run with the vents nearly shut
 * gives brands instead — which is the whole of the clamp's decision, and the reason a lazy
 * clamp quietly lowers the ceiling of every kiln in town.
 */
export function yieldOf(rig: Rig, method: Method): { item: Item; amount: number }[] {
  if (rig.process !== 'char') return method.outputs;
  const pile = charOf(method);
  const item: Item = pile.grade === 'brands' ? 'Brands' : 'Charcoal';
  return [{ item, amount: Math.max(1, Math.round(pile.charcoal)) }];
}

export type RefusalKind = 'unknown' | 'wrong-process' | 'envelope' | 'inputs' | 'full' | 'done';

export interface Refusal {
  methodId: MethodId;
  kind: RefusalKind;
  /** Plain words, because a rig that refuses silently is the bug this layer exists to avoid. */
  why: string;
}

export interface Scan {
  method: Method | null;
  /** Why each entry above the chosen one was passed over. The book's own error messages. */
  refused: Refusal[];
}

/**
 * Scan the queue and take the first entry that can run.
 *
 * In declaration order, always, so the same world replays identically. An entry is passed over
 * when its inputs are not here, when the stock it makes is already up to its target, when there
 * is nowhere to put what it would make, or when the rig cannot get hot enough for it — and the
 * last of those is the point of keeping the method and the rig apart. Falling through to the
 * next entry is how the kiln drops to the wood method when the charcoal runs out and keeps
 * working at a lower grade instead of stopping.
 */
export function scanQueue(rig: Rig, book: Book, building: Building): Scan {
  const refused: Refusal[] = [];
  const ceiling = ceilingOf(rig);

  for (const methodId of rig.queue) {
    const method = methodById(book, methodId);
    if (!method) {
      refused.push({ methodId, kind: 'unknown', why: 'nothing in the book by that name' });
      continue;
    }
    if (method.process !== rig.process) {
      refused.push({ methodId, kind: 'wrong-process', why: 'not a method for this kind of rig' });
      continue;
    }
    if (method.needsHeat !== undefined && method.needsHeat > ceiling) {
      refused.push({
        methodId,
        kind: 'envelope',
        why: `needs ${glowOf(method.needsHeat).name}; this rig tops out at ${glowOf(ceiling).name}`,
      });
      continue;
    }
    const short = method.inputs.find((input) => heldFor(building, input.item) < input.amount);
    if (short) {
      refused.push({ methodId, kind: 'inputs', why: `no ${short.item}` });
      continue;
    }
    if (method.until && storedStock(building, method.until.item) >= method.until.target) {
      refused.push({ methodId, kind: 'done', why: `${method.until.item} is up to the mark` });
      continue;
    }
    // Against what the pile would actually give, not what the method asked for: a clamp with
    // its vents shut yields brands, and refusing it for having "nowhere to put the Charcoal"
    // while it stands in front of eight brands names an item that was never coming out.
    const nowhere = yieldOf(rig, method).find(
      (output) => hopperSpace(building, output.item) < output.amount,
    );
    if (nowhere) {
      refused.push({ methodId, kind: 'full', why: `nowhere to put the ${nowhere.item}` });
      continue;
    }
    return { method, refused };
  }

  return { method: null, refused };
}

export interface RigOutcome {
  /** What came out of the chamber this tick, if a batch finished. */
  produced: { item: Item; amount: number }[];
  /** The entry running after this tick, for anything that wants to say what the rig is doing. */
  running: MethodId | null;
  changingOver: boolean;
}


/**
 * One tick of a rig.
 *
 * A batch under way is never rescanned. Its inputs were taken when it began — so a carrier
 * cannot walk off with what it is about to use, the same reason a combine block empties its
 * hoppers at the start — and asking the queue again mid-batch would find those very inputs
 * missing, refuse the entry that is running, and abandon the batch with the goods already gone.
 * The scan belongs between batches and nowhere else.
 */
export function runRig(building: Building, book: Book, manned: boolean): RigOutcome {
  const rig = building.rig;
  const idle: RigOutcome = { produced: [], running: null, changingOver: false };
  if (!rig) return idle;
  // A site still being cleared is not a rig yet, and a works being re-tooled is stopped.
  if (building.clearing || building.retooling > 0) return idle;
  // And nothing works itself. A fire wants stoking and a pile wants watching, and the hours
  // that takes come out of the same day as everything else (`needs.ts`) — without this, making
  // things was free and the only thing the chapter's hour budget priced was carrying.
  if (!manned) return idle;

  if (rig.changeover > 0) {
    rig.changeover -= 1;
    return { produced: [], running: null, changingOver: true };
  }

  if (!rig.running && !begin(rig, book, building)) return idle;

  const running = rig.running;
  const method = running ? methodById(book, running.methodId) : undefined;
  if (!running || !method) {
    rig.running = null;
    return idle;
  }

  running.progress += 1;
  if (running.progress < batchTicks(rig, method)) {
    return { produced: [], running: method.id, changingOver: false };
  }

  const produced: { item: Item; amount: number }[] = [];
  // The envelope said the rig *could* get hot enough; this asks whether it actually did.
  // Banked low a pit firing sits under ceramic and the clay comes back out as dried mud — the
  // inputs are gone either way, because they went into the fire. That is the whole lesson the
  // ordinal knob teaches, and without this the three bankings all made the same pots.
  const short = method.needsHeat !== undefined && heatOf(rig, book).T < method.needsHeat;
  for (const output of short ? [] : yieldOf(rig, method)) {
    const placed = depositHopper(building, output.item, output.amount);
    if (placed > 0) produced.push({ item: output.item, amount: placed });
  }
  building.producedTotal += produced.reduce((sum, entry) => sum + entry.amount, 0);
  rig.running = null;
  rig.last = method.id;

  const next = begin(rig, book, building) ? method.id : null;
  return { produced, running: next, changingOver: rig.changeover > 0 };
}

/**
 * Take the next entry off the queue, if one can run.
 *
 * Switching to a different entry than the one last run costs a changeover on a fire rig: the
 * fire comes down and goes back up. That one number is what pushes the player into firing
 * campaigns — all the lime, then all the brick, the way kilns were actually run — so a run of
 * the same entry pays nothing against itself.
 */
function begin(rig: Rig, book: Book, building: Building): boolean {
  const chosen = scanQueue(rig, book, building).method;
  if (!chosen) return false;

  if (rig.last !== undefined && rig.last !== chosen.id) {
    rig.changeover = CHANGEOVER_TICKS;
    rig.last = chosen.id;
    return false;
  }

  for (const input of chosen.inputs) takeForRig(building, input.item, input.amount);
  rig.last = chosen.id;
  rig.running = { methodId: chosen.id, progress: 0 };
  return true;
}
