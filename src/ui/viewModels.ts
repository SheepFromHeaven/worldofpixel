import { CHARGE_STEADY, CHARGE_STEPS, methodById } from '../sim/book.ts';
import type { MethodId } from '../sim/book.ts';
import { CHIMNEY, STAGES, bedsIn, capacityOf, firstStation, groundSlots, groundWork, nextStage, shelteredArea, stations, workAt } from '../sim/area.ts';
import { labelOf } from '../sim/buildings.ts';
import { STEPS, designOpen, workOpen } from '../sim/chapter.ts';
import { canBuild } from '../sim/construction.ts';
import { HEARTH_DESIGN_ID } from '../sim/designs.ts';
import type { LandWork } from '../sim/landWorks.ts';
import { landWorkById, poolOf } from '../sim/landWorks.ts';
import { DAY_HOURS, DAY_TICKS, dayOf, vesselsHeld } from '../sim/needs.ts';
import { TICKS_PER_SECOND, affordableBankings, batchTicks, costOf, heldFor, linesFor, scanQueue, yieldOf } from '../sim/process.ts';
import type { Rig, Scan } from '../sim/process.ts';
import { totalHeld } from '../sim/stock.ts';
import { nearestWater } from '../sim/terrain.ts';
import { CarrierState, ItemType } from '../sim/types.ts';
import type { Building, BuildingId, Design, Settlement } from '../sim/types.ts';
import type { GameWorld } from '../sim/world.ts';
import type { Vec2 } from '../sim/geometry.ts';
import type { AreaView, Choice, ListLine, Raise, SlotView } from './areaView.ts';
import { designIcon } from './designIcons.ts';
import type { Batch, FireView, Standing } from './rigView.ts';
import type { StripView } from './shellView.ts';
import { DAY_PARTS } from './townView.ts';
import type { DayHours, DayPart, StandingIn, TownView } from './townView.ts';

/*
 * Plain-data views of the simulation for the panels to draw. Everything here is a pure function
 * of the world: `game.ts` decides what is open and calls these on every publish.
 */

/** Where the settlement has got to, so the ledger can say what the next move is. */
export interface Progress {
  buildings: number;
  drawsWater: boolean;
  combines: boolean;
  kept: number;
  /** Which way the nearest fresh water lies from the fire, while nothing is drawing it yet. */
  water: string | null;
}

/** What is standing in a building: a line an item, in arrival order. */
export function standingIn(building: Building): Standing {
  return [...building.stock].filter(([, amount]) => amount > 0);
}

/** A land work's shift as a batch. How far through it is comes off the villager inside. */
function shiftOf(work: LandWork, settlement: Settlement, buildingId: BuildingId, slot: number, recipe: number): Batch {
  let progress = 0;
  for (const carrier of settlement.carriers.values()) {
    if (carrier.state !== CarrierState.Working || carrier.atId !== buildingId) continue;
    if (carrier.job?.kind === 'work' && (carrier.job.slot ?? 0) !== slot) continue;
    progress = Math.max(0, Math.min(1, (work.ticks - carrier.handling) / work.ticks));
  }
  const pool = poolOf(work, recipe);
  return {
    uses: [],
    makes: [{ item: pool?.[0]?.item ?? work.item, amount: work.batch }],
    seconds: work.ticks / TICKS_PER_SECOND,
    progress,
    ...(work.pool ? { pool: (pool ?? work.pool).map((entry) => ({ ...entry })) } : {}),
  };
}

/** Everything the town could put in an empty slot, with whether it fits and why not. */
function choicesFor(world: GameWorld, area: Building, settlement: Settlement): Choice[] {
  const designs: Design[] = STEPS.flatMap((step) => {
    const work = step.work ? landWorkById(step.work) : undefined;
    if (work) return workOpen(settlement, work.design.id) ? [work.design] : [];
    const design = step.design ? world.library.get(step.design) : undefined;
    return design && designOpen(settlement, design.id) ? [design] : [];
  });
  return designs.map((design) => {
    const check = canBuild(world, settlement, area.cellId, design);
    return { designId: design.id, icon: designIcon(design.id), label: design.label, ok: check.ok, reason: check.reason };
  });
}

/**
 * The method a station's strip is about: the one running, else the one the scan would take
 * next, else the head of its list. Reading and setting the banking both use this, so they
 * cannot disagree about which method a press retunes.
 */
export function shownMethod(rig: Rig, scan: Scan, lines: readonly MethodId[]): MethodId | null {
  return rig.running?.methodId ?? scan.method?.id ?? lines[0] ?? null;
}

