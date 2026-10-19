import { BLOCK_ITEMS, blockAt } from '../sim/blocks.ts';
import { RECIPES, describeRecipe, recipeById } from '../sim/recipes.ts';
import { BlockKind, Direction, PLACEABLE_BLOCKS } from '../sim/types.ts';
import type { Block, Design, ItemType, RecipeId } from '../sim/types.ts';
import type { Viewport } from './camera.ts';
import { drawBlockFace, drawFacingArrow } from './blockGlyphs.ts';
import { drawItemIcon } from './icons.ts';
import { INK, INK_FAINT, INK_SOFT, RED_PENCIL } from './palette.ts';
import { drawPaper } from './paper.ts';
import { drawWobblyPath, pencil, sketchText, strokeWeight } from './scribble.ts';

export type PlaceableKind = (typeof PLACEABLE_BLOCKS)[number];

export interface DesignerSelection {
  kind: PlaceableKind;
  facing: Direction;
  item: ItemType;
  recipeId: RecipeId;
}

export type DesignerHit =
  | { target: 'cell'; x: number; y: number }
  | { target: 'kind'; kind: PlaceableKind }
  | { target: 'facing'; facing: Direction }
  | { target: 'item'; item: ItemType }
  | { target: 'recipe'; recipeId: RecipeId }
  | null;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DesignerLayout {
  kinds: { kind: PlaceableKind; rect: Rect }[];
  facings: { facing: Direction; rect: Rect }[];
  items: { item: ItemType; rect: Rect }[];
  recipes: { recipeId: RecipeId; label: string; rect: Rect }[];
  cell: number;
  gridLeft: number;
  gridTop: number;
  /** Where the item or recipe shelf starts, so the heading above it lands in the same place. */
  shelfTop: number;
}

const PAD = 26;
const COLUMN = 196;
const KIND_HEIGHT = 50;
const FACING_SIZE = 38;

const inside = (rect: Rect, x: number, y: number): boolean =>
  x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;

/** The height the column is drawn at before it has to be squeezed to fit a short window. */
const COLUMN_HEIGHT = 560;

export function layoutDesigner(
  viewport: Viewport,
  design: Design,
  selection: DesignerSelection,
): DesignerLayout {
  const squeeze = Math.min(1, viewport.height / COLUMN_HEIGHT);
  const kindHeight = KIND_HEIGHT * squeeze;
  const facingSize = FACING_SIZE * squeeze;
  const gap = 6 * squeeze;

  const kinds = PLACEABLE_BLOCKS.map((kind, index) => ({
    kind,
    rect: { x: PAD, y: PAD + 22 + index * (kindHeight + gap), w: COLUMN - 20, h: kindHeight },
  }));

  const facingTop = PAD + 22 + PLACEABLE_BLOCKS.length * (kindHeight + gap) + 30 * squeeze;
  const facings = [Direction.North, Direction.East, Direction.South, Direction.West].map(
    (facing, index) => ({
      facing,
      rect: { x: PAD + index * (facingSize + 6), y: facingTop, w: facingSize, h: facingSize },
    }),
  );

  const shelfTop = facingTop + facingSize + 34 * squeeze;
  const shelfRow = 40 * squeeze;
  const wantsItem =
    selection.kind === BlockKind.Source ||
    selection.kind === BlockKind.Input ||
    selection.kind === BlockKind.Output;

  const items = wantsItem
    ? BLOCK_ITEMS.map((item, index) => ({
        item,
        rect: { x: PAD, y: shelfTop + index * (shelfRow + 4), w: COLUMN - 20, h: shelfRow },
      }))
    : [];

  const recipes =
    selection.kind === BlockKind.Combine
      ? RECIPES.map((recipe, index) => ({
          recipeId: recipe.id,
          label: describeRecipe(recipe),
          rect: { x: PAD, y: shelfTop + index * (shelfRow + 4), w: COLUMN - 20, h: shelfRow },
        }))
      : [];

  const left = PAD + COLUMN + PAD;
  const span = Math.max(design.width, design.height);
  const cell = Math.min((viewport.width - left - PAD) / span, (viewport.height - PAD * 2) / span);

  return {
    kinds,
    facings,
    items,
    recipes,
    cell,
    gridLeft: left + (viewport.width - left - PAD - cell * design.width) / 2,
    gridTop: PAD + (viewport.height - PAD * 2 - cell * design.height) / 2,
    shelfTop,
  };
}

