import type { Bounds } from '../sim/geometry.ts';
import { landYield } from '../sim/markers.ts';
import { PARCEL, parcelId, siteOf, warmParcels } from '../sim/parcels.ts';
import type { CellId, ItemType as Item } from '../sim/types.ts';
import type { GameWorld } from '../sim/world.ts';
import { itemIcon } from '../pixel/ui/metrics.ts';
import { drawIcon } from './hudPlates.ts';

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

/**
 * How big a yield is drawn, in buffer pixels — the same pixel the ground is drawn from.
 *
 * These are **marks**, like a town's name and a bay's icon, not tiles: a yield covers no patch
 * of world, it says *this parcel holds water*, so it is drawn at a fixed number of buffer pixels
 * and never coarsens with the rung. They were wobbled pencil glyphs on pills, baked into little
 * offscreen canvases four to ten pixels across — which is under the sixteen a sheet icon needs,
 * so the pixel drawing never came out and the pencil one always did: the last sketch left on a
 * map whose every other mark is pixel art.
 *
 * Sixteen, so one sheet cell is one buffer pixel. The overlay is only drawn at the `fine` tier,
 * where a parcel is sixty-four buffer pixels at its widest, and three of these sit across one
 * with room either side.
 */
const YIELD_PIXELS = 16;

/** What the ground does not give, drawn at this much of full strength — present, but quiet. */
const OTHERS = 0.65;

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

  const mark = YIELD_PIXELS / view.zoom;

  for (const { bx, by } of wanted) {
    for (const entry of blocks.get(`${bx}:${by}`) ?? []) {
      if (entry.x < reach.minX || entry.x > reach.maxX || entry.y < reach.minY || entry.y > reach.maxY) {
        continue;
      }
      if (taken.has(entry.id)) continue;

      const startX = entry.x - ((entry.items.length - 1) * mark) / 2;
      entry.items.forEach((item, index) => {
        // **A whole icon box, never a fraction of one.** Sixteen cells want a whole number of
        // device pixels each, and a box under sixteen floors to none and draws nothing at all.
        drawIcon(ctx, itemIcon(item), startX + index * mark, entry.y, mark, item === view.held ? 1 : OTHERS);
      });
    }
  }
}
