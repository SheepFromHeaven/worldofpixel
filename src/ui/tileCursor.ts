import { ALERT, ALERT_SHADE, SELECTION, SELECTION_SHADE } from '../render/palette.ts';
import { NOWHERE, type TileIndex } from '../sim/grid.ts';
import type { World } from '../sim/world.ts';

function outline(
  ctx: CanvasRenderingContext2D,
  world: World,
  index: TileIndex,
  color: string,
  inset: number,
): void {
  const { minX, minY, maxX, maxY } = world.grid.bounds(index);
  const pixel = 1 / ctx.getTransform().a;
  const edge = inset * pixel;

  ctx.strokeStyle = color;
  ctx.lineWidth = pixel;
  ctx.strokeRect(
    minX + edge + pixel / 2,
    minY + edge + pixel / 2,
    maxX - minX - edge * 2 - pixel,
    maxY - minY - edge * 2 - pixel,
  );
}

export function drawTileCursor(
  ctx: CanvasRenderingContext2D,
  world: World,
  hovered: TileIndex,
  opened: TileIndex,
): void {
  if (hovered === NOWHERE && opened === NOWHERE) return;

  ctx.save();
  if (opened !== NOWHERE) {
    outline(ctx, world, opened, SELECTION_SHADE, 0);
    outline(ctx, world, opened, SELECTION, 1);
  }
  if (hovered !== NOWHERE && hovered !== opened) outline(ctx, world, hovered, SELECTION, 0);
  ctx.restore();
}

const MARK_HALF_TILES = 0.62;

const MARK_ARM_TILES = 0.22;

export function drawPersonMark(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const pixel = 1 / ctx.getTransform().a;
  const half = Math.round(MARK_HALF_TILES / pixel) * pixel;
  const arm = Math.max(pixel * 2, Math.round(MARK_ARM_TILES / pixel) * pixel);
  const left = Math.round((x - half) / pixel) * pixel;
  const top = Math.round((y - half) / pixel) * pixel;
  const corners = [
    [left, top, 1, 1],
    [left + half * 2, top, -1, 1],
    [left, top + half * 2, 1, -1],
    [left + half * 2, top + half * 2, -1, -1],
  ] as const;

  ctx.save();
  for (const [colour, grow] of [
    [SELECTION_SHADE, pixel],
    [SELECTION, 0],
  ] as const) {
    ctx.fillStyle = colour;
    for (const [cx, cy, dx, dy] of corners) {
      const across = dx > 0 ? cx : cx - arm;
      const down = dy > 0 ? cy : cy - arm;
      ctx.fillRect(across - grow, (dy > 0 ? cy : cy - pixel) - grow, arm + grow * 2, pixel + grow * 2);
      ctx.fillRect((dx > 0 ? cx : cx - pixel) - grow, down - grow, pixel + grow * 2, arm + grow * 2);
    }
  }
  ctx.restore();
}

const ALERT_PIXEL_SCREEN = 2;

const ALERT_LIFT_TILES = 0.9;

const ALERT_BOB_HZ = 3;

const ALERT_ART: readonly string[] = ['.XX.', '.XX.', '.XX.', '.XX.', '....', '.XX.'];

export function drawAlert(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const pixel = ALERT_PIXEL_SCREEN / ctx.getTransform().a;
  const bob = Math.floor(time * ALERT_BOB_HZ) % 2 === 0 ? 0 : pixel;
  const left = Math.round((x - (ALERT_ART[0]!.length * pixel) / 2) / pixel) * pixel;
  const top = Math.round((y - ALERT_LIFT_TILES - ALERT_ART.length * pixel - bob) / pixel) * pixel;

  ctx.save();
  for (const [colour, grow] of [
    [ALERT_SHADE, pixel],
    [ALERT, 0],
  ] as const) {
    ctx.fillStyle = colour;
    ALERT_ART.forEach((row, line) => {
      for (let at = 0; at < row.length; at += 1) {
        if (row[at] === 'X') ctx.fillRect(left + at * pixel - grow, top + line * pixel - grow, pixel + grow * 2, pixel + grow * 2);
      }
    });
  }
  ctx.restore();
}
