import { CHARGE_STEPS, methodById } from './book.ts';
import type { Book, Method, MethodId, ProcessId, RunSettings } from './book.ts';
import { depositHopper, roomFor, storedStock, withdraw } from './buildings.ts';
import { AMBIENT, RIGS, char, envelopeOf, fire, glowOf } from './models/heat.ts';
import type { BuildParams, CharResult, FuelId, GlowStep, RigId } from './models/heat.ts';
import type { Building, ItemType as Item } from './types.ts';

export const CLAMP_BUILD = { wood: 5, billet: 0.45 };

export const CLAMP_VENTS = [0.12, 0.4, 0.75] as const;

export type RigSpecId = RigId | 'clamp' | 'cordWalk' | 'weavingFrame' | 'daubPit';

export type HandRigId = 'cordWalk' | 'weavingFrame' | 'daubPit';

const HAND_RIGS: readonly HandRigId[] = ['cordWalk', 'weavingFrame', 'daubPit'];

export function isHandRig(spec: RigSpecId): spec is HandRigId {
  return (HAND_RIGS as readonly RigSpecId[]).includes(spec);
}

export interface Rig {
  spec: RigSpecId;
  process: ProcessId;
  build: BuildParams;
  crew: { min: number; max: number };
  running: { methodId: MethodId; progress: number } | null;
  last?: MethodId;
  changeover: number;
  warm?: true;
}

export const WARM_WALL = 1.3;

export function heldBuild(rig: Rig): BuildParams {
  return rig.warm ? { ...rig.build, wall: rig.build.wall * WARM_WALL } : rig.build;
}

export const CHANGEOVER_TICKS = 45;

export const TICKS_PER_SECOND = 10;

export function linesFor(building: Building, slot: number): MethodId[] {
  return building.queue.filter((line) => line.slot === slot).map((line) => line.methodId);
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
  const method = rig.running ? methodById(book, rig.running.methodId) : undefined;
  if (!method || isHandRig(rig.spec)) return { T: AMBIENT, glow: glowOf(AMBIENT), starved: false };
  if (rig.spec === 'clamp') {
    const pile = charOf(method);
    return { T: pile.T, glow: glowOf(pile.T), starved: pile.grade === 'brands' };
  }
  const out = fire({ ...heldBuild(rig), ...runToFire(method.run) });
  return { T: out.T, glow: out.glow, starved: out.starved };
}

export function runToFire(run: RunSettings): { fuel: FuelId; damper: number; fuelRate: number } {
  const step = CHARGE_STEPS[Math.min(Math.max(0, run.charge), CHARGE_STEPS.length - 1)];
  return {
    fuel: run.fuel ?? 'wood',
    damper: run.damper ?? 1,
    fuelRate: step ? step.rate : 1,
  };
}

export function batchTicks(rig: Rig, method: Method): number {
  if (rig.process === 'hand') return Math.max(1, method.ticks);
  if (rig.process === 'char') {
    return Math.max(1, Math.round(charOf(method).minutes * (method.ticks / 12)));
  }
  const out = fire({ ...heldBuild(rig), ...runToFire(method.run) });
  return Math.max(1, Math.round(method.ticks / Math.max(0.05, out.burn)));
}

export function costOf(rig: Rig, method: Method): { item: Item; amount: number }[] {
  if (rig.process !== 'fire') return method.inputs;
  const step = CHARGE_STEPS[Math.min(Math.max(0, method.run.charge), CHARGE_STEPS.length - 1)];
  const rate = step ? step.rate : 1;
  return method.inputs.map((input) => ({
    item: input.item,
    amount: Math.max(1, Math.round(input.amount * rate)),
  }));
}

export function affordableBankings(rig: Rig, method: Method, building: Building): boolean[] {
  return CHARGE_STEPS.map((_, charge) =>
    costOf(rig, { ...method, run: { ...method.run, charge } }).every(
      (input) => heldFor(building, input.item) >= input.amount,
    ),
  );
}

export function charOf(method: Method): CharResult {
  const step = Math.min(Math.max(0, method.run.charge), CLAMP_VENTS.length - 1);
  return char({ ...CLAMP_BUILD, vent: CLAMP_VENTS[step] ?? CLAMP_VENTS[1] });
}

export function yieldOf(rig: Rig, method: Method): { item: Item; amount: number }[] {
  if (rig.process !== 'char') return method.outputs;
  const pile = charOf(method);
  const item: Item = pile.grade === 'brands' ? 'Brands' : 'Charcoal';
  return [{ item, amount: Math.max(1, Math.round(pile.charcoal)) }];
}

export type RefusalKind = 'unknown' | 'wrong-process' | 'envelope' | 'inputs' | 'full';

export interface Refusal {
  methodId: MethodId;
  kind: RefusalKind;
  why: string;
}

export interface Scan {
  method: Method | null;
  refused: Refusal[];
}

export function scanQueue(rig: Rig, book: Book, building: Building, slot: number): Scan {
  const refused: Refusal[] = [];
  const ceiling = ceilingOf(rig);

  for (const methodId of linesFor(building, slot)) {
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
    const short = costOf(rig, method).find((input) => heldFor(building, input.item) < input.amount);
    if (short) {
      refused.push({ methodId, kind: 'inputs', why: `no ${short.item}` });
      continue;
    }
    const nowhere = yieldOf(rig, method).find(
      (output) => roomFor(building, output.item) < output.amount,
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
  produced: { item: Item; amount: number }[];
  running: MethodId | null;
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
  const short = method.needsHeat !== undefined && heatOf(rig, book).T < method.needsHeat;
  for (const output of short ? [] : yieldOf(rig, method)) {
    const placed = depositHopper(building, output.item, output.amount);
    if (placed > 0) produced.push({ item: output.item, amount: placed });
  }
  building.producedTotal += produced.reduce((sum, entry) => sum + entry.amount, 0);
  rig.running = null;
  rig.last = method.id;

  const next = begin(rig, book, building, slot) ? method.id : null;
  return { produced, running: next, changingOver: rig.changeover > 0 };
}

function begin(rig: Rig, book: Book, building: Building, slot: number): boolean {
  const chosen = scanQueue(rig, book, building, slot).method;
  if (!chosen) return false;

  if (rig.last !== undefined && rig.last !== chosen.id && rig.process !== 'hand') {
    rig.changeover = CHANGEOVER_TICKS;
    rig.last = chosen.id;
    return false;
  }

  for (const input of costOf(rig, chosen)) withdraw(building, input.item, input.amount);
  rig.last = chosen.id;
  rig.running = { methodId: chosen.id, progress: 0 };
  return true;
}
