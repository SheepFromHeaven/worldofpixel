import { itemIcon } from '../pixel/ui/metrics.ts';
import { openingItems } from '../sim/chapter.ts';
import { proposedClaim } from '../sim/claims.ts';
import type { Bounds } from '../sim/geometry.ts';
import { landYield } from '../sim/markers.ts';
import { PARCEL, parcelId, parcelOf, siteOf, warmParcels } from '../sim/terrain/parcels.ts';
import type { CellId, ItemType as Item } from '../sim/types.ts';
import type { GameWorld } from '../sim/world.ts';
import { drawIcon } from './hudPlates.ts';

const BLOCK = 16;

const FRAME_BUDGET_MS = 5;

const BLOCK_BUDGET = 256;

interface Entry {
  id: CellId;
  x: number;
  y: number;
  items: readonly Item[];
}

const blocks = new Map<string, Entry[]>();
let blockSeed: number | null = null;

const YIELD_PIXELS = 16;

const OTHERS = 0.65;

function computeBlock(world: GameWorld, bx: number, by: number): Entry[] {
  const column0 = bx * BLOCK;
  const row0 = by * BLOCK;
  warmParcels(world.seed, {
    minX: (column0 - 1) * PARCEL,
    minY: (row0 - 1) * PARCEL,
    maxX: (column0 + BLOCK + 1) * PARCEL,
    maxY: (row0 + BLOCK + 1) * PARCEL,
  });

  const entries: Entry[] = [];
  for (let row = row0; row < row0 + BLOCK; row += 1) {
    for (let column = column0; column < column0 + BLOCK; column += 1) {
      const id = parcelId(column, row);
      const items = landYield(world, id);
      if (items.length === 0) continue;
      const site = siteOf(world.seed, PARCEL, column, row);
      entries.push({ id, x: site.x, y: site.y, items });
    }
  }
  return entries;
}

export interface YieldView {
  bounds: Bounds;
  zoom: number;
  held?: Item;
}

export function drawLandYields(ctx: CanvasRenderingContext2D, world: GameWorld, view: YieldView): void {
  if (blockSeed !== world.seed) {
    blocks.clear();
    blockSeed = world.seed;
  }

  const span = BLOCK * PARCEL;
  const reach: Bounds = {
    minX: view.bounds.minX - PARCEL,
    minY: view.bounds.minY - PARCEL,
    maxX: view.bounds.maxX + PARCEL,
    maxY: view.bounds.maxY + PARCEL,
  };
  const centreX = (view.bounds.minX + view.bounds.maxX) / 2;
  const centreY = (view.bounds.minY + view.bounds.maxY) / 2;

  const wanted: { bx: number; by: number; gap: number }[] = [];
  for (let by = Math.floor(reach.minY / span); by <= Math.floor(reach.maxY / span); by += 1) {
    for (let bx = Math.floor(reach.minX / span); bx <= Math.floor(reach.maxX / span); bx += 1) {
      const gap = Math.hypot((bx + 0.5) * span - centreX, (by + 0.5) * span - centreY);
      wanted.push({ bx, by, gap });
    }
  }
  wanted.sort((a, b) => a.gap - b.gap);

  const started = performance.now();
  let computed = 0;
  for (const { bx, by } of wanted) {
    const key = `${bx}:${by}`;
    if (blocks.has(key)) continue;
    if (computed > 0 && performance.now() - started > FRAME_BUDGET_MS) break;
    blocks.set(key, computeBlock(world, bx, by));
    computed += 1;
    if (blocks.size > BLOCK_BUDGET) {
      const oldest = blocks.keys().next().value;
      if (oldest !== undefined) blocks.delete(oldest);
    }
  }

  const taken = new Set<CellId>();
  for (const settlement of world.settlements.values()) {
    for (const building of settlement.buildings.values()) taken.add(building.cellId);
  }

  const mark = YIELD_PIXELS / view.zoom;

  for (const { bx, by } of wanted) {
    for (const entry of blocks.get(`${bx}:${by}`) ?? []) {
      if (entry.x < reach.minX || entry.x > reach.maxX || entry.y < reach.minY || entry.y > reach.maxY) {
        continue;
      }
      if (taken.has(entry.id)) continue;

      const startX = entry.x - ((entry.items.length - 1) * mark) / 2;
      entry.items.forEach((item, index) => {
        drawIcon(ctx, itemIcon(item), startX + index * mark, entry.y, mark, view.held === undefined || item === view.held ? 1 : OTHERS);
      });
    }
  }
}

const NOT_YET = 0.3;

const ACROSS = 3;

export interface FoundingView {
  zoom: number;
  cell: CellId;
}

export function drawFoundingYields(ctx: CanvasRenderingContext2D, world: GameWorld, view: FoundingView): void {
  const wanted = openingItems();
  const mark = YIELD_PIXELS / view.zoom;

  for (const id of proposedClaim(world, view.cell)) {
    const parcel = parcelOf(world.seed, id);
    const items = landYield(world, id);
    if (items.length === 0) continue;

    const needed = items.filter((item) => wanted.includes(item));
    const rest = items.filter((item) => !wanted.includes(item));
    const rows: { item: Item; full: boolean }[][] = [];
    if (needed.length > 0) rows.push(needed.map((item) => ({ item, full: true })));
    for (let at = 0; at < rest.length; at += ACROSS) {
      rows.push(rest.slice(at, at + ACROSS).map((item) => ({ item, full: false })));
    }

    const top = parcel.site.y - ((rows.length - 1) * mark) / 2;
    rows.forEach((row, line) => {
      const left = parcel.site.x - ((row.length - 1) * mark) / 2;
      row.forEach(({ item, full }, index) => {
        drawIcon(ctx, itemIcon(item), left + index * mark, top + line * mark, mark, full ? 1 : NOT_YET);
      });
    });
  }
}
