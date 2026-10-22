import type { MethodId } from './book.ts';
import { STORE_CAPACITY, cloneDesign } from './designs.ts';
import { landWorkById, workServes } from './landWorks.ts';
import type { LandWork } from './landWorks.ts';
import { createRig } from './process.ts';
import type { Rig } from './process.ts';
import { ItemType } from './types.ts';
import type { Biome, Building, Design, DesignId, ItemType as Item, Slot } from './types.ts';

/**
 * Work areas and their slots (`docs/methods.html` §3).
 *
 * The map carries areas, not machines. An area is one parcel with a few slots in it, and
 * everything standing in the same area hands on to everything else for nothing: one shelf, one
 * door, one list of what is made here. Only the gaps between areas need carrying.
 *
 * That bends "nothing teleports", so it is fenced. Slots are few and the chapter needs about
 * twenty stations, so no area can ever hold a chain. Ground slots are typed by the ground, so a
 * clay pit, a quarry and a woodcutter cannot share one. Only the walk is free, never the work.
 * And everything in and out still queues through one door.
 */

export interface Stage {
  name: string;
  /** Slots in all, the ground slot included. */
  slots: number;
  /** What has to stand on the shelf before the building starts, out of the chapter's own goods. */
  cost: readonly { item: Item; amount: number }[];
  /** The work of building it round, once the goods are there, in ticks. */
  labour: number;
  /** Walls keep the wind off, and a fire inside holds its heat better. */
  warm?: true;
  /** A roof, and so no sun: anything that dries in the sun refuses to stand here. */
  roofed?: true;
  /** One slot goes to the chimney. */
  chimney?: true;
}

/**
 * The ladder an area is built up. One, two, three, four, five is a guess and the one number that
 * can wreck the design: too many and the town is one area with nobody walking, too few and the
 * chapter is spent fighting the cap. The top two cost as well as give.
 */
export const STAGES: readonly Stage[] = [
  { name: 'Clearing', slots: 1, cost: [], labour: 0 },
  // Ringed with the stones turned up gathering, which is the walled yard the map already draws.
  { name: 'Yard', slots: 2, cost: [{ item: ItemType.Stone, amount: 3 }], labour: 100 },
  {
    name: 'Walled yard',
    slots: 3,
    cost: [
      { item: ItemType.Cord, amount: 2 },
      { item: ItemType.Daub, amount: 2 },
    ],
    labour: 140,
    warm: true,
  },
  {
    name: 'Roofed works',
    slots: 4,
    cost: [
      { item: ItemType.Wood, amount: 4 },
      { item: ItemType.Fibre, amount: 6 },
    ],
    labour: 200,
    warm: true,
    roofed: true,
  },
  {
    name: 'Stone works',
    slots: 5,
    cost: [
      { item: ItemType.Brick, amount: 6 },
      { item: ItemType.Mortar, amount: 3 },
      { item: ItemType.Wood, amount: 2 },
    ],
    labour: 260,
    warm: true,
    roofed: true,
    chimney: true,
  },
];

export const CHIMNEY: Design = { id: 'chimney', label: 'Chimney', capacity: STORE_CAPACITY };

/** The stage an area stands at. */
export const stageOf = (area: Building): Stage => STAGES[area.stage] ?? STAGES[0]!;

const emptySlot = (): Slot => ({ design: null, rig: null });

/** The slots an area is laid out with at a stage, every one of them empty. */
export function slotsFor(stage: number): Slot[] {
  const count = STAGES[stage]?.slots ?? STAGES[0]!.slots;
  return Array.from({ length: count }, emptySlot);
}

/**
 * Build an area up to a stage, keeping what stands in it. The new slots are work slots, and a
 * stone works spends its last one on the chimney.
 */
