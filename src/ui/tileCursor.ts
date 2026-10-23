import { SELECTION, SELECTION_SHADE } from '../render/palette.ts';
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
