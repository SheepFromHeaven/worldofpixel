import type { Bounds } from '../sim/geometry.ts';
import type { Detail } from '../sim/terrain/parcels.ts';

import type { GameWorld } from '../sim/world.ts';
import { drawMapLabel } from './hudPlates.ts';
import { INK, MARK_HALO } from './palette.ts';
import { FRAMES_PER_SECOND, drawMark } from './sprites.ts';
import type { GroundLevel } from './terrainPixels.ts';
import { LEVELS, chunkKey, levelFor, texelsIn } from './terrainPixels.ts';
import type { TownStage } from './townStage.ts';
import { townStage } from './townStage.ts';

export function detailFor(zoom: number): Detail {
  return levelFor(zoom).detail;
}

const CHUNK_BUDGET = 96;

const chunks = new Map<string, HTMLCanvasElement>();

const latest = new Map<string, HTMLCanvasElement>();
const placeKey = (seed: number, rung: number, column: number, row: number): string => `${seed}:${rung}:${column}:${row}`;

const BAKE_BUDGET_MS = 8;

interface Stage {
  mark: string;
  clip: string;
  cells: number;
}

const STAGES: Record<TownStage, Stage> = {
  stone: { mark: 'town-stone', clip: 'default', cells: 32 },
  village: { mark: 'town-village', clip: 'default', cells: 32 },
  huts: { mark: 'town-huts', clip: 'default', cells: 32 },
  fire: { mark: 'hearth', clip: 'burn', cells: 16 },
};

const stageFor = (buildings: number): Stage => STAGES[townStage(buildings)];

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
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

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

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  for (const chunk of placed) {
    ctx.drawImage(chunk.canvas, chunk.sx, chunk.sy, chunk.sw, chunk.sh, chunk.x, chunk.y, chunk.width, chunk.height);
  }
  ctx.restore();

  while (chunks.size > CHUNK_BUDGET) chunks.delete([...chunks.keys()][0]!);
  while (latest.size > CHUNK_BUDGET * 2) latest.delete([...latest.keys()][0]!);
}

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

  drawChunks(ctx, world, view.bounds, level);

  if (level.detail !== 'fine') drawSettlementMarks(ctx, world, view.time);
}
