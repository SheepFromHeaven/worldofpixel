import { ItemType } from '../sim/types.ts';
import { INK, ITEM_COLORS } from './palette.ts';
import {
  drawWobblyCircle,
  drawWobblyLine,
  drawWobblyPath,
  fillWobblyPath,
  pencil,
  strokeSeed,
} from './scribble.ts';
import type { Vec2 } from '../sim/geometry.ts';

type Glyph = (ctx: CanvasRenderingContext2D, size: number, fill: string) => void;

/**
 * An item is a wash with a line round it, not an outline on its own. A chip over a building is
 * six screen pixels across, and at that size a figure drawn only in strokes reads as a scribble;
 * the fill is what carries the shape and the colour that far out.
 *
 * **Every wobble here is a fraction of the icon's own size.** The icon is drawn in whatever units
 * the caller uses — world units for a chip over a building, which are fractions of one — so an
 * absolute amplitude is as wide as the whole glyph and scribbles straight through it.
 */
function wash(
  ctx: CanvasRenderingContext2D,
  points: Vec2[],
  size: number,
  fill: string,
  alpha = 0.4,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  fillWobblyPath(ctx, points, { amplitude: size * 0.06, step: size * 0.5 });
  ctx.restore();
}

const GLYPHS: Record<ItemType, Glyph> = {
  [ItemType.Water]: (ctx, s, fill) => {
    const drop: Vec2[] = [
      { x: 0, y: -s },
      { x: s * 0.62, y: -s * 0.1 },
      { x: s * 0.52, y: s * 0.55 },
      { x: 0, y: s * 0.9 },
      { x: -s * 0.52, y: s * 0.55 },
      { x: -s * 0.62, y: -s * 0.1 },
    ];
    wash(ctx, drop, s, fill, 0.45);
    drawWobblyPath(ctx, drop, { amplitude: s * 0.06, step: s * 0.6, seed: 2 }, true);
  },

  [ItemType.Dirt]: (ctx, s, fill) => {
    // A heap sitting on the ground: one mound, filled, with a couple of clods over its shoulder.
    const heap: Vec2[] = [
      { x: -s, y: s * 0.7 },
      { x: -s * 0.66, y: -s * 0.05 },
      { x: -s * 0.2, y: -s * 0.52 },
      { x: s * 0.28, y: -s * 0.48 },
      { x: s * 0.7, y: 0 },
      { x: s, y: s * 0.7 },
    ];
    wash(ctx, heap, s, fill, 0.5);
    drawWobblyPath(ctx, heap, { amplitude: s * 0.05, step: s * 0.55, seed: 13 }, true);
    drawWobblyCircle(ctx, -s * 0.3, s * 0.2, s * 0.17, { amplitude: s * 0.05, seed: 15 });
    drawWobblyCircle(ctx, s * 0.32, s * 0.3, s * 0.14, { amplitude: s * 0.05, seed: 16 });
  },

  [ItemType.Mud]: (ctx, s, fill) => {
    const blob: Vec2[] = [
      { x: -s, y: s * 0.18 },
      { x: -s * 0.5, y: -s * 0.6 },
      { x: s * 0.45, y: -s * 0.52 },
      { x: s, y: s * 0.22 },
      { x: s * 0.2, y: s * 0.72 },
      { x: -s * 0.4, y: s * 0.66 },
    ];
    wash(ctx, blob, s, fill, 0.55);
    drawWobblyPath(ctx, blob, { amplitude: s * 0.07, step: s * 0.6, seed: 21 }, true);
    drawWobblyLine(ctx, -s * 0.15, s * 0.66, -s * 0.1, s, { amplitude: s * 0.05, step: s, seed: 22 });
  },
};

/**
 * Line weight as a fraction of the icon's own size. The icon is already sized in whatever units
 * the caller draws in, so a proportional stroke comes out the same width on screen at any zoom —
 * a fixed weight in world units turns the chip into a solid disc when you lean in.
 */
const ICON_STROKE = 0.18;

export function drawItemIcon(
  ctx: CanvasRenderingContext2D,
  item: ItemType,
  x: number,
  y: number,
  size: number,
  options: { color?: string; weight?: number } = {},
): void {
  ctx.save();
  ctx.translate(x, y);
  const color = options.color ?? ITEM_COLORS[item] ?? INK;
  pencil(ctx, color, options.weight ?? size * ICON_STROKE);
  GLYPHS[item](ctx, size, color);
  ctx.restore();
}

/** A pill behind an icon so cargo stays legible over hatching and ink paths. */
export function drawItemChip(
  ctx: CanvasRenderingContext2D,
  item: ItemType,
  x: number,
  y: number,
  size: number,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(244, 241, 234, 0.85)';
  ctx.beginPath();
  ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
  ctx.fill();
  pencil(ctx, ITEM_COLORS[item], size * ICON_STROKE);
  drawWobblyCircle(ctx, x, y, size * 1.5, { amplitude: size * 0.12, seed: strokeSeed(`chip${item}`) });
  ctx.restore();
  drawItemIcon(ctx, item, x, y, size * 0.9);
}
