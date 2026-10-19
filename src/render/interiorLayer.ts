import { PUSH_TICKS, recipeOf } from '../sim/blocks.ts';
import { blocksOf } from '../sim/buildings.ts';
import { describeRecipe } from '../sim/recipes.ts';
import { hashString } from '../sim/rng.ts';
import { BlockKind, STEP } from '../sim/types.ts';
import type { Block, BlockState, Building } from '../sim/types.ts';
import type { Viewport } from './camera.ts';
import { drawBlockFace } from './blockGlyphs.ts';
import { drawItemIcon } from './icons.ts';
import { INK, INK_FAINT, INK_SOFT, ITEM_COLORS, PAPER, RED_PENCIL } from './palette.ts';
import { drawWobblyLine, drawWobblyPath, pencil, sketchText, strokeWeight } from './scribble.ts';

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

  if (block.kind === BlockKind.Source) {
    // No number and no stock: what it draws goes straight onto the next square.
    sketchText(ctx, fedByGround ? '∞' : 'dry', x + size * 0.5, y + size * 0.3, {
      size: fedByGround ? 20 : 14,
      color: fedByGround ? INK_SOFT : RED_PENCIL,
    });
    return;
  }

  if (block.kind === BlockKind.Input) {
    if (held && held.amount > 0) {
      drawItemIcon(ctx, held.item, x + size * 0.5, y + size * 0.46, size * 0.14);
      sketchText(ctx, `${held.amount}`, x + size * 0.5, y + size * 0.88, { size: 13, color: INK_SOFT });
    }
    return;
  }

  if (block.kind === BlockKind.Storage) {
    if (held && held.amount > 0) {
      drawItemIcon(ctx, held.item, x + size * 0.5, y + size * 0.56, size * 0.15);
      sketchText(ctx, `${held.amount}/${held.capacity}`, x + size * 0.5, y + size * 0.93, {
        size: 12,
        color: held.amount >= held.capacity ? RED_PENCIL : INK_SOFT,
      });
    } else {
      sketchText(ctx, 'empty', x + size * 0.5, y + size * 0.93, { size: 11, color: INK_FAINT });
    }
    return;
  }

  if (block.kind === BlockKind.Output) {
    if (held && held.amount > 0) {
      drawItemIcon(ctx, held.item, x + size * 0.5, y + size * 0.58, size * 0.15);
      sketchText(ctx, `${held.amount}`, x + size * 0.5, y + size * 0.88, { size: 13, color: INK_SOFT });
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
    drawItemIcon(
      ctx,
      held.item,
      x + size / 2 + step.x * travel * size,
      y + size / 2 + step.y * travel * size,
      size * 0.16,
    );
    return;
  }

  if (block.kind === BlockKind.Combine) {
    const recipe = recipeOf(block);
    if (recipe && state.progress > 0) {
      pencil(ctx, ITEM_COLORS[recipe.output], strokeWeight.form, 0.9);
      const turned = Math.min(1, (state.progress - 1 + fraction) / recipe.ticks);
      ctx.beginPath();
      ctx.arc(
        x + size / 2,
        y + size / 2,
        size * 0.38,
        -Math.PI / 2,
        -Math.PI / 2 + turned * Math.PI * 2,
      );
      ctx.stroke();
    }

    [...state.hoppers.values()].forEach((hopper, index) => {
      const hx = x + size * (0.22 + index * 0.28);
      ctx.globalAlpha = hopper.amount > 0 ? 1 : 0.3;
      drawItemIcon(ctx, hopper.item, hx, y + size * 0.14, size * 0.1);
      sketchText(ctx, `${hopper.amount}`, hx + size * 0.12, y + size * 0.15, {
        size: 12,
        color: INK_SOFT,
        align: 'left',
      });
      ctx.globalAlpha = 1;
    });

    if (held && held.amount > 0) {
      drawItemIcon(ctx, held.item, x + size * 0.8, y + size * 0.84, size * 0.12);
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

  const cardWidth = Math.min(viewport.width * 0.62, 520);
  const cardHeight = Math.min(viewport.height * 0.78, 580);
  const left = (viewport.width - cardWidth) / 2;
  const top = (viewport.height - cardHeight) / 2;

  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#2b261f';
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  ctx.globalAlpha = 1;

  ctx.fillStyle = PAPER;
  ctx.fillRect(left, top, cardWidth, cardHeight);
  pencil(ctx, INK, strokeWeight.silhouette);
  drawWobblyPath(
    ctx,
    [
      { x: left, y: top },
      { x: left + cardWidth, y: top },
      { x: left + cardWidth, y: top + cardHeight },
      { x: left, y: top + cardHeight },
    ],
    { amplitude: 2, wavelength: 90, step: 16, seed: hashString(building.id) },
    true,
  );

  sketchText(ctx, design.label, left + cardWidth / 2, top + 34, { size: 22, color: INK });
  const ground = building.yields.length > 0 ? `on ${building.yields.join(' and ')}` : 'on bare ground';
  sketchText(ctx, `${building.state.toLowerCase()} · ${ground}`, left + cardWidth / 2, top + 58, {
    size: 13,
    color: INK_SOFT,
  });

  const padding = 46;
  const gridSize = Math.min(cardWidth - padding * 2, cardHeight - 210);
  const tileSize = gridSize / Math.max(design.width, design.height);
  const gridLeft = left + (cardWidth - tileSize * design.width) / 2;
  const gridTop = top + 84;

  pencil(ctx, INK_FAINT, strokeWeight.detail, 0.8);
  for (let i = 0; i <= design.width; i += 1) {
    const x = gridLeft + i * tileSize;
    drawWobblyLine(ctx, x, gridTop, x, gridTop + tileSize * design.height, {
      amplitude: 1,
      wavelength: 120,
      step: 20,
      seed: 700 + i,
    });
  }
  for (let i = 0; i <= design.height; i += 1) {
    const y = gridTop + i * tileSize;
    drawWobblyLine(ctx, gridLeft, y, gridLeft + tileSize * design.width, y, {
      amplitude: 1,
      wavelength: 120,
      step: 20,
      seed: 720 + i,
    });
  }

  const inner = tileSize - TILE_GAP;
  for (const { block, state } of blocksOf(building)) {
    const x = gridLeft + block.x * tileSize + TILE_GAP / 2;
    const y = gridTop + block.y * tileSize + TILE_GAP / 2;
    const busy = state.progress > 0 || (state.held?.amount ?? 0) > 0;
    drawBlockFace(ctx, block, x, y, inner, { time, working: busy, weight: strokeWeight.form });
    const fedByGround = block.kind === BlockKind.Source && building.yields.includes(block.item);
    drawBlockState(ctx, block, state, x, y, inner, fedByGround, fraction);
  }

  const footer = gridTop + tileSize * design.height + 30;
  const recipes = design.blocks.map((block) => recipeOf(block)).filter((recipe) => recipe !== undefined);
  const line =
    recipes.length > 0
      ? recipes.map((recipe) => describeRecipe(recipe)).join('   ')
      : `${design.blocks.length} blocks · nothing is combined here`;
  sketchText(ctx, line, left + cardWidth / 2, footer, { size: 14, color: INK });

  const kept = [...building.delivered.entries()];
  if (kept.length > 0) {
    sketchText(ctx, `kept: ${kept.map(([item, n]) => `${item} ×${n}`).join('  ')}`, left + cardWidth / 2, footer + 28, {
      size: 13,
      color: INK,
    });
  } else {
    sketchText(ctx, `made ${building.producedTotal} so far`, left + cardWidth / 2, footer + 28, {
      size: 13,
      color: INK_SOFT,
    });
  }

  sketchText(ctx, 'esc / click outside to close', left + cardWidth / 2, top + cardHeight - 18, {
    size: 12,
    color: INK_FAINT,
  });

  ctx.restore();
}
