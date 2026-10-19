import type { Bounds } from '../sim/geometry.ts';
import { landYield } from '../sim/markers.ts';
import { PARCEL, parcelId, siteOf, warmParcels } from '../sim/parcels.ts';
import type { CellId, ItemType as Item } from '../sim/types.ts';
import type { GameWorld } from '../sim/world.ts';
import { drawItemChip } from './icons.ts';

/** Parcels to a side of one block of yields, worked out together and kept together. */
const BLOCK = 16;

/**
 * Milliseconds of new blocks per frame. A cold parcel costs about 0.3 ms through `parcelOf` and
 * a twentieth of that warmed a block at a time, but a fresh view at the widest parcel zoom is
 * still twenty-odd blocks. Asked for all at once that is a visible hitch the moment a land work
 * is picked up; spread over frames, the overlay fills in from the middle of the screen out.
 */
const FRAME_BUDGET_MS = 5;

/** Enough for several screens of panning; the oldest block goes first. */
const BLOCK_BUDGET = 256;

interface Entry {
  id: CellId;
  x: number;
  y: number;
  items: readonly Item[];
}

/** A parcel's yield never changes for a seed, so a block is worked out once and kept. */
const blocks = new Map<string, Entry[]>();
let blockSeed: number | null = null;

/** One baked chip per item and pixel size: a wobbled icon per parcel per frame is the frame. */
const chips = new Map<string, HTMLCanvasElement | null>();

function chipCanvas(item: Item, px: number): HTMLCanvasElement | null {
  const key = `${item}:${px}`;
  const cached = chips.get(key);
  if (cached !== undefined) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (ctx) drawItemChip(ctx, item, px / 2, px / 2, px / 3.4);
  const baked = ctx ? canvas : null;
  chips.set(key, baked);
  return baked;
}

function computeBlock(world: GameWorld, bx: number, by: number): Entry[] {
  const column0 = bx * BLOCK;
  const row0 = by * BLOCK;
  // One ring wider than the block, so the neighbours `landYield` reads are already built.
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
  /** Buffer pixels per world unit. */
  zoom: number;
  /** The item the land work in hand draws; the others are shown, but quieter. */
  held: Item;
}

/**
 * What every parcel in view holds, while a land work is in hand. Culled by lattice index rather
 * than by asking `cellsIn` for the view, which would rebuild a Voronoi diagram of the whole
 * screen every frame: a site always lies inside its own lattice square, so the blocks the view
 * overlaps hold every parcel in it, and the parcel past the edge is drawn as it scrolls in.
 */
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

  const parcelPx = PARCEL * view.zoom;
  const px = Math.max(4, Math.min(10, Math.round(parcelPx * 0.3)));
  const size = px / view.zoom;
  const spacing = Math.min(px, parcelPx * 0.32) / view.zoom;

  const smoothing = ctx.imageSmoothingEnabled;
  const alpha = ctx.globalAlpha;
  ctx.imageSmoothingEnabled = false;

  for (const { bx, by } of wanted) {
    for (const entry of blocks.get(`${bx}:${by}`) ?? []) {
      if (entry.x < reach.minX || entry.x > reach.maxX || entry.y < reach.minY || entry.y > reach.maxY) {
        continue;
      }
      if (taken.has(entry.id)) continue;

      const startX = entry.x - ((entry.items.length - 1) * spacing) / 2;
      entry.items.forEach((item, index) => {
        const chip = chipCanvas(item, px);
        if (!chip) return;
        ctx.globalAlpha = item === view.held ? 1 : 0.4;
        ctx.drawImage(chip, startX + index * spacing - size / 2, entry.y - size / 2, size, size);
      });
    }
  }

  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = smoothing;
}
