import { polygonCentroid } from '../sim/geometry.ts';
import type { Bounds, Vec2 } from '../sim/geometry.ts';
import type { Detail, Parcel } from '../sim/parcels.ts';

import type { GameWorld } from '../sim/world.ts';
import { drawMapLabel } from './hudPlates.ts';
import { INK, MARK_HALO } from './palette.ts';
import { FRAMES_PER_SECOND, drawMark } from './sprites.ts';
import { LEVELS, chunkKey, levelFor, texelsIn } from './terrainPixels.ts';
import { townStage } from './townStage.ts';
import type { TownStage } from './townStage.ts';
import type { GroundLevel } from './terrainPixels.ts';

/**
 * Which lattice the ground is read from at a zoom. The rung decides it — a rung is worth
 * resolving exactly when its texels have a buffer pixel each to stand on — and several rungs
 * share a lattice, so this is coarser information than `levelFor` and only the things that care
 * about *cells* rather than pixels should ask for it.
 */
export function detailFor(zoom: number): Detail {
  return levelFor(zoom).detail;
}

/* ---------- the near tiers: chunks of lattice, baked as they come into view ---------- */

/**
 * Bigger than the number of chunks any one frame draws, with room to spare. A budget that one
 * frame can exceed is not a cache: it evicts a chunk and re-bakes it on the very next frame, and
 * the cost is not a slow bake but a renderer that has stopped working. At the widest parcel-tier
 * zoom a 2560x1440 window asks for twenty-odd, so this has to clear that and not merely meet it.
 */
const CHUNK_BUDGET = 96;

const chunks = new Map<string, HTMLCanvasElement>();

/**
 * The last canvas baked at each place on each rung, whatever it was keyed on — kept so that a
 * chunk waiting its turn to be baked again can show what was there before rather than a hole.
 */
const latest = new Map<string, HTMLCanvasElement>();
const placeKey = (seed: number, rung: number, column: number, row: number): string => `${seed}:${rung}:${column}:${row}`;

/**
 * How long one frame may spend baking ground, in milliseconds. A chunk is a sixtieth of a second
 * or more to bake, and every chunk missing from the screen used to be baked in the frame that
 * found it missing: a pan onto a new row of them froze for a tenth of a second, and the moment
 * the drawn ground arrived and every chunk on screen re-keyed, for half a second. Now the nearest
 * are baked first until the budget is spent — always at least one, so nothing waits for ever —
 * and the rest wait a frame, drawn meanwhile from what was there before.
 */
const BAKE_BUDGET_MS = 8;

/**
 * What a town is marked with, by how far it has got.
 *
 * **The far view has nothing but the mark to say a town's size with**, so the mark has to say
 * it. One drawing for every settlement makes a fire on bare rock and a town of sixty buildings
 * the same thing on the map of a country, which is the one question that view is for. The counts
 * the stages turn over at are `townStage`'s, shared with the ledger.
 *
 * The first stage is the `hearth` tile itself, drawn small and still burning. It is not a
 * picture of what is there — it *is* what is there, and a new settlement is a fire and nothing
 * else (`foundSettlement`).
 */
interface Stage {
  mark: string;
  clip: string;
  /** The cells it is authored at, so a name sits in the right place before the tile has decoded. */
  cells: number;
}

const STAGES: Record<TownStage, Stage> = {
  stone: { mark: 'town-stone', clip: 'default', cells: 32 },
  village: { mark: 'town-village', clip: 'default', cells: 32 },
  huts: { mark: 'town-huts', clip: 'default', cells: 32 },
  fire: { mark: 'hearth', clip: 'burn', cells: 16 },
};

const stageFor = (buildings: number): Stage => STAGES[townStage(buildings)];

/**
 * The rung the last frame drew, so a frame can tell whether the zoom has settled on this one.
 *
 * Crossing a rung leaves every chunk on screen missing at once, and a chunk is a thirtieth of a
 * second: a wheel run through five rungs asks for sixty bakes and gets one a frame, so the sharp
 * ground arrives in a patch that is still spreading when the next rung throws it away. What the
 * eye sees is the middle of the map flickering between the coarser rung magnified and the new
 * one. Baking only once the rung has held still for a frame spends nothing on a rung being
 * passed through — the zoom runs on the stand-ins, which is what they are for, and the ground
 * sharpens from the middle out the moment the wheel stops.
 */
let drawnRung: number | null = null;

