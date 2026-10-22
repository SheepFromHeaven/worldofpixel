import { proposedClaim } from '../sim/claims.ts';
import { openingItems } from '../sim/chapter.ts';
import type { Bounds } from '../sim/geometry.ts';
import { landYield } from '../sim/markers.ts';
import { PARCEL, parcelId, parcelOf, siteOf, warmParcels } from '../sim/parcels.ts';
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
  /** An item to stress, if there is one; the others are shown, but quieter. */
  held?: Item;
}

/**
 * What every parcel in view holds, while a work area is being marked out: where it stands decides
 * what can be put in its slots. Culled by lattice index rather
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
        drawIcon(ctx, itemIcon(item), startX + index * mark, entry.y, mark, view.held === undefined || item === view.held ? 1 : OTHERS);
      });
    }
  }
}

/** What the ground gives that the opening does not want yet: there, but well in the background. */
const NOT_YET = 0.3;

/** Icons to a row for the things not wanted yet: three fit a parcel at its narrowest fine zoom. */
const ACROSS = 3;

export interface FoundingView {
  /** Buffer pixels per world unit. */
  zoom: number;
  /** The parcel a hearth would be set on. */
  cell: CellId;
}

/**
 * What a hearth set here would have within a walk of it.
 *
 * Founding is the one decision in the game taken with nothing yet built, so it is taken on what
 * the ground holds — and "a town on bare rock is legal and meant to be" only stays a fair
 * choice if the player can see the bare rock coming. So the claim the hearth would hold is
 * marked parcel by parcel, the way a land work in hand marks the whole view, and what the
 * opening wants first (`openingItems`: deadwood to gather, a bank to dig mud from) stands out
 * at full strength while everything else is a quiet second. The ones wanted come first in each
 * parcel too, so the eye lands on them.
 *
 * Only inside the would-be claim. Outside it nothing here is the town's to use, and a whole
 * screen of marks round a hearth that holds a few dozen parcels hides which few dozen.
 */
export function drawFoundingYields(ctx: CanvasRenderingContext2D, world: GameWorld, view: FoundingView): void {
  const wanted = openingItems();
  const mark = YIELD_PIXELS / view.zoom;

  for (const id of proposedClaim(world, view.cell)) {
    const parcel = parcelOf(world.seed, id);
    const items = landYield(world, id);
    if (items.length === 0) continue;

    // Rows, not one line. A bank holds six or seven things, and in a line that is a hundred
    // pixels of icons across a parcel sixty-four wide, running into the next parcel's. What is
    // wanted goes in a row of its own on top, where the eye lands first, and the rest sit under
    // it three to a row — which is also what makes "wanted first" a position as well as a weight.
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
