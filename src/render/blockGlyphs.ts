import { BlockKind, STEP } from '../sim/types.ts';
import type { Block, BlockKind as Kind, Direction } from '../sim/types.ts';
import { drawIcon, drawPlate } from './hudPlates.ts';
import type { IconName, PlateName } from './hudPlates.ts';
import { INK, RED_PENCIL } from './palette.ts';

export interface GlyphOptions {
  /** Seconds since start. Kept for callers that animate; a tile face does not flicker. */
  time: number;
  working?: boolean;
  alpha?: number;
  /** A tile pushed forward: what is chosen, or what the cursor is over. */
  held?: boolean;
  /** Draws the face without the tile under it, for a block already lying on a laid tile. */
  bare?: boolean;
}

/**
 * One drawing of each block kind, laid into a square of the caller's own units and used
 * everywhere a block appears: the designer's palette, the designer's grid, and the blueprint
 * sheet inside a building. Three hand-drawn copies of a funnel would have drifted apart by the
 * second block kind anyone added.
 *
 * **A block is a mahjong tile.** The piece is the baked plate and the face is the baked icon —
 * the same two sheets the build bar lays through CSS — so a block picked up off the palette and
 * a block standing on the grid are the same object, not two drawings that resemble each other.
 * Nothing here chooses a colour or a line weight; the bevel is in the plate.
 */
const FACES: Record<Kind, IconName> = {
  [BlockKind.Source]: 'source',
  [BlockKind.Input]: 'input',
  [BlockKind.Output]: 'output',
  [BlockKind.Combine]: 'combine',
  [BlockKind.Storage]: 'storage',
  [BlockKind.Transport]: 'transport',
  [BlockKind.Hearth]: 'hearth',
};

/**
 * Rectangles on whole device pixels, which is the only way a mark drawn beside a pixel tile
 * belongs to it. A triangle with antialiased edges beside a bevel cut from flat cells reads as
 * two drawings in the same square.
 */
function block(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const t = ctx.getTransform();
  if (t.b !== 0 || t.c !== 0) {
    ctx.fillRect(x, y, w, h);
    return;
  }
  const left = Math.round(t.a * x + t.e);
  const top = Math.round(t.d * y + t.f);
  const right = Math.round(t.a * (x + w) + t.e);
  const bottom = Math.round(t.d * (y + h) + t.f);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
  ctx.restore();
}

/**
 * Which way a block hands its load on, as a stepped wedge on the edge it faces.
 *
 * On the edge rather than across the face: the face is the icon, and an arrow drawn over it is
 * two marks fighting for the same twelve cells. A tile with a notch bitten out of one side is
 * also how a piece says which way round it goes without anything being written on it.
 */
export function drawFacingArrow(
  ctx: CanvasRenderingContext2D,
  facing: Direction,
  cx: number,
  cy: number,
  size: number,
  reach = 0.42,
): void {
  const step = STEP[facing];
  const unit = Math.max(1, size / 16);
  const steps = 4;
  const depth = size * reach;

  for (let i = 0; i < steps; i += 1) {
    // Narrowing by a cell a step: a wedge built out of whole cells is a pixel arrow, where a
    // triangle sampled at four heights is a triangle with the corners knocked off.
    const span = (steps - i) * unit;
    const along = depth - i * unit;
    const px = cx + step.x * along;
    const py = cy + step.y * along;
    const w = step.x === 0 ? span * 2 : unit;
    const h = step.y === 0 ? span * 2 : unit;
    block(ctx, px - w / 2, py - h / 2, w, h);
  }
}

const plateFor = (options: GlyphOptions): PlateName =>
  options.held ? 'tile-on' : options.working ? 'tile-hover' : 'tile';

/** The block itself, inside the square `(x, y) → (x + size, y + size)`. */
export function drawBlockFace(
  ctx: CanvasRenderingContext2D,
  block_: Block,
  x: number,
  y: number,
  size: number,
  options: GlyphOptions,
): void {
  const alpha = options.alpha ?? 1;
  const was = ctx.globalAlpha;
  ctx.globalAlpha = was * alpha;

  if (!options.bare) drawPlate(ctx, plateFor(options), { x, y, w: size, h: size });

  const face = FACES[block_.kind];
  // Room for the bevel on all four sides, so the drawing sits on the tile rather than over it.
  drawIcon(ctx, face, x + size / 2, y + size / 2, size * 0.66);

  // A bin is a terminus and a fire is not a machine; an arrow on either would promise it hands
  // its load on, which only the kinds that face somewhere actually do.
  if (block_.kind !== BlockKind.Hearth && block_.kind !== BlockKind.Storage) {
    ctx.fillStyle = options.held ? INK : RED_PENCIL;
    drawFacingArrow(
      ctx,
      block_.facing,
      x + size / 2,
      y + size / 2,
      size,
      block_.kind === BlockKind.Transport ? 0.4 : 0.44,
    );
  }

  ctx.globalAlpha = was;
}