function bakeTexelChunk(
  world: GameWorld,
  level: GroundLevel,
  bounds: Bounds,
): HTMLCanvasElement | undefined {
  const texel = level.texel;
  const texels = Math.round((bounds.maxX - bounds.minX) / texel);
  const canvas = document.createElement('canvas');
  canvas.width = texels;
  canvas.height = texels;

  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  const packed = texelsIn(
    world,
    level.spacing,
    texel,
    Math.round(bounds.minX / texel),
    Math.round(bounds.minY / texel),
    texels,
    texels,
  );

  const image = ctx.createImageData(texels, texels);
  for (let i = 0; i < packed.length; i += 1) {
    const color = packed[i]!;
    image.data[i * 4] = (color >>> 24) & 0xff;
    image.data[i * 4 + 1] = (color >>> 16) & 0xff;
    image.data[i * 4 + 2] = (color >>> 8) & 0xff;
    image.data[i * 4 + 3] = color & 0xff;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

interface Placed {
  canvas: HTMLCanvasElement;
  /** The part of the canvas to draw, in its own pixels; the whole of it unless it stands in. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Something to show for a chunk not baked yet: the last canvas baked at the same place on the
 * same rung — the same ground, a road or a building short, or the old painting before the drawn
 * ground arrived — or failing that the part of a coarser rung's chunk that covers it. Blurrier
 * for a frame or two, which nobody sees; a hole in the map, which everybody would.
 */
function standIn(world: GameWorld, rung: number, bounds: Bounds): Omit<Placed, 'x' | 'y' | 'width' | 'height'> | null {
  for (let coarser = rung; coarser >= 0; coarser -= 1) {
    const level = LEVELS[coarser]!;
    const size = level.spacing * level.cells;
    const column = Math.floor(bounds.minX / size);
    const row = Math.floor(bounds.minY / size);
    const canvas = latest.get(placeKey(world.seed, coarser, column, row));
    if (!canvas) continue;
    const scale = canvas.width / size;
    return {
      canvas,
      sx: (bounds.minX - column * size) * scale,
      sy: (bounds.minY - row * size) * scale,
      sw: (bounds.maxX - bounds.minX) * scale,
      sh: (bounds.maxY - bounds.minY) * scale,
    };
  }
  return null;
}

function drawChunks(
  ctx: CanvasRenderingContext2D,
  world: GameWorld,
  view: Bounds,
  level: GroundLevel,
): void {
  const size = level.spacing * level.cells;
  const rung = LEVELS.indexOf(level);

  const firstColumn = Math.floor(view.minX / size);
  const lastColumn = Math.floor(view.maxX / size);
  const firstRow = Math.floor(view.minY / size);
  const lastRow = Math.floor(view.maxY / size);

  // Chunks are placed on whole buffer pixels, not on their world coordinates.
  //
  // Drawn in world units under the camera, a chunk's edges land wherever the zoom puts them —
  // almost never on a pixel boundary. Two chunks that share an edge exactly in the world then
  // get rasterised independently, each rounding its own way, and the parchment shows through the
  // sliver between them as a pale seam. Rounding both edges through the same function removes
  // the possibility: one chunk's right edge and its neighbour's left edge are the same world
  // number, so they round to the same pixel and cannot disagree.
  //
  // It also stops the ground crawling under the camera, which pixel art notices and the pencil
  // never did.
  const toScreen = ctx.getTransform();
  const atX = (world: number): number => Math.round(toScreen.a * world + toScreen.e);
  const atY = (world: number): number => Math.round(toScreen.d * world + toScreen.f);

  const wanted: { key: string; place: string; bounds: Bounds; canvas?: HTMLCanvasElement }[] = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const bounds: Bounds = {
        minX: column * size,
        minY: row * size,
        maxX: (column + 1) * size,
        maxY: (row + 1) * size,
      };
      const key = chunkKey(world, rung, column, row, bounds);
      const canvas = chunks.get(key);
      wanted.push({ key, place: placeKey(world.seed, rung, column, row), bounds, ...(canvas ? { canvas } : {}) });
    }
  }

  // The missing ones: the holes first — a chunk with nothing to show in its place at all — then
  // the ones that have something to stand in, each nearest the middle of the view first, until
  // the frame's budget is spent. A hole is bare paper and is worth a dropped frame; a chunk
  // showing the same ground a road or a felled tree out of date is not, and waits its turn.
  const middleX = (view.minX + view.maxX) / 2;
  const middleY = (view.minY + view.maxY) / 2;
  const settled = drawnRung === rung;
  drawnRung = rung;

  const missing = wanted
    .filter((chunk) => !chunk.canvas)
    .map((chunk) => ({ chunk, stand: standIn(world, rung, chunk.bounds) }))
    .filter(({ stand }) => settled || !stand)
    .sort(
      (a, b) =>
        Number(a.stand !== null) - Number(b.stand !== null) ||
        Math.hypot((a.chunk.bounds.minX + a.chunk.bounds.maxX) / 2 - middleX, (a.chunk.bounds.minY + a.chunk.bounds.maxY) / 2 - middleY) -
          Math.hypot((b.chunk.bounds.minX + b.chunk.bounds.maxX) / 2 - middleX, (b.chunk.bounds.minY + b.chunk.bounds.maxY) / 2 - middleY),
    );
  const started = performance.now();
  for (const [index, { chunk }] of missing.entries()) {
    if (index > 0 && performance.now() - started > BAKE_BUDGET_MS) break;
    const canvas = bakeTexelChunk(world, level, chunk.bounds);
    if (!canvas) continue;
    chunk.canvas = canvas;
    latest.delete(chunk.place);
    latest.set(chunk.place, canvas);
  }

  const placed: Placed[] = [];
  for (const chunk of wanted) {
    const x = atX(chunk.bounds.minX);
    const y = atY(chunk.bounds.minY);
    const width = atX(chunk.bounds.maxX) - x;
    const height = atY(chunk.bounds.maxY) - y;

    if (chunk.canvas) {
      chunks.delete(chunk.key);
      chunks.set(chunk.key, chunk.canvas);
      placed.push({ canvas: chunk.canvas, sx: 0, sy: 0, sw: chunk.canvas.width, sh: chunk.canvas.height, x, y, width, height });
      continue;
    }
    const stand = standIn(world, rung, chunk.bounds);
    if (stand) placed.push({ ...stand, x, y, width, height });
  }

  // Laid down in buffer pixels, with the camera's transform off: the positions above are
  // already in that space, and leaving the transform on would apply the zoom to them twice.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  for (const chunk of placed) {
    ctx.drawImage(chunk.canvas, chunk.sx, chunk.sy, chunk.sw, chunk.sh, chunk.x, chunk.y, chunk.width, chunk.height);
  }
  ctx.restore();

  while (chunks.size > CHUNK_BUDGET) chunks.delete([...chunks.keys()][0]!);
  // Twice the chunk budget: the stand-ins for this rung and the coarser ones zooming passes through.
  while (latest.size > CHUNK_BUDGET * 2) latest.delete([...latest.keys()][0]!);
}

