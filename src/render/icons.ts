import { itemIcon } from '../pixel/ui/metrics.ts';
import type { ItemType } from '../sim/types.ts';
import { drawIcon } from './hudPlates.ts';

export function drawItemIcon(ctx: CanvasRenderingContext2D, item: ItemType, x: number, y: number, size: number): void {
  drawIcon(ctx, itemIcon(item), x, y, size * 2);
}