export function growTo(area: Building, stage: number): void {
  const target = STAGES[stage];
  if (!target) return;
  while (area.slots.length < target.slots) area.slots.push(emptySlot());
  area.stage = stage;
  if (target.warm) for (const slot of area.slots) if (slot.rig && slot.rig.process === 'fire') slot.rig.warm = true;
  if (target.chimney) {
    const last = area.slots[area.slots.length - 1];
    if (last && !last.design) last.design = cloneDesign(CHIMNEY);
  }
}

/** Everything standing in an area, in slot order. */
export function occupants(area: Building): Design[] {
  return area.slots.flatMap((slot) => (slot.design ? [slot.design] : []));
}

export function hasDesign(area: Building, id: DesignId): boolean {
  return area.slots.some((slot) => slot.design?.id === id);
}

/** Which slot holds the land work opening this ground, if one does. An area opens its ground once. */
export function groundSlot(area: Building): number {
  return area.slots.findIndex((slot) => slot.design !== null && landWorkById(slot.design.id) !== undefined);
}

/** The land work opening this area's ground, if one does. */
export function groundWork(area: Building): LandWork | undefined {
  const index = groundSlot(area);
  const design = index < 0 ? undefined : area.slots[index]?.design;
  return design ? landWorkById(design.id) : undefined;
}

/** Every station with a rig in it: where it stands, and the rig. */
export function stations(area: Building): { slot: number; design: Design; rig: Rig }[] {
  const found: { slot: number; design: Design; rig: Rig }[] = [];
  area.slots.forEach((slot, index) => {
    if (slot.design && slot.rig) found.push({ slot: index, design: slot.design, rig: slot.rig });
  });
  return found;
}

/** The first station in an area, which is what a single-station panel or the map is about. */
export function firstStation(area: Building): { slot: number; design: Design; rig: Rig } | undefined {
  return stations(area)[0];
}

/** How much of each item the shelf can hold: the most any occupant allows, eight at least. */
export function capacityOf(area: Building): number {
  let capacity = STORE_CAPACITY;
  for (const design of occupants(area)) capacity = Math.max(capacity, design.capacity);
  return capacity;
}

/** A store is somewhere anything may be left: an area with the hearth, or a store, in it. */
export function isStoreArea(area: Building): boolean {
  return occupants(area).some((design) => design.store === true);
}

/** Beds in an area, roofed or not. */
export function bedsIn(area: Building): number {
  return occupants(area).reduce((beds, design) => beds + (design.beds ?? 0), 0);
}

/** Whether the beds here have a roof: a sheltered occupant, or a roofed stage over everything. */
export function shelteredArea(area: Building): boolean {
  return stageOf(area).roofed === true || occupants(area).some((design) => design.sheltered === true);
}

/** What the area is known by where a word has to stand in for it: what stands in it first. */
export function areaLabel(area: Building): string {
  return occupants(area)[0]?.label ?? STAGES[area.stage]?.name ?? 'Clearing';
}

export interface SlotCheck {
  ok: boolean;
  slot: number | null;
  reason: string;
}

/**
 * Where a design would stand in this area, or why it cannot.
 *
 * Any free slot will do, with two refusals that are the ground's and the roof's. A land work needs
 * the parcel to yield what it draws, and an area opens its ground once: a bank that gives water,
 * mud and clay cannot be all three buildings at once. A station that dries in the sun refuses a
 * roofed stage.
 */
export function slotFor(area: Building, design: Design, biome: Biome): SlotCheck {
  const index = area.slots.findIndex((slot) => !slot.design);
  if (index < 0) return { ok: false, slot: null, reason: 'no free slot here' };
  const work = landWorkById(design.id);
  if (work) {
    if (groundSlot(area) >= 0) return { ok: false, slot: null, reason: 'the ground here is already opened' };
    if (!workServes(work, biome, area.yields)) {
      return { ok: false, slot: null, reason: `no ${work.item} for a ${design.label} in this ground` };
    }
    return { ok: true, slot: index, reason: `opens the ground: draws ${work.item}` };
  }
  if (design.needsSun && stageOf(area).roofed) {
    return { ok: false, slot: null, reason: `a ${design.label} wants the sun, and this is roofed` };
  }
  return { ok: true, slot: index, reason: `stands in slot ${index + 1}` };
}

