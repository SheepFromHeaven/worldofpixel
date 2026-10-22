import { distance } from './geometry.ts';
import type { Vec2 } from './geometry.ts';
import { PARCEL, cellsIn, parcelIndex, parcelOf, siteOf } from './parcels.ts';
import type { CellId, Settlement } from './types.ts';
import type { GameWorld } from './world.ts';

export const HEARTH_REACH = 4;
export const BUILDING_REACH = 2;

export const STONE_SPACING = PARCEL * 0.6;

interface Holder {
  owner: string;
  site: Vec2;
  reach: number;
}

export interface Proposal {
  owner: string;
  cellId: CellId;
  hearth: boolean;
}

const siteOfCell = (world: GameWorld, cellId: CellId): Vec2 => {
  const { column, row } = parcelIndex(cellId);
  return siteOf(world.seed, PARCEL, column, row);
};

function holders(world: GameWorld, proposal?: Proposal): Holder[] {
  const out: Holder[] = [];
  for (const settlement of world.settlements.values()) {
    for (const building of settlement.buildings.values()) {
      out.push({
        owner: settlement.id,
        site: siteOfCell(world, building.cellId),
        reach: (building.id === settlement.hearthId ? HEARTH_REACH : BUILDING_REACH) * PARCEL,
      });
    }
  }
  if (proposal) {
    out.push({
      owner: proposal.owner,
      site: siteOfCell(world, proposal.cellId),
      reach: (proposal.hearth ? HEARTH_REACH : BUILDING_REACH) * PARCEL,
    });
  }
  return out;
}

function ownerAmong(all: readonly Holder[], site: Vec2): string | undefined {
  let best: Holder | undefined;
  let bestGap = Infinity;
  for (const holder of all) {
    const gap = distance(site, holder.site);
    if (gap <= holder.reach && gap < bestGap) {
      best = holder;
      bestGap = gap;
    }
  }
  return best?.owner;
}

export function ownerOf(world: GameWorld, cellId: CellId, proposal?: Proposal): string | undefined {
  return ownerAmong(holders(world, proposal), siteOfCell(world, cellId));
}

export function inClaim(world: GameWorld, settlement: Settlement, cellId: CellId): boolean {
  return ownerOf(world, cellId) === settlement.id;
}

export const townIdFor = (cellId: CellId): string => `town:${cellId}`;

export function crowdedBy(world: GameWorld, cellId: CellId): Settlement | undefined {
  const all = holders(world);
  for (const parcel of parcelsWithin(world, siteOfCell(world, cellId), HEARTH_REACH * PARCEL)) {
    const owner = ownerAmong(all, parcel.site);
    if (owner) return world.settlements.get(owner);
  }
  return undefined;
}

function parcelsWithin(world: GameWorld, centre: Vec2, reach: number) {
  return cellsIn(world.seed, PARCEL, {
    minX: centre.x - reach - PARCEL,
    minY: centre.y - reach - PARCEL,
    maxX: centre.x + reach + PARCEL,
    maxY: centre.y + reach + PARCEL,
  }).filter((parcel) => distance(parcel.site, centre) <= reach);
}

interface Claims {
  parcels: Map<string, CellId[]>;
  stones: Map<string, Vec2[]>;
}

const computed = new Map<string, Claims>();

export function claims(world: GameWorld, proposal?: Proposal): Claims {
  const parts = [String(world.seed)];
  for (const settlement of world.settlements.values()) {
    parts.push(`${settlement.id}=${[...settlement.buildings.values()].map((b) => b.cellId).join(',')}`);
  }
  if (proposal) parts.push(`+${proposal.owner}:${proposal.cellId}:${proposal.hearth}`);
  const key = parts.join(';');
  const known = computed.get(key);
  if (known) return known;

  const all = holders(world, proposal);
  const parcels = new Map<string, CellId[]>();
  const owners = new Map<CellId, string>();
  const reach = Math.max(HEARTH_REACH, BUILDING_REACH) * PARCEL + PARCEL;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const holder of all) {
    minX = Math.min(minX, holder.site.x - reach);
    minY = Math.min(minY, holder.site.y - reach);
    maxX = Math.max(maxX, holder.site.x + reach);
    maxY = Math.max(maxY, holder.site.y + reach);
  }
  if (all.length > 0) {
    for (const parcel of cellsIn(world.seed, PARCEL, { minX, minY, maxX, maxY })) {
      const owner = ownerAmong(all, parcel.site);
      if (!owner) continue;
      owners.set(parcel.id, owner);
      parcels.set(owner, [...(parcels.get(owner) ?? []), parcel.id]);
    }
  }

  const stones = new Map<string, Vec2[]>();
  for (const [owner, held] of parcels) stones.set(owner, stonesAlong(edgeOf(world, owner, held, owners)));

  const result = { parcels, stones };
  if (computed.size > 32) computed.clear();
  computed.set(key, result);
  return result;
}

export function proposedClaim(world: GameWorld, cellId: CellId): CellId[] {
  const owner = townIdFor(cellId);
  return claims(world, { owner, cellId, hearth: true }).parcels.get(owner) ?? [];
}

export const claimOf = (world: GameWorld, settlement: Settlement): CellId[] =>
  claims(world).parcels.get(settlement.id) ?? [];

function edgeOf(world: GameWorld, owner: string, held: readonly CellId[], owners: Map<CellId, string>): [Vec2, Vec2][] {
  const same = (a: Vec2, b: Vec2): boolean => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
  const segments: [Vec2, Vec2][] = [];
  for (const id of held) {
    const parcel = parcelOf(world.seed, id);
    for (const neighbourId of parcel.neighbors) {
      const other = owners.get(neighbourId);
      if (other === owner) continue;
      if (other !== undefined && other < owner) continue;
      const neighbour = parcelOf(world.seed, neighbourId);
      const shared = parcel.vertices.filter((vertex) => neighbour.vertices.some((v) => same(vertex, v)));
      if (shared.length >= 2) segments.push([shared[0]!, shared[1]!]);
    }
  }
  return segments;
}

function stonesAlong(segments: readonly [Vec2, Vec2][]): Vec2[] {
  const key = (p: Vec2): string => `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
  const at = new Map<string, number[]>();
  segments.forEach(([a, b], index) => {
    for (const p of [a, b]) at.set(key(p), [...(at.get(key(p)) ?? []), index]);
  });

  const used = new Set<number>();
  const stones: Vec2[] = [];
  for (let start = 0; start < segments.length; start += 1) {
    if (used.has(start)) continue;
    let first = start;
    let from = segments[start]![0];
    const back = new Set<number>([start]);
    for (;;) {
      const next = (at.get(key(from)) ?? []).find((i) => !back.has(i) && !used.has(i));
      if (next === undefined) break;
      back.add(next);
      const [a, b] = segments[next]!;
      from = key(a) === key(from) ? b : a;
      first = next;
    }

    let point = key(segments[first]![0]) === key(from) ? segments[first]![0] : segments[first]![1];
    let index: number | undefined = first;
    let carried = 0;
    stones.push(point);
    while (index !== undefined) {
      used.add(index);
      const [a, b] = segments[index]!;
      const end = key(a) === key(point) ? b : a;
      const length = distance(point, end);
      let along = STONE_SPACING - carried;
      while (along <= length) {
        const t = along / length;
        stones.push({ x: point.x + (end.x - point.x) * t, y: point.y + (end.y - point.y) * t });
        along += STONE_SPACING;
      }
      carried = length - (along - STONE_SPACING);
      point = end;
      index = (at.get(key(point)) ?? []).find((i) => !used.has(i));
    }
  }
  return stones;
}