/**
 * One town, too far off to draw: three roofs and its name.
 *
 * Both are **pixel art at a fixed size in buffer pixels**, which is the whole of what changed
 * here. The mark used to be three wobbled pencil huts and the name a sketched hand, drawn in
 * world units and scaled by `1/zoom` — one drawing in a vector hand lying on a map made of
 * pixels, and the eye reads the finer grid of the two as a picture resting on the map rather
 * than as part of it. That is the same rule `drawTile` exists for; a mark simply cannot follow
 * a rung, since it stands for a town rather than covering one.
 *
 * So the mark is `drawMark` and the name is the HUD's own 5x7, haloed in the map's paper so it
 * can be read over any ground there is. The town is drawn whether or not its tile has decoded —
 * a name on bare ground is still a town found; a tile that never arrives is not.
 */
function drawSettlementMarks(ctx: CanvasRenderingContext2D, world: GameWorld, time: number): void {
  const transform = ctx.getTransform();
  if (transform.b !== 0 || transform.c !== 0) return;

  for (const settlement of world.settlements.values()) {
    const hearth = settlement.buildings.get(settlement.hearthId);
    if (!hearth) continue;

    const stage = stageFor(settlement.buildings.size);
    const box = drawMark(
      ctx,
      stage.mark,
      hearth.position.x,
      hearth.position.y,
      stage.clip,
      Math.floor(time * FRAMES_PER_SECOND),
    );
    const middle = Math.round(transform.d * hearth.position.y + transform.f);
    drawMapLabel(
      ctx,
      settlement.name,
      Math.round(transform.a * hearth.position.x + transform.e),
      // Under the drawing's feet, or under where they would have been: the mark's own shadow is
      // the last row of it, so the gap is measured from the bottom of the tile and not from the
      // hearth. A name that moves when the tile arrives is a name that jumps once per session.
      middle + (box ? box.size : stage.cells) / 2 - 1,
      INK,
      MARK_HALO,
    );
  }
}

export interface WorldView {
  bounds: Bounds;
  zoom: number;
  time: number;
}

export function drawWorld(ctx: CanvasRenderingContext2D, world: GameWorld, view: WorldView): void {
  const level = levelFor(view.zoom);

  // One rung only. Drawing the coarse map underneath a close-up seemed harmless and was not:
  // magnified eleven times it is a blur, and the crisp chunks on top read as a mesh over mud.
  drawChunks(ctx, world, view.bounds, level);

  if (level.detail !== 'fine') drawSettlementMarks(ctx, world, view.time);
}

export function describeParcel(parcel: Parcel): string {
  const percent = (value: number): string => `${Math.round(value * 100)}`;
  return (
    `${parcel.biome} · temp ${percent(parcel.environment.temperature)} · ` +
    `humid ${percent(parcel.environment.humidity)} · elev ${percent(parcel.environment.elevation)}`
  );
}

export const centreOf = (parcel: Parcel): Vec2 => polygonCentroid(parcel.vertices);
