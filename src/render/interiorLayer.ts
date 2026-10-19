import { HEAD_SCALE, itemIcon } from '../pixel/ui/metrics.ts';
import { PUSH_TICKS, recipeOf } from '../sim/blocks.ts';
import { blocksOf } from '../sim/buildings.ts';
import { describeRecipe } from '../sim/recipes.ts';
import { BlockKind, STEP } from '../sim/types.ts';
import type { Block, BlockState, Building } from '../sim/types.ts';
import type { Viewport } from './camera.ts';
import { drawBlockFace } from './blockGlyphs.ts';
import { drawIcon, drawPixelText, drawPlate } from './hudPlates.ts';
import { BONE_INK, BONE_SOFT, FELT_INK, FELT_SOFT, ITEM_COLORS, RED_PENCIL } from './palette.ts';

/** The air round a tile on the sheet, so a row of them reads as pieces rather than as a wall. */
const TILE_GAP = 6;

/**
 * The live state over a block's own drawing: what it is holding, how far through a craft it is,
 * whether it fills itself off the ground. The block itself comes from `blockGlyphs`, which the
 * map and the designer draw from too — three hand-drawn funnels would have drifted apart by the
 * second block kind anyone added.
 */
function drawBlockState(
  ctx: CanvasRenderingContext2D,
  block: Block,
  state: BlockState,
  x: number,
  y: number,
  size: number,
  fedByGround: boolean,
  fraction: number,
): void {
  const held = state.held;
  const middle = x + size / 2;

  if (block.kind === BlockKind.Source) {
    // No number and no stock: what it draws goes straight onto the next square.
    drawPixelText(ctx, fedByGround ? 'open' : 'dry', middle, y + size * 0.84, {
      color: fedByGround ? BONE_SOFT : RED_PENCIL,
      align: 'center',
    });
    return;
  }

  if (block.kind === BlockKind.Storage) {
    if (held && held.amount > 0) {
      drawIcon(ctx, itemIcon(held.item), middle, y + size * 0.44, size * 0.4);
      drawPixelText(ctx, `${held.amount}/${held.capacity}`, middle, y + size * 0.84, {
        color: held.amount >= held.capacity ? RED_PENCIL : BONE_SOFT,
        align: 'center',
      });
    } else {
      drawPixelText(ctx, 'empty', middle, y + size * 0.84, { color: BONE_SOFT, align: 'center' });
    }
    return;
  }

  if (block.kind === BlockKind.Input || block.kind === BlockKind.Output) {
    if (held && held.amount > 0) {
      drawIcon(ctx, itemIcon(held.item), middle, y + size * 0.44, size * 0.4);
      drawPixelText(ctx, `${held.amount}`, middle, y + size * 0.84, {
        color: BONE_INK,
        align: 'center',
      });
    }
    return;
  }

  if (block.kind === BlockKind.Transport) {
    if (!held || held.amount <= 0) return;
    // A load lands with a full cooldown and leaves at zero, so the cooldown *is* how far across
    // the square it has got. The frame's fraction of a tick is added on top, which is the only
    // place the clock is allowed in: without it the belt steps twice a square instead of running.
    const step = STEP[block.facing];
    // Clamped at the far edge: a square that cannot hand its load on sits at zero cooldown, and
    // the frame fraction would otherwise carry the drawing on past the edge and snap it back
    // every tick — a load jittering back and forth against a full output.
    const travel = Math.min(0.5, 0.5 - (state.cooldown - fraction) / PUSH_TICKS);
    drawIcon(
      ctx,
      itemIcon(held.item),
      middle + step.x * travel * size,
      y + size / 2 + step.y * travel * size,
      size * 0.42,
    );
    return;
  }

  if (block.kind === BlockKind.Combine) {
    const recipe = recipeOf(block);
    if (recipe && state.progress > 0) {
      ctx.save();
      ctx.strokeStyle = ITEM_COLORS[recipe.output] ?? RED_PENCIL;
      ctx.lineWidth = 3;
      ctx.lineCap = 'butt';
      const turned = Math.min(1, (state.progress - 1 + fraction) / recipe.ticks);
      ctx.beginPath();
      ctx.arc(middle, y + size / 2, size * 0.42, -Math.PI / 2, -Math.PI / 2 + turned * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    [...state.hoppers.values()].forEach((hopper, index) => {
      const hx = x + size * (0.28 + index * 0.3);
      drawIcon(ctx, itemIcon(hopper.item), hx, y + size * 0.22, size * 0.26, hopper.amount > 0 ? 1 : 0.35);
      drawPixelText(ctx, `${hopper.amount}`, hx + size * 0.17, y + size * 0.22, {
        color: BONE_INK,
        align: 'left',
      });
    });

    if (held && held.amount > 0) {
      drawIcon(ctx, itemIcon(held.item), x + size * 0.78, y + size * 0.82, size * 0.3);
    }
  }
}

/**
 * Layer 4 is drawn in screen space as a blueprint pinned over the settlement: ruled, orthogonal
 * and square, against the organic Voronoi of every layer above it. That contrast is the whole
 * point — the inside of a building is built, the land outside it is not.
 *
 * What is drawn here is the design the player laid out, running. It is not a second simulation
 * and not a readout of one either: these are the same squares the tick moves things across.
 */
export function drawBuildingInterior(
  ctx: CanvasRenderingContext2D,
  building: Building,
  viewport: Viewport,
  time: number,
  fraction: number,
): void {
  const design = building.design;

  const cardWidth = Math.min(viewport.width * 0.62, 560);
  const cardHeight = Math.min(viewport.height * 0.78, 600);
  const left = Math.round((viewport.width - cardWidth) / 2);
  const top = Math.round((viewport.height - cardHeight) / 2);

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#16100a';
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  ctx.globalAlpha = 1;

  // The same board the designer lays its pieces on. A building's inside is the design standing
  // up and working, so it has to be the board the design was arranged on — a blueprint on
  // parchment would say the plan and the machine were two different things.
  drawPlate(ctx, 'board', { x: left, y: top, w: cardWidth, h: cardHeight });

  drawPixelText(ctx, design.label, left + cardWidth / 2, top + 30, {
    scale: HEAD_SCALE,
    color: FELT_INK,
    align: 'center',
  });
  const ground = building.yields.length > 0 ? `on ${building.yields.join(' and ')}` : 'on bare ground';
  drawPixelText(ctx, `${building.state.toLowerCase()} - ${ground}`, left + cardWidth / 2, top + 56, {
    color: FELT_SOFT,
    align: 'center',
  });

  const padding = 46;
  const gridSize = Math.min(cardWidth - padding * 2, cardHeight - 210);
  const tileSize = gridSize / Math.max(design.width, design.height);
  const gridLeft = left + (cardWidth - tileSize * design.width) / 2;
  const gridTop = top + 84;

  // Every square the design could hold, as a slot pressed into the felt. The ruled grid went
  // with the parchment: what the eye needs here is where a piece *could* go, not where the
  // lines of a drawing fall.
  const inner = tileSize - TILE_GAP;
  for (let y = 0; y < design.height; y += 1) {
    for (let x = 0; x < design.width; x += 1) {
      drawPlate(ctx, 'slot', {
        x: gridLeft + x * tileSize + TILE_GAP / 2,
        y: gridTop + y * tileSize + TILE_GAP / 2,
        w: inner,
        h: inner,
      });
    }
  }

  for (const { block, state } of blocksOf(building)) {
    const x = gridLeft + block.x * tileSize + TILE_GAP / 2;
    const y = gridTop + block.y * tileSize + TILE_GAP / 2;
    const busy = state.progress > 0 || (state.held?.amount ?? 0) > 0;
    drawBlockFace(ctx, block, x, y, inner, { time, working: busy });
    const fedByGround = block.kind === BlockKind.Source && building.yields.includes(block.item);
    drawBlockState(ctx, block, state, x, y, inner, fedByGround, fraction);
  }

  const footer = gridTop + tileSize * design.height + 26;
  const recipes = design.blocks.map((block) => recipeOf(block)).filter((recipe) => recipe !== undefined);
  const line =
    recipes.length > 0
      ? recipes.map((recipe) => describeRecipe(recipe)).join('   ')
      : `${design.blocks.length} blocks - nothing is combined here`;
  drawPixelText(ctx, line, left + cardWidth / 2, footer, { color: FELT_INK, align: 'center' });

  const kept = [...building.delivered.entries()];
  drawPixelText(
    ctx,
    kept.length > 0
      ? `kept: ${kept.map(([item, n]) => `${item} x${n}`).join('  ')}`
      : `made ${building.producedTotal} so far`,
    left + cardWidth / 2,
    footer + 24,
    { color: kept.length > 0 ? FELT_INK : FELT_SOFT, align: 'center' },
  );

  drawPixelText(ctx, 'esc / click outside to close', left + cardWidth / 2, top + cardHeight - 22, {
    color: FELT_SOFT,
    align: 'center',
  });

  ctx.restore();
}