/**
 * Put a design in a slot, and its methods at the bottom of the area's list, bound to it. The
 * design is the area's own copy: nothing re-tools what is already standing.
 */
export function placeIn(area: Building, slot: number, design: Design): void {
  const target = area.slots[slot];
  if (!target) return;
  const own = cloneDesign(design);
  target.design = own;
  target.rig = own.rig ? createRig(own.rig) : null;
  if (target.rig && target.rig.process === 'fire' && stageOf(area).warm) target.rig.warm = true;
  for (const methodId of own.methods ?? []) area.queue.push({ methodId, slot });
}

/** Take a station out of its slot, and its lines off the list. */
export function clearSlot(area: Building, slot: number): void {
  const target = area.slots[slot];
  if (!target) return;
  target.design = null;
  target.rig = null;
  area.queue = area.queue.filter((line) => line.slot !== slot);
}

/** Whether a station is the only thing an area holds, so taking it out takes the area down. */
export const lastStanding = (area: Building): boolean => occupants(area).length <= 1;

/** The rig of an area's first station, for anything that asks about one station only. */
export const rigAt = (area: Building): Rig | undefined => firstStation(area)?.rig;

/** The slot of an area's first station, or the first work slot if none stands in it. */
export const stationSlot = (area: Building): number => firstStation(area)?.slot ?? 1;

/** Replace the lines bound to one station with these, at the place the first of them stood. */
export function setLines(area: Building, slot: number, methods: readonly MethodId[]): void {
  const at = area.queue.findIndex((line) => line.slot === slot);
  const rest = area.queue.filter((line) => line.slot !== slot);
  const lines = methods.map((methodId) => ({ methodId, slot }));
  rest.splice(at < 0 ? rest.length : Math.min(at, rest.length), 0, ...lines);
  area.queue = rest;
}

/** The next stage up, if there is one. */
export const nextStage = (area: Building): Stage | undefined => STAGES[area.stage + 1];

/** What is still wanted on the shelf before the next stage can be built, by item. */
export function stillWanted(area: Building): { item: Item; amount: number }[] {
  if (!area.raising) return [];
  const stage = STAGES[area.raising.to];
  if (!stage) return [];
  return stage.cost
    .map((cost) => ({ item: cost.item, amount: Math.max(0, cost.amount - (area.stock.get(cost.item) ?? 0)) }))
    .filter((cost) => cost.amount > 0);
}

/** What the stage being built costs in all, which is the batch an area is stocked against. */
export function stageCost(area: Building): readonly { item: Item; amount: number }[] {
  return area.raising ? (STAGES[area.raising.to]?.cost ?? []) : [];
}

/** Whether the goods for the stage being built are all on the shelf, so the labour can start. */
export const readyToRaise = (area: Building): boolean => area.raising !== undefined && stillWanted(area).length === 0;

/**
 * Order the next stage built. Nothing happens to the area yet: the goods are carried to its shelf
 * first, and then somebody builds it round, the way a site is cleared.
 */
export function orderStage(area: Building): boolean {
  const next = nextStage(area);
  if (!next || area.raising || area.clearing) return false;
  area.raising = { to: area.stage + 1, done: 0, needed: next.labour };
  return true;
}

/** A tick of building the next stage round. True on the tick it is finished. */
export function workOnStage(area: Building): boolean {
  const raising = area.raising;
  if (!raising || !readyToRaise(area)) return false;
  raising.done += 1;
  if (raising.done < raising.needed) return false;
  const stage = STAGES[raising.to];
  for (const cost of stage?.cost ?? []) {
    const there = area.stock.get(cost.item) ?? 0;
    if (there <= cost.amount) area.stock.delete(cost.item);
    else area.stock.set(cost.item, there - cost.amount);
  }
  delete area.raising;
  growTo(area, raising.to);
  return true;
}