/** The banking strip of one station: which fire is set and which the town can pay for. */
export function fireViewOf(area: Building, slot: number, rig: Rig, settlement: Settlement): FireView {
  const lines = linesFor(area, slot);
  const scan = scanQueue(rig, settlement.book, area, slot);
  const id = shownMethod(rig, scan, lines);
  const shown = id ? methodById(settlement.book, id) : undefined;
  return {
    process: rig.process,
    charge: shown?.run.charge ?? CHARGE_STEADY,
    affordable: shown ? affordableBankings(rig, shown, area) : CHARGE_STEPS.map(() => true),
    changingOver: rig.changeover > 0,
  };
}

/** The open area's rail: its slots, its list, what the open slot offers, and its shelf. */
export function areaViewOf(
  world: GameWorld,
  area: Building,
  settlement: Settlement,
  open: number | null,
  panel: FireView | null,
): AreaView {
  const book = settlement.book;

  const working = new Set<number>();
  for (const carrier of settlement.carriers.values()) {
    if (carrier.state === CarrierState.Working && carrier.atId === area.id) working.add(carrier.job?.slot ?? 0);
  }
  const slots: SlotView[] = area.slots.map((slot, index) => ({
    icon: slot.design ? designIcon(slot.design.id) : null,
    label: slot.design?.label ?? null,
    station: slot.rig !== null,
    busy: slot.rig?.running ? true : working.has(index),
    blocked: false,
    removable: slot.design !== null && slot.design.id !== HEARTH_DESIGN_ID && slot.design.id !== CHIMNEY.id,
  }));

  const next = nextStage(area);
  const locked = next ? Array.from({ length: next.slots - area.slots.length }, () => ({ stage: next.name })) : [];

  const list: ListLine[] = [];
  for (const { slot, rig, design } of stations(area)) {
    const scan = scanQueue(rig, book, area, slot);
    const refusals = new Map(scan.refused.map((refusal) => [refusal.methodId, refusal]));
    const running = rig.running?.methodId ?? null;
    const mine: ListLine[] = [];
    for (const id of linesFor(area, slot)) {
      const method = methodById(book, id);
      const refusal = refusals.get(id);
      const short =
        refusal?.kind === 'inputs' && method
          ? (costOf(rig, method).find((input) => heldFor(area, input.item) < input.amount)?.item ?? null)
          : null;
      mine.push({
        id,
        slot,
        icon: designIcon(design.id),
        label: method?.label ?? id,
        uses: method ? costOf(rig, method) : [],
        makes: method ? yieldOf(rig, method) : [],
        seconds: method ? batchTicks(rig, method) / TICKS_PER_SECOND : 0,
        running: id === running,
        progress: method && running === id && rig.running ? rig.running.progress / batchTicks(rig, method) : 0,
        refusal: refusal?.kind ?? null,
        why: refusal?.why ?? '',
        short,
      });
    }
    list.push(...mine);
    const held = slots[slot];
    if (held) held.blocked = mine.length > 0 && mine.every((line) => line.short !== null) && !held.busy;
  }
  const order = new Map(area.queue.map((line, index) => [`${line.methodId}@${line.slot}`, index]));
  list.sort((a, b) => (order.get(`${a.id}@${a.slot}`) ?? 0) - (order.get(`${b.id}@${b.slot}`) ?? 0));

  const grounds = area.clearing
    ? []
    : groundSlots(area).flatMap((index) => {
        const work = workAt(area, index);
        if (!work) return [];
        const recipe = area.slots[index]?.recipe ?? 0;
        return [
          {
            ...shiftOf(work, settlement, area.id, index, recipe),
            icon: designIcon(work.design.id),
            slot: index,
            recipe,
            recipes: (work.pools ?? (work.pool ? [work.pool] : [])).map((pool) => pool.map((entry) => ({ ...entry }))),
          },
        ];
      });

  const openSlot = open !== null ? area.slots[open] : undefined;
  const choices = openSlot && !openSlot.design ? choicesFor(world, area, settlement) : null;

  const raising = area.raising;
  const stage = raising ? STAGES[raising.to] : next;
  const raise: Raise | null = stage
    ? {
        name: stage.name,
        slots: stage.slots,
        cost: stage.cost.map((cost) => ({ ...cost, have: Math.min(cost.amount, area.stock.get(cost.item) ?? 0) })),
        ordered: raising !== undefined,
        ...(stage.roofed ? { takes: 'no sun to dry in' } : {}),
        ...(stage.chimney ? { takes: 'one lot goes to the chimney' } : {}),
        progress: raising && raising.needed > 0 ? raising.done / raising.needed : 0,
      }
    : null;

  return {
    buildingId: area.id,
    stage: area.stage,
    stages: STAGES.length,
    slots,
    locked,
    open,
    list,
    grounds,
    shelf: standingIn(area),
    capacity: capacityOf(area),
    panel,
    choices,
    raise,
    state: area.clearing ? 'being cleared' : null,
  };
}

