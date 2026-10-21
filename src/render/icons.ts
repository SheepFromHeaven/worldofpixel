import { itemIcon } from '../pixel/ui/metrics.ts';
import type { ItemType } from '../sim/types.ts';
import { drawIcon } from './hudPlates.ts';

/**
 * An item, wherever one is shown on the map: the baked pixel drawing, or nothing until the sheet
 * has decoded. `size` is a half-extent, so the box the icon has to fit is twice it.
 */
export function drawItemIcon(ctx: CanvasRenderingContext2D, item: ItemType, x: number, y: number, size: number): void {
  drawIcon(ctx, itemIcon(item), x, y, size * 2);
}
