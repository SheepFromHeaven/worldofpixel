import { blocksOf, isStore, labelOf, visibleBuffers } from '../sim/buildings.ts';
import { recipeOf } from '../sim/blocks.ts';
import { hashString } from '../sim/rng.ts';
import { BuildingState, CarrierState } from '../sim/types.ts';
import type { ItemType, Settlement } from '../sim/types.ts';
import type { Viewport } from './camera.ts';
import { drawItemIcon } from './icons.ts';
import { INK, INK_FAINT, INK_SOFT, PAPER, RED_PENCIL } from './palette.ts';
import { drawWobblyLine, drawWobblyPath, pencil, sketchText, strokeWeight } from './scribble.ts';

const STATE_WORDS: Record<BuildingState, string> = {
  [BuildingState.Clearing]: 'clearing the site',
  [BuildingState.Idle]: 'idle',
  [BuildingState.Working]: 'working',
  [BuildingState.Starved]: 'waiting on something',
  [BuildingState.Blocked]: 'backed up',
};

/**
 * The town read from far off, where it is one mark on the map and nothing in it is drawn. What
 * the eye cannot resolve at that distance the ledger has to say in words: who is working, who is
 * starved, what the carriers are carrying, and what the fire has kept.
 */
export function drawSettlementStats(
  ctx: CanvasRenderingContext2D,
  settlement: Settlement,
  viewport: Viewport,
  time: number,
): void {
  const width = Math.min(viewport.width * 0.5, 440);
  const height = Math.min(viewport.height * 0.74, 560);
  const left = (viewport.width - width) / 2;
  const top = (viewport.height - height) / 2;

  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#2b261f';
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  ctx.globalAlpha = 1;

  ctx.fillStyle = PAPER;
  ctx.fillRect(left, top, width, height);
  pencil(ctx, INK, strokeWeight.silhouette);
  drawWobblyPath(
    ctx,
    [
      { x: left, y: top },
      { x: left + width, y: top },
      { x: left + width, y: top + height },
      { x: left, y: top + height },
    ],
    { amplitude: 2, wavelength: 90, step: 16, seed: hashString(settlement.id) },
    true,
  );

  const hearth = settlement.buildings.get(settlement.hearthId);
  sketchText(ctx, settlement.name, left + width / 2, top + 34, { size: 22, color: INK });
  sketchText(
    ctx,
    `${settlement.buildings.size} buildings · ${settlement.carriers.size} carriers`,
    left + width / 2,
    top + 58,
    { size: 13, color: INK_SOFT },
  );

  let y = top + 92;
  const rule = (): void => {
    pencil(ctx, INK_FAINT, strokeWeight.texture, 0.7);
    drawWobblyLine(ctx, left + 26, y, left + width - 26, y, { amplitude: 0.6, step: 40 });
    y += 18;
  };

  sketchText(ctx, 'at work', left + 26, y, { size: 13, color: INK_FAINT, align: 'left' });
  y += 10;
  rule();

  for (const building of settlement.buildings.values()) {
    if (isStore(building) && building.id === settlement.hearthId) continue;
    const making = blocksOf(building)
      .map(({ block }) => recipeOf(block)?.label)
      .find((label) => label !== undefined);

    sketchText(ctx, labelOf(building), left + 26, y, { size: 15, color: INK, align: 'left' });
    sketchText(ctx, making ? `${STATE_WORDS[building.state]} · ${making}` : STATE_WORDS[building.state], left + 170, y, {
      size: 13,
      color: building.state === BuildingState.Blocked ? RED_PENCIL : INK_SOFT,
      align: 'left',
    });

    const buffers = visibleBuffers(building).filter((buffer) => buffer.amount > 0);
    buffers.slice(0, 4).forEach((buffer, index) => {
      const x = left + width - 40 - index * 28;
      drawItemIcon(ctx, buffer.item, x, y - 3, 7);
      sketchText(ctx, `${buffer.amount}`, x + 10, y, { size: 12, color: INK_SOFT, align: 'left' });
    });
    y += 26;
  }

  y += 10;
  sketchText(ctx, 'on the road', left + 26, y, { size: 13, color: INK_FAINT, align: 'left' });
  y += 10;
  rule();

  let idle = 0;
  const carrying = new Map<ItemType, number>();
  for (const carrier of settlement.carriers.values()) {
    if (carrier.state === CarrierState.Idle) idle += 1;
    if (carrier.carryingItem) {
      carrying.set(carrier.carryingItem, (carrying.get(carrier.carryingItem) ?? 0) + 1);
    }
  }

  sketchText(ctx, `${settlement.carriers.size - idle} walking, ${idle} waiting`, left + 26, y, {
    size: 14,
    color: INK,
    align: 'left',
  });
  [...carrying.entries()].forEach(([item, count], index) => {
    const x = left + width - 40 - index * 30;
    drawItemIcon(ctx, item, x, y - 3, 7);
    sketchText(ctx, `${count}`, x + 10, y, { size: 12, color: INK_SOFT, align: 'left' });
  });

  y += 34;
  sketchText(ctx, 'in the town store', left + 26, y, { size: 13, color: INK_FAINT, align: 'left' });
  y += 10;
  rule();

  const stock = new Map<ItemType, number>();
  for (const buffer of hearth ? visibleBuffers(hearth) : []) {
    if (buffer.amount > 0) stock.set(buffer.item, (stock.get(buffer.item) ?? 0) + buffer.amount);
  }
  const kept = [...stock.entries()];
  if (kept.length === 0) {
    sketchText(ctx, 'empty', left + 26, y, { size: 14, color: INK_SOFT, align: 'left' });
  }
  kept.forEach(([item, amount], index) => {
    const row = y + index * 26;
    drawItemIcon(ctx, item, left + 34, row - 3, 8);
    sketchText(ctx, item, left + 52, row, { size: 15, color: INK, align: 'left' });
    sketchText(ctx, `×${amount}`, left + width - 40, row, { size: 15, color: INK, align: 'right' });
  });

  sketchText(ctx, 'click anywhere to close · zoom in to walk among it', left + width / 2, top + height - 18, {
    size: 12,
    color: INK_FAINT,
    alpha: 0.8 + Math.sin(time) * 0.1,
  });

  ctx.restore();
}