export function hitDesigner(
  layout: DesignerLayout,
  design: Design,
  x: number,
  y: number,
): DesignerHit {
  for (const entry of layout.kinds) {
    if (inside(entry.rect, x, y)) return { target: 'kind', kind: entry.kind };
  }
  for (const entry of layout.facings) {
    if (inside(entry.rect, x, y)) return { target: 'facing', facing: entry.facing };
  }
  for (const entry of layout.items) {
    if (inside(entry.rect, x, y)) return { target: 'item', item: entry.item };
  }
  for (const entry of layout.recipes) {
    if (inside(entry.rect, x, y)) return { target: 'recipe', recipeId: entry.recipeId };
  }

  const column = Math.floor((x - layout.gridLeft) / layout.cell);
  const row = Math.floor((y - layout.gridTop) / layout.cell);
  if (column < 0 || row < 0 || column >= design.width || row >= design.height) return null;
  return { target: 'cell', x: column, y: row };
}

function frame(ctx: CanvasRenderingContext2D, rect: Rect, inset = 0): void {
  drawWobblyPath(
    ctx,
    [
      { x: rect.x + inset, y: rect.y + inset },
      { x: rect.x + rect.w - inset, y: rect.y + inset },
      { x: rect.x + rect.w - inset, y: rect.y + rect.h - inset },
      { x: rect.x + inset, y: rect.y + rect.h - inset },
    ],
    { amplitude: 0.8, wavelength: 50, step: 10 },
    true,
  );
}

function tile(ctx: CanvasRenderingContext2D, rect: Rect, chosen: boolean): void {
  pencil(ctx, chosen ? RED_PENCIL : INK_FAINT, chosen ? strokeWeight.form : strokeWeight.texture, chosen ? 1 : 0.7);
  frame(ctx, rect);
  // A second line just inside, the way a pencil ring round a chosen thing is drawn twice.
  if (chosen) frame(ctx, rect, 3);
}

function sample(kind: PlaceableKind, facing: Direction, item: ItemType, recipeId: RecipeId): Block {
  switch (kind) {
    case BlockKind.Source:
      return { kind: BlockKind.Source, x: 0, y: 0, facing, item };
    case BlockKind.Input:
      return { kind: BlockKind.Input, x: 0, y: 0, facing, item };
    case BlockKind.Output:
      return { kind: BlockKind.Output, x: 0, y: 0, facing, item };
    case BlockKind.Combine:
      return { kind: BlockKind.Combine, x: 0, y: 0, facing, recipeId };
    case BlockKind.Storage:
      return { kind: BlockKind.Storage, x: 0, y: 0, facing };
    default:
      return { kind: BlockKind.Transport, x: 0, y: 0, facing };
  }
}

function labelOf(block: Block): string {
  if (
    block.kind === BlockKind.Source ||
    block.kind === BlockKind.Input ||
    block.kind === BlockKind.Output
  ) {
    return block.item;
  }
  if (block.kind === BlockKind.Combine) return recipeById(block.recipeId)?.label ?? block.recipeId;
  return '';
}

/**
 * The designer sheet, drawn with the same pencil as everything else. A building is drawn by hand
 * here and then stands on the map, so the two have to be the same drawing — a grid of boxed
 * symbols would say the inside of a building came from somewhere other than the player's hand.
 */
