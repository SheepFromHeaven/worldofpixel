import { BLOCK_ITEMS, blockAt } from '../sim/blocks.ts';
import { RECIPES, describeRecipe, recipeById } from '../sim/recipes.ts';
import { BlockKind, Direction, PLACEABLE_BLOCKS } from '../sim/types.ts';
import type { Block, Design, ItemType, RecipeId } from '../sim/types.ts';
import type { Viewport } from './camera.ts';
import { drawBlockFace, drawFacingArrow } from './blockGlyphs.ts';
import { drawIcon, drawPixelText, drawPlate } from './hudPlates.ts';
import { itemIcon } from '../pixel/ui/metrics.ts';
import { BONE_INK, FELT_SOFT, PAPER, RED_PENCIL } from './palette.ts';

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

/** The gap a tile needs round it on the grid, so two of them read as two pieces and not a wall. */
const LAID_GAP = 4;

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

/**
 * A row of the palette, as a tile laid on the board.
 *
 * Three plates rather than one plate with a ring drawn round it: a chosen piece is one that has
 * been pushed forward, and that is a different bevel, not a highlight. The ring was what the
 * pencil could manage; the plate can say it properly.
 */
function tile(ctx: CanvasRenderingContext2D, rect: Rect, chosen: boolean): void {
  drawPlate(ctx, chosen ? 'tile-on' : 'tile', rect);
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
 * The designer sheet: a board, a shelf of pieces down one side, and the squares a machine is
 * laid out on.
 *
 * Everything on it is the same two baked sheets the build bar lays through CSS, so a block
 * chosen off the shelf and a block standing on the grid are the same tile and not two drawings
 * that happen to agree. The grid's empty squares are slots pressed into the felt rather than
 * ruled lines — a board you are putting pieces down on, not a sheet you are drawing on.
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
  // The board the pieces are laid on, filling the sheet. Nothing here is parchment any more:
  // this is a table with a cloth on it, and the blocks are what is being arranged on it.
  drawPlate(ctx, 'board', { x: 0, y: 0, w: viewport.width, h: viewport.height });

  drawPixelText(ctx, 'blocks', PAD + 2, PAD + 8, { color: FELT_SOFT, align: 'left' });
  for (const entry of layout.kinds) {
    const chosen = selection.kind === entry.kind;
    tile(ctx, entry.rect, chosen);
    const size = entry.rect.h - 12;
    const block = sample(entry.kind, selection.facing, selection.item, selection.recipeId);
    // `bare`: the row is already a tile, and a tile laid on a tile is two bevels deep.
    drawBlockFace(ctx, block, entry.rect.x + 7, entry.rect.y + 6, size, { time, bare: true, held: chosen });
    drawPixelText(ctx, entry.kind.toLowerCase(), entry.rect.x + size + 16, entry.rect.y + entry.rect.h / 2, {
      color: chosen ? PAPER : BONE_INK,
      align: 'left',
    });
  }

  const facingTop = layout.facings[0]?.rect.y ?? 0;
  drawPixelText(ctx, 'facing', PAD + 2, facingTop - 14, { color: FELT_SOFT, align: 'left' });
  for (const entry of layout.facings) {
    const chosen = selection.facing === entry.facing;
    tile(ctx, entry.rect, chosen);
    ctx.fillStyle = chosen ? PAPER : RED_PENCIL;
    drawFacingArrow(
      ctx,
      entry.facing,
      entry.rect.x + entry.rect.w / 2,
      entry.rect.y + entry.rect.h / 2,
      entry.rect.w,
      0.24,
    );
  }

  if (layout.items.length > 0) {
    drawPixelText(ctx, 'item', PAD + 2, layout.shelfTop - 14, { color: FELT_SOFT, align: 'left' });
    for (const entry of layout.items) {
      const chosen = selection.item === entry.item;
      tile(ctx, entry.rect, chosen);
      drawIcon(ctx, itemIcon(entry.item), entry.rect.x + 24, entry.rect.y + entry.rect.h / 2, 26);
      drawPixelText(ctx, entry.item.toLowerCase(), entry.rect.x + 44, entry.rect.y + entry.rect.h / 2, {
        color: chosen ? PAPER : BONE_INK,
        align: 'left',
      });
    }
  }

  if (layout.recipes.length > 0) {
    drawPixelText(ctx, 'recipe', PAD + 2, layout.shelfTop - 14, { color: FELT_SOFT, align: 'left' });
    for (const entry of layout.recipes) {
      const chosen = selection.recipeId === entry.recipeId;
      tile(ctx, entry.rect, chosen);
      drawPixelText(ctx, entry.label, entry.rect.x + 12, entry.rect.y + entry.rect.h / 2, {
        color: chosen ? PAPER : BONE_INK,
        align: 'left',
      });
    }
  }

  const { cell, gridLeft, gridTop } = layout;
  for (let y = 0; y < design.height; y += 1) {
    for (let x = 0; x < design.width; x += 1) {
      const rect: Rect = { x: gridLeft + x * cell, y: gridTop + y * cell, w: cell, h: cell };
      const laid = {
        x: rect.x + LAID_GAP / 2,
        y: rect.y + LAID_GAP / 2,
        w: cell - LAID_GAP,
        h: cell - LAID_GAP,
      };
      const block = design.blocks[blockAt(design, x, y)];
      const under = hovered?.x === x && hovered.y === y;

      // Every square of the grid is a place a tile can go, drawn as one: the empty ones are
      // pressed into the felt, so the board reads as waiting rather than as a ruled sheet.
      if (!block) drawPlate(ctx, 'slot', laid);

      if (block) {
        drawBlockFace(ctx, block, laid.x, laid.y, laid.w, { time, working: true, held: under });
        const label = labelOf(block);
        if (label) {
          drawPixelText(ctx, label.toLowerCase(), rect.x + cell / 2, rect.y + cell - LAID_GAP - 8, {
            color: under ? PAPER : BONE_INK,
            align: 'center',
          });
        }
      } else if (under) {
        // What this click would lay down, shown through the board rather than on it.
        drawBlockFace(
          ctx,
          sample(selection.kind, selection.facing, selection.item, selection.recipeId),
          laid.x,
          laid.y,
          laid.w,
          { time, alpha: 0.55 },
        );
      }
    }
  }
}