/**
 * A villager's day in whole hours, coming to fourteen exactly: the remainders are shared out
 * largest first so the drawing never has a notch missing, ties going to the earlier part of the day.
 */
function dayHours(day: Record<DayPart, number>): DayHours[] {
  const parts = DAY_PARTS.map((part) => {
    const exact = day[part];
    return { part, hours: Math.floor(exact), rest: exact - Math.floor(exact) };
  });

  let left = DAY_HOURS - parts.reduce((total, part) => total + part.hours, 0);
  for (const part of [...parts].sort((a, b) => b.rest - a.rest)) {
    if (left <= 0) break;
    part.hours += 1;
    left -= 1;
  }

  return parts.map(({ part, hours }): DayHours => ({ part, hours }));
}

/** The town as it can see itself: who is here, how their day goes, and what is lying about. */
export function townViewOf(settlement: Settlement): TownView {
  const day = dayOf(settlement);
  const people = settlement.carriers.size;
  let roofed = 0;
  for (const building of settlement.buildings.values()) {
    if (!building.clearing && shelteredArea(building)) roofed += bedsIn(building);
  }
  const hearth = settlement.buildings.get(settlement.hearthId);
  const standing: StandingIn[] = [];
  // The store first, then the rest in the order they were raised.
  for (const building of settlement.buildings.values()) {
    const stock = standingIn(building);
    if (stock.length === 0) continue;
    const entry = { id: building.id, label: labelOf(building), stock, capacity: capacityOf(building) };
    if (building === hearth) standing.unshift(entry);
    else standing.push(entry);
  }

  return {
    name: settlement.name,
    people,
    sheltered: Math.min(people, roofed),
    vessels: vesselsHeld(settlement),
    buildings: settlement.buildings.size,
    day: dayHours(day),
    spare: Math.round((day.work + day.idle) * people),
    standing,
  };
}

/** The top-left strip's numbers: people, spare hours, and the first thing going wrong. */
export function stripViewOf(world: GameWorld, settlement: Settlement | undefined, tick: number): StripView {
  if (!settlement) return { seed: world.seed, town: false, people: 0, spare: 0, trouble: null };

  const people = settlement.carriers.size;
  const day = dayOf(settlement);
  let stopped = 0;
  for (const building of settlement.buildings.values()) {
    if (building.clearing) continue;
    for (const { slot, rig } of stations(building)) {
      if (rig.running || linesFor(building, slot).length === 0) continue;
      const scan = scanQueue(rig, settlement.book, building, slot);
      if (!scan.method && scan.refused.length > 0 && scan.refused.every((refusal) => refusal.kind === 'inputs')) stopped += 1;
    }
  }
  // Not in the first day: the fire has no wood yet, and saying so would be a false alarm.
  const trouble = stopped > 0 && tick > DAY_TICKS ? (stopped === 1 ? 'one station is stuck' : `${stopped} stations are stuck`) : null;
  return { seed: world.seed, town: true, people, spare: Math.round((day.work + day.idle) * people), trouble };
}

const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

/** Where to walk to find water, in words: a distance and a bearing. */
function bearingToWater(world: GameWorld, from: Vec2): string | null {
  const nearest = nearestWater(world.seed, from);
  if (!nearest) return null;

  const dx = nearest.x - from.x;
  const dy = nearest.y - from.y;
  const octant = Math.round((Math.atan2(dy, dx) / (Math.PI * 2)) * 8 + 8) % 8;
  return `${Math.round(Math.hypot(dx, dy))} paces ${COMPASS[octant] ?? 'away'}`;
}

/** Where the town has got to. The bearing to water is only worked out until a well draws it. */
export function progressOf(world: GameWorld, settlement: Settlement | undefined): Progress {
  const buildings = settlement ? [...settlement.buildings.values()] : [];
  const hearth = settlement?.buildings.get(settlement.hearthId);
  const drawsWater = buildings.some(
    (building) => building.yields.includes(ItemType.Water) && groundWork(building)?.item === ItemType.Water,
  );

  return {
    buildings: buildings.length,
    water: hearth && !drawsWater ? bearingToWater(world, hearth.position) : null,
    drawsWater,
    combines: buildings.some((building) => firstStation(building) !== undefined),
    kept: hearth ? totalHeld(hearth) : 0,
  };
}