export function drawDesigner(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  design: Design,
  selection: DesignerSelection,
  layout: DesignerLayout,
  hovered: { x: number; y: number } | null,
  time: number,
): void {
  drawPaper(ctx, viewport.width, viewport.height);

  sketchText(ctx, 'blocks', PAD + 2, PAD + 6, { size: 13, color: INK_FAINT, align: 'left' });
  for (const entry of layout.kinds) {
    const chosen = selection.kind === entry.kind;
    tile(ctx, entry.rect, chosen);
    const size = entry.rect.h - 10;
    const block = sample(entry.kind, selection.facing, selection.item, selection.recipeId);
    drawBlockFace(ctx, block, entry.rect.x + 6, entry.rect.y + 5, size, {
      time,
      working: chosen,
      weight: strokeWeight.detail,
    });
    sketchText(ctx, entry.kind, entry.rect.x + size + 18, entry.rect.y + entry.rect.h / 2, {
      size: 16,
      color: chosen ? INK : INK_SOFT,
      align: 'left',
    });
  }

  const facingTop = layout.facings[0]?.rect.y ?? 0;
  sketchText(ctx, 'facing', PAD + 2, facingTop - 16, { size: 13, color: INK_FAINT, align: 'left' });
  for (const entry of layout.facings) {
    const chosen = selection.facing === entry.facing;
    tile(ctx, entry.rect, chosen);
    pencil(ctx, chosen ? RED_PENCIL : INK_SOFT, strokeWeight.detail, chosen ? 1 : 0.8);
    drawFacingArrow(
      ctx,
      entry.facing,
      entry.rect.x + entry.rect.w / 2,
      entry.rect.y + entry.rect.h / 2,
      entry.rect.w,
      0.3,
    );
  }

  if (layout.items.length > 0) {
    sketchText(ctx, 'item', PAD + 2, layout.shelfTop - 16, { size: 13, color: INK_FAINT, align: 'left' });
    for (const entry of layout.items) {
      const chosen = selection.item === entry.item;
      tile(ctx, entry.rect, chosen);
      drawItemIcon(ctx, entry.item, entry.rect.x + 22, entry.rect.y + entry.rect.h / 2, 9);
      sketchText(ctx, entry.item, entry.rect.x + 44, entry.rect.y + entry.rect.h / 2, {
        size: 15,
        color: chosen ? INK : INK_SOFT,
        align: 'left',
      });
    }
  }

  if (layout.recipes.length > 0) {
    sketchText(ctx, 'recipe', PAD + 2, layout.shelfTop - 16, { size: 13, color: INK_FAINT, align: 'left' });
    for (const entry of layout.recipes) {
      const chosen = selection.recipeId === entry.recipeId;
      tile(ctx, entry.rect, chosen);
      sketchText(ctx, entry.label, entry.rect.x + 12, entry.rect.y + entry.rect.h / 2, {
        size: 13,
        color: chosen ? INK : INK_SOFT,
        align: 'left',
      });
    }
  }

  const { cell, gridLeft, gridTop } = layout;
  for (let y = 0; y < design.height; y += 1) {
    for (let x = 0; x < design.width; x += 1) {
      const rect: Rect = { x: gridLeft + x * cell, y: gridTop + y * cell, w: cell, h: cell };
      const block = design.blocks[blockAt(design, x, y)];
      const under = hovered?.x === x && hovered.y === y;

      pencil(ctx, under ? RED_PENCIL : INK_FAINT, strokeWeight.texture, under ? 0.9 : 0.45);
      frame(ctx, rect, cell * 0.06);

      if (block) {
        drawBlockFace(ctx, block, rect.x, rect.y, cell, { time, working: true, weight: strokeWeight.form });
        const label = labelOf(block);
        if (label) {
          sketchText(ctx, label, rect.x + cell / 2, rect.y + cell * 0.88, { size: 13, color: INK_SOFT });
        }
      } else if (under) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        drawBlockFace(
          ctx,
          sample(selection.kind, selection.facing, selection.item, selection.recipeId),
          rect.x,
          rect.y,
          cell,
          { time, weight: strokeWeight.detail },
        );
        ctx.restore();
      }
    }
  }
}
