import { polygonCentroid } from '../sim/geometry.ts';
import type { Bounds, Vec2 } from '../sim/geometry.ts';
import type { Detail, Parcel } from '../sim/parcels.ts';

import { Biome } from '../sim/types.ts';
import type { GameWorld } from '../sim/world.ts';
import { drawnBounds } from './camera.ts';
import { BIOME_COLORS, INK } from './palette.ts';
import {
  drawWobblyPath,
  fillPolygon,
  hatchRegion,
  pencil,
  sketchText,
  strokeWeight,
} from './scribble.ts';
import { LEVELS, chunkKey, levelFor, texelsIn } from './terrainPixels.ts';
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
 * The ground as texels, one buffer pixel each at the zoom the rung starts at.
 *
 * The canvas *is* the texel grid — every rung bakes the same 256 pixels square, whatever lattice
 * and however many texels to a cell it reads — and the camera magnifies it from there by
 * somewhere between one and two, which is the range where uneven texels read as variation in
 * the ground rather than as a ripple.
 *
 * No parcel outlines and no hatching. A cell's edge is where its texels dither into its
 * neighbour's, which is the only border the ground has ever actually had.
 */
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

function drawChunks(
  ctx: CanvasRenderingContext2D,
  world: GameWorld,
  view: Bounds,
  level: GroundLevel,
): void {
  const size = level.spacing * level.cells;

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

  const placed: { canvas: HTMLCanvasElement; x: number; y: number; width: number; height: number }[] = [];

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const bounds: Bounds = {
        minX: column * size,
        minY: row * size,
        maxX: (column + 1) * size,
        maxY: (row + 1) * size,
      };
      const key = chunkKey(world, LEVELS.indexOf(level), column, row, bounds);

      let canvas = chunks.get(key);
      if (canvas) {
        chunks.delete(key);
      } else {
        canvas = bakeTexelChunk(world, level, bounds);
        if (!canvas) continue;
      }
      chunks.set(key, canvas);

      const x = atX(bounds.minX);
      const y = atY(bounds.minY);
      placed.push({ canvas, x, y, width: atX(bounds.maxX) - x, height: atY(bounds.maxY) - y });
    }
  }

  // Laid down in buffer pixels, with the camera's transform off: the positions above are
  // already in that space, and leaving the transform on would apply the zoom to them twice.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  for (const chunk of placed) {
    ctx.drawImage(chunk.canvas, chunk.x, chunk.y, chunk.width, chunk.height);
  }
  ctx.restore();

  while (chunks.size > CHUNK_BUDGET) chunks.delete([...chunks.keys()][0]!);
}

/**
 * How a settlement reads from far off: a few huts and its name. Only drawn once the buildings
 * themselves are too small to make out — up close the town speaks for itself, and the mark would
 * sit on top of it.
 */
function drawSettlementMarks(ctx: CanvasRenderingContext2D, world: GameWorld, zoom: number): void {
  const hut = 7 / zoom;

  for (const settlement of world.settlements.values()) {
    const hearth = settlement.buildings.get(settlement.hearthId);
    if (!hearth) continue;

    pencil(ctx, INK, strokeWeight.form / zoom);
    for (let i = 0; i < 3; i += 1) {
      const ox = hearth.position.x + (i - 1) * hut * 1.4;
      const oy = hearth.position.y + (i === 1 ? -hut * 0.6 : 0);
      drawWobblyPath(
        ctx,
        [
          { x: ox - hut * 0.6, y: oy + hut * 0.6 },
          { x: ox - hut * 0.6, y: oy - hut * 0.2 },
          { x: ox, y: oy - hut },
          { x: ox + hut * 0.6, y: oy - hut * 0.2 },
          { x: ox + hut * 0.6, y: oy + hut * 0.6 },
        ],
        { amplitude: 0.2, step: hut },
        true,
      );
    }

    sketchText(ctx, settlement.name, hearth.position.x, hearth.position.y + hut * 2.2, {
      size: 13 / zoom,
      color: INK,
    });
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

  if (level.detail !== 'fine') drawSettlementMarks(ctx, world, view.zoom);
}

export function describeParcel(parcel: Parcel): string {
  const percent = (value: number): string => `${Math.round(value * 100)}`;
  return (
    `${parcel.biome} · temp ${percent(parcel.environment.temperature)} · ` +
    `humid ${percent(parcel.environment.humidity)} · elev ${percent(parcel.environment.elevation)}`
  );
}

export const centreOf = (parcel: Parcel): Vec2 => polygonCentroid(parcel.vertices);
