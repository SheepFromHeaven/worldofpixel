import type { MethodId } from './book.ts';
import { STORE_CAPACITY, cloneDesign } from './designs.ts';
import { landWorkById, workServes } from './landWorks.ts';
import type { LandWork } from './landWorks.ts';
import { createRig } from './process.ts';
import type { Rig } from './process.ts';
import { ItemType } from './types.ts';
import type { Biome, Building, Design, DesignId, ItemType as Item, Slot } from './types.ts';

export interface Stage {
  name: string;
  slots: number;
  cost: readonly { item: Item; amount: number }[];
  labour: number;
  warm?: true;
  roofed?: true;
  chimney?: true;
}

export const STAGES: readonly Stage[] = [
  { name: 'Clearing', slots: 1, cost: [], labour: 0 },
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

export const stageOf = (area: Building): Stage => STAGES[area.stage] ?? STAGES[0]!;

const emptySlot = (): Slot => ({ design: null, rig: null });

export function slotsFor(stage: number): Slot[] {
  const count = STAGES[stage]?.slots ?? STAGES[0]!.slots;
  return Array.from({ length: count }, emptySlot);
}

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

export function occupants(area: Building): Design[] {
  return area.slots.flatMap((slot) => (slot.design ? [slot.design] : []));
}

export function hasDesign(area: Building, id: DesignId): boolean {
  return area.slots.some((slot) => slot.design?.id === id);
}

export function groundSlots(area: Building): number[] {
  const found: number[] = [];
  area.slots.forEach((slot, index) => {
    if (slot.design && landWorkById(slot.design.id)) found.push(index);
  });
  return found;
}

export function workAt(area: Building, slot: number): LandWork | undefined {
  const design = area.slots[slot]?.design;
  return design ? landWorkById(design.id) : undefined;
}

export function groundSlot(area: Building): number {
  const all = groundSlots(area);
  return all.find((index) => !workAt(area, index)?.pool) ?? all[0] ?? -1;
}

export function groundWork(area: Building): LandWork | undefined {
  const index = groundSlot(area);
  return index < 0 ? undefined : workAt(area, index);
}

export function stations(area: Building): { slot: number; design: Design; rig: Rig }[] {
  const found: { slot: number; design: Design; rig: Rig }[] = [];
  area.slots.forEach((slot, index) => {
    if (slot.design && slot.rig) found.push({ slot: index, design: slot.design, rig: slot.rig });
  });
  return found;
}

export function firstStation(area: Building): { slot: number; design: Design; rig: Rig } | undefined {
  return stations(area)[0];
}

export function capacityOf(area: Building): number {
  let capacity = STORE_CAPACITY;
  for (const design of occupants(area)) capacity = Math.max(capacity, design.capacity);
  return capacity;
}

export function isStoreArea(area: Building): boolean {
  return occupants(area).some((design) => design.store === true);
}

export function bedsIn(area: Building): number {
  return occupants(area).reduce((beds, design) => beds + (design.beds ?? 0), 0);
}

export function shelteredArea(area: Building): boolean {
  return stageOf(area).roofed === true || occupants(area).some((design) => design.sheltered === true);
}

export function areaLabel(area: Building): string {
  return occupants(area)[0]?.label ?? STAGES[area.stage]?.name ?? 'Clearing';
}

export interface SlotCheck {
  ok: boolean;
  slot: number | null;
  reason: string;
}

export function slotFor(area: Building, design: Design, biome: Biome): SlotCheck {
  const index = area.slots.findIndex((slot) => !slot.design);
  if (index < 0) return { ok: false, slot: null, reason: 'no free slot here' };
  const work = landWorkById(design.id);
  if (work) {
    const taken = groundSlots(area).some((index) => Boolean(workAt(area, index)?.pool) === Boolean(work.pool));
    if (taken) {
      return { ok: false, slot: null, reason: work.pool ? 'one forage camp is all a place needs' : 'the ground here is already opened' };
    }
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

export function placeIn(area: Building, slot: number, design: Design): void {
  const target = area.slots[slot];
  if (!target) return;
  const own = cloneDesign(design);
  target.design = own;
  target.rig = own.rig ? createRig(own.rig) : null;
  if (target.rig && target.rig.process === 'fire' && stageOf(area).warm) target.rig.warm = true;
  for (const methodId of own.methods ?? []) area.queue.push({ methodId, slot });
}

export function clearSlot(area: Building, slot: number): void {
  const target = area.slots[slot];
  if (!target) return;
  target.design = null;
  target.rig = null;
  area.queue = area.queue.filter((line) => line.slot !== slot);
}

export const lastStanding = (area: Building): boolean => occupants(area).length <= 1;

export const rigAt = (area: Building): Rig | undefined => firstStation(area)?.rig;

export const stationSlot = (area: Building): number => firstStation(area)?.slot ?? 1;

export function setLines(area: Building, slot: number, methods: readonly MethodId[]): void {
  const at = area.queue.findIndex((line) => line.slot === slot);
  const rest = area.queue.filter((line) => line.slot !== slot);
  const lines = methods.map((methodId) => ({ methodId, slot }));
  rest.splice(at < 0 ? rest.length : Math.min(at, rest.length), 0, ...lines);
  area.queue = rest;
}

export const nextStage = (area: Building): Stage | undefined => STAGES[area.stage + 1];

export function stillWanted(area: Building): { item: Item; amount: number }[] {
  if (!area.raising) return [];
  const stage = STAGES[area.raising.to];
  if (!stage) return [];
  return stage.cost
    .map((cost) => ({ item: cost.item, amount: Math.max(0, cost.amount - (area.stock.get(cost.item) ?? 0)) }))
    .filter((cost) => cost.amount > 0);
}

export function stageCost(area: Building): readonly { item: Item; amount: number }[] {
  return area.raising ? (STAGES[area.raising.to]?.cost ?? []) : [];
}

export const readyToRaise = (area: Building): boolean => area.raising !== undefined && stillWanted(area).length === 0;

export function orderStage(area: Building): boolean {
  const next = nextStage(area);
  if (!next || area.raising || area.clearing) return false;
  area.raising = { to: area.stage + 1, done: 0, needed: next.labour };
  return true;
}

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
