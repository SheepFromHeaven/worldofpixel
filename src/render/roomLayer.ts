import { FLOOR_FOOT, FLOOR_ROWS, TILE_CELLS, TILT } from '../pixel/view.ts';
import { HEAD_SCALE, itemIcon } from '../pixel/ui/metrics.ts';
import { PUSH_TICKS, recipeOf, validateDesign } from '../sim/blocks.ts';
import { blocksOf } from '../sim/buildings.ts';
import { canFit, fittingFree } from '../sim/fitting.ts';
import { describeRecipe } from '../sim/recipes.ts';
import { RECIPES } from '../sim/recipes.ts';
import { BLOCK_ITEMS } from '../sim/blocks.ts';
import { BlockKind, Direction, STEP } from '../sim/types.ts';
import type { Block, BlockState, Building, Design, ItemType, RecipeId } from '../sim/types.ts';
import { hashString } from '../sim/rng.ts';
import type { Viewport } from './camera.ts';
import { drawIcon, drawPixelText, drawPlate, pixelTextWidth } from './hudPlates.ts';
import { drawSpriteBox } from './sprites.ts';
import { drawWobblyLine, pencil } from './scribble.ts';
import { BONE_INK, BONE_SOFT, DIRT, INK, INK_FAINT, INK_SOFT, ITEM_COLORS, PAPER_WARM, RED_PENCIL, YARD } from './palette.ts';

/**
 * The inside of a works, as a room.
 *
 * It was a blueprint before: a sheet of felt with the design laid out on it in boxed symbols,
 * ruled and square against the organic map. That contrast was the stated point of it and it was
 * the wrong point — it said the inside of a building was a diagram, and a diagram is not
 * somewhere you can be. What the player is doing in here is standing in a shed deciding where
 * the barrels go, so the shed is drawn: boards, three walls, the light coming in at the door.
 *
 * The floor is the map's own view (`pixel/view.ts`) and not an isometric one, which matters more
 * than it sounds: the grid is **axis-aligned and squashed to `TILT`**, so a square of floor is
 * wider than it is tall and nothing is rotated. A true isometric diamond would put every object
 * in here on a different axis from the well, the trees and the villagers out on the map, and the
 * two would never sit together. This way they are one drawing with one sun.
 *
 * A square of floor is *not* a square of ground, though. The map is drawn at a texel to a
 * hand's breadth; a room is a cutaway at its own scale, with a barrel filling most of a square.
 * One pixel grid, one palette, one light — but not one ruler.
 */

/**
 * Where a tile stands on its square: the front edge of the floor, which is also where anything
 * that has to meet the next square ends. `view.ts` owns the number — a tile drawn to one
 * footprint and stood on another leaves a seam at every join.
 */
const FOOT_IN_TILE = FLOOR_FOOT;

/**
 * What each tool is called on the strip.
 *
 * Named for what it does to the goods rather than for what it is made of — a player laying out a
 * workshop is thinking "where do the carriers put the water down", not "where does an input
 * block go".
 */
export const TOOL_NAMES: Record<string, string> = {
  [BlockKind.Input]: 'drop-off',
  [BlockKind.Output]: 'pick-up',
  [BlockKind.Transport]: 'chute',
  [BlockKind.Combine]: 'mixer',
  [BlockKind.Storage]: 'store',
  erase: 'clear',
};

/** The tools along the bottom: a block to lay, or the hand that takes one away. */
export type RoomTool = BlockKind | 'erase';

export interface RoomSelection {
  tool: RoomTool;
  item: ItemType;
  recipeId: RecipeId;
}

export const DEFAULT_SELECTION: RoomSelection = {
  tool: BlockKind.Input,
  item: BLOCK_ITEMS[0] ?? ('Water' as ItemType),
  recipeId: RECIPES[0]?.id ?? 'mud',
};

/** The blocks the player may lay in a works, in the order they appear on the strip. */
export const ROOM_TOOLS: readonly RoomTool[] = [
  BlockKind.Input,
  BlockKind.Transport,
  BlockKind.Combine,
  BlockKind.Storage,
  BlockKind.Output,
  'erase',
];

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoomLayout {
  /** The floor, in screen pixels: where its top-left corner is and how big a square is. */
  originX: number;
  originY: number;
  cellW: number;
  cellH: number;
  room: Rect;
  /** Room above the floor for the ring of stones at the back to stand in. */
  backEdge: number;
  tools: { tool: RoomTool; rect: Rect }[];
  items: { item: ItemType; rect: Rect }[];
  recipes: { recipeId: RecipeId; rect: Rect }[];
  pattern: Rect;
  close: Rect;
}

export type RoomHit =
  | { target: 'floor'; x: number; y: number }
  | { target: 'tool'; tool: RoomTool }
  | { target: 'item'; item: ItemType }
  | { target: 'recipe'; recipeId: RecipeId }
  | { target: 'pattern' }
  | { target: 'close' }
  | null;

const inside = (rect: Rect, x: number, y: number): boolean =>
  x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;

const TOOL = 54;
const SHELF = 40;

/**
 * Where everything in the room falls. A pure function of the viewport and the building, so the
 * draw and the hit test cannot disagree about what is under the cursor — the same arrangement
 * the designer's sheet used, and the one thing about it worth keeping.
 */
export function layoutRoom(viewport: Viewport, building: Building): RoomLayout {
  const design = building.design;

  const padX = 54;
  const strip = TOOL + 34;
  /** Clear of the room's own heading, so the wall starts below the words rather than behind them. */
  const heading = 76;
  /** The back stones stand about half a square tall, and the floor has to clear them. */
  const ring = 0.5;

  // The floor first, the room round it afterwards.
  //
  // **A square of floor is a whole number of tile cells across.** The tile is blitted at a whole
  // number of pixels to the cell or its pixels come out uneven, so a square that is not a
  // multiple of the tile's own grid is drawn a few pixels narrower than it is — and two chutes
  // side by side then have daylight between them however carefully the sprite is drawn.
  //
  // That snapping leaves a step: the floor goes from three pixels to the cell to two with
  // nothing in between. Sized inside a panel fixed to the window, the smaller step left a broad
  // empty border — so the panel is cut to the floor rather than the floor fitted to the panel,
  // and the room comes out snug at every size.
  const widest = Math.min(
    (Math.min(viewport.width * 0.82, 900) - padX * 2) / design.width,
    (Math.min(viewport.height * 0.86, 660) - strip - heading) / (ring + TILT * design.height),
  );
  const cellW = Math.max(TILE_CELLS, Math.floor(widest / TILE_CELLS) * TILE_CELLS);
  const cellH = (cellW / TILE_CELLS) * FLOOR_ROWS;
  const backEdge = Math.round(cellW * ring);

  const floorW = cellW * design.width;
  const floorH = cellH * design.height;
  // Wide enough for the strip of tools as well, which does not shrink with the floor.
  const roomW = Math.max(floorW + padX * 2, ROOM_TOOLS.length * (TOOL + 8) + padX * 2 + 200);
  const roomH = heading + backEdge + floorH + strip + 16;
  const room: Rect = {
    x: Math.round((viewport.width - roomW) / 2),
    y: Math.round((viewport.height - roomH) / 2),
    w: Math.round(roomW),
    h: Math.round(roomH),
  };

  const originX = Math.round(room.x + (room.w - floorW) / 2);
  const originY = Math.round(room.y + heading + backEdge);

  const stripY = room.y + room.h - strip + 4;
  const tools = ROOM_TOOLS.map((tool, index) => ({
    tool,
    rect: { x: room.x + padX + index * (TOOL + 8), y: stripY, w: TOOL, h: TOOL },
  }));

  // The shelf of items or recipes sits beside the tools, and only when the tool in hand wants one.
  const shelfX = room.x + padX + ROOM_TOOLS.length * (TOOL + 8) + 18;
  const items = BLOCK_ITEMS.map((item, index) => ({
    item,
    rect: { x: shelfX + index * (SHELF + 6), y: stripY + 7, w: SHELF, h: SHELF },
  }));
  const recipes = RECIPES.map((recipe, index) => ({
    recipeId: recipe.id,
    rect: { x: shelfX + index * (SHELF * 3 + 6), y: stripY + 7, w: SHELF * 3, h: SHELF },
  }));

  return {
    originX,
    originY,
    cellW,
    cellH,
    room,
    backEdge,
    tools,
    items,
    recipes,
    pattern: { x: room.x + room.w - 150, y: room.y + room.h - TOOL + 2, w: 132, h: 32 },
    close: { x: room.x + room.w - 42, y: room.y + 16, w: 26, h: 26 },
  };
}

export function hitRoom(
  layout: RoomLayout,
  building: Building,
  selection: RoomSelection,
  x: number,
  y: number,
): RoomHit {
  if (inside(layout.close, x, y)) return { target: 'close' };
  // A well or the fire opens as a room to look at and nothing more, so nothing in the strip is
  // there to be hit — see `canFit`.
  if (!canFit(building).ok) {
    return inside(layout.room, x, y) ? null : { target: 'close' };
  }
  if (inside(layout.pattern, x, y)) return { target: 'pattern' };
  for (const entry of layout.tools) {
    if (inside(entry.rect, x, y)) return { target: 'tool', tool: entry.tool };
  }
  if (wantsItem(selection.tool)) {
    for (const entry of layout.items) {
      if (inside(entry.rect, x, y)) return { target: 'item', item: entry.item };
    }
  }
  if (selection.tool === BlockKind.Combine) {
    for (const entry of layout.recipes) {
      if (inside(entry.rect, x, y)) return { target: 'recipe', recipeId: entry.recipeId };
    }
  }

  const gx = Math.floor((x - layout.originX) / layout.cellW);
  const gy = Math.floor((y - layout.originY) / layout.cellH);
  if (gx >= 0 && gy >= 0 && gx < building.design.width && gy < building.design.height) {
    return { target: 'floor', x: gx, y: gy };
  }
  return null;
}

/**
 * Only a drop-off needs an item chosen for it. A pick-up bay takes whatever the line brings it,
 * so there is nothing to pick — and a shelf of items beside a tool that ignores them is a
 * question the player answers and then watches do nothing.
 */
export const wantsItem = (tool: RoomTool): boolean => tool === BlockKind.Input;

/** Which drawing stands on a square, and which of its clips. */
function tileFor(
  block: Block,
  state: BlockState,
  time: number,
  design?: Design,
): { name: string; clip: string; step: number } {
  switch (block.kind) {
    case BlockKind.Input:
      return { name: 'room-drop', clip: (state.held?.amount ?? 0) > 0 ? 'full' : 'empty', step: 0 };
    case BlockKind.Output:
      return { name: 'room-pick', clip: (state.held?.amount ?? 0) > 0 ? 'full' : 'empty', step: 0 };
    case BlockKind.Storage: {
      // A bin is untyped until something lands in it, and the drawing says so: an empty one is
      // bare boards, and once it is claimed it is barrels, or sacks, or a stack of logs.
      const held = state.held;
      const fill = held && held.amount > 0 ? held.item.toLowerCase() : 'empty';
      return { name: 'room-bin', clip: fill, step: 0 };
    }
    case BlockKind.Combine:
      return {
        name: vesselFor(block.recipeId).tile,
        clip: state.progress > 0 ? 'work' : 'idle',
        step: Math.floor(time * 4),
      };
    case BlockKind.Transport:
      return { name: 'room-chute', clip: runClip(block, design), step: 0 };
    case BlockKind.Hearth:
      // The town's own fire, in the one room that is read-only and has it.
      return { name: 'hearth', clip: 'burn', step: Math.floor(time * 6) };
    default:
      // A source is the ground opened — only ever seen in a land work, which is read-only.
      return { name: 'room-pick', clip: 'full', step: 0 };
  }
}

/**
 * What a square is, in words.
 *
 * Every square gets its name written under it. The drawings carry most of it — sacks on a pale
 * bay, crates on a red one, barrels against the wall — but "I have no idea what the boxes do"
 * is the only review that matters, and a room full of handsome objects nobody can name is a
 * room nobody can plan in. The item is part of the name, because *which* bay this is matters
 * more than that it is a bay at all.
 */
export function nameOf(block: Block, state: BlockState): string {
  switch (block.kind) {
    case BlockKind.Input:
      return `drop ${block.item.toLowerCase()}`;
    case BlockKind.Output: {
      // A crate is untyped until something lands in it, so it is named for what is in it rather
      // than for what somebody once meant it for.
      const held = state.held;
      return held && held.amount > 0 ? `collect ${held.item.toLowerCase()}` : 'collect · anything';
    }
    case BlockKind.Source:
      return `${block.item.toLowerCase()} from the ground`;
    case BlockKind.Storage: {
      const held = state.held;
      return held && held.amount > 0 ? `store · ${held.item.toLowerCase()}` : 'store · empty';
    }
    case BlockKind.Combine: {
      const recipe = recipeOf(block);
      return recipe ? describeRecipe(recipe) : 'mill';
    }
    case BlockKind.Transport:
      return '';
    default:
      return 'the fire';
  }
}

const facingLetter = (facing: Direction): string =>
  facing === Direction.North ? 'n' : facing === Direction.East ? 'e' : facing === Direction.South ? 's' : 'w';

/**
 * What a recipe is worked in.
 *
 * A combine block is drawn for *what it does*, not for what kind of block it is: mud is mixed in
 * a tub, and drawing it under a millstone pictured the one action the recipe is not. A recipe
 * nobody has given a vessel to grinds, which is the commonest thing to do to a dry good.
 */
const VESSELS: Record<string, { tile: string; name: string }> = {
  mud: { tile: 'room-tub', name: 'mixing tub' },
};

const vesselFor = (recipeId: RecipeId): { tile: string; name: string } =>
  VESSELS[recipeId] ?? { tile: 'room-mill', name: 'millstone' };

const OPPOSITE: Record<string, string> = { n: 's', s: 'n', e: 'w', w: 'e' };

/**
 * Which piece of chute a square needs: a straight, or the bend that turns the run.
 *
 * A block only says which way it hands its load *on*; where the load arrives from is whichever
 * neighbour faces into this square, which the design already knows. Declaration order breaks a
 * tie, as it does everywhere else — two lines feeding one square is a join, and the drawing has
 * to choose one of them to come in by.
 */
function runClip(block: Block, design?: Design): string {
  const to = facingLetter(block.facing);
  if (!design) return `${OPPOSITE[to] ?? 'w'}${to}`;

  for (const other of design.blocks) {
    if (other === block) continue;
    const step = STEP[other.facing as Direction];
    if (other.x + step.x !== block.x || other.y + step.y !== block.y) continue;
    // Where it came from is the way back to whoever handed it over.
    const from = facingLetter(other.facing);
    const entered = OPPOSITE[from] ?? 'w';
    if (entered !== to) return `${entered}${to}`;
  }
  return `${OPPOSITE[to] ?? 'w'}${to}`;
}

/** The middle of a square of floor, and the line its things stand on. */
function cellAt(layout: RoomLayout, x: number, y: number): { left: number; top: number; foot: number } {
  return {
    left: layout.originX + x * layout.cellW,
    top: layout.originY + y * layout.cellH,
    foot: layout.originY + (y + 1) * layout.cellH,
  };
}

/**
 * The yard a works is, from inside it.
 *
 * Not a room. The works on the map is a floor of beaten earth ringed with the stones turned up
 * clearing it, and this is that same yard close to — so there are no boarded walls here and no
 * roof, because the town has not built one. It was drawn as a planked shed standing on the HUD's
 * chalkboard, which was two materials the settlement does not have, one inside the other.
 *
 * The floor is the map's own lot colour (`YARD`), mottled off the square's own place on the
 * floor so the grain is the same at every window size, and the ring is the same stones in the
 * room's grid. The front is left open: it is the way in, as it is on the tile.
 */
function drawYard(
  ctx: CanvasRenderingContext2D,
  layout: RoomLayout,
  design: { width: number; height: number },
): void {
  const floorW = layout.cellW * design.width;
  const floorH = layout.cellH * design.height;
  const { originX, originY } = layout;

  ctx.fillStyle = YARD[2] ?? DIRT;
  ctx.fillRect(originX, originY, floorW, floorH);

  // Mottle, and a trodden middle that is darker than the edges: a floor people cross.
  const grain = Math.max(4, Math.round(layout.cellW / 12));
  for (let y = 0; y < floorH; y += grain) {
    for (let x = 0; x < floorW; x += grain) {
      const across = Math.abs(x + grain / 2 - floorW / 2) / (floorW / 2);
      const down = Math.abs(y + grain / 2 - floorH / 2) / (floorH / 2);
      const middle = Math.max(across, down);
      const noise = (hashString(`yard:${x / grain}:${y / grain}`) % 100) / 100;
      const step = Math.min(4, Math.max(0, Math.round(1.6 + middle * 1.6 + (noise - 0.5) * 1.6)));
      ctx.fillStyle = YARD[step] ?? DIRT;
      ctx.fillRect(originX + x, originY + y, grain, grain);
    }
  }

  // The ring. Half a square to a stone, paced along the back and down each side; the sizes
  // alternate off the stone's own place, so the ring is the same ring on every visit.
  const stone = Math.round(layout.cellW / 2);
  const place = (x: number, foot: number, key: string): void => {
    const big = hashString(`ring:${key}`) % 3 !== 0;
    drawSpriteBox(ctx, 'room-stone', big ? 'big' : 'small', 0, x, foot - stone, stone);
  };

  for (let x = -stone / 2; x < floorW; x += stone) {
    place(originX + x, originY + stone * 0.18, `n${Math.round(x)}`);
  }
  for (let y = 0; y < floorH; y += stone * 0.8) {
    place(originX - stone * 0.72, originY + y + stone * 0.4, `w${Math.round(y)}`);
    place(originX + floorW - stone * 0.28, originY + y + stone * 0.4, `e${Math.round(y)}`);
  }
}

/**
 * The squares, chalked on the boards.
 *
 * Drawn with the same pencil the map is drawn with, and only while there is something to lay —
 * the grid is a tool the player picks up, not the furniture. Left on all the time it is the
 * ruled sheet again, and the room stops being a room.
 */
function drawChalk(
  ctx: CanvasRenderingContext2D,
  layout: RoomLayout,
  design: { width: number; height: number },
  hovered: { x: number; y: number } | null,
  strength: number,
): void {
  if (strength <= 0.01) return;
  const floorW = layout.cellW * design.width;
  const floorH = layout.cellH * design.height;

  pencil(ctx, PAPER_WARM, 1, 0.3 * strength);
  for (let x = 0; x <= design.width; x += 1) {
    const at = layout.originX + x * layout.cellW;
    drawWobblyLine(ctx, at, layout.originY, at, layout.originY + floorH, { amplitude: 0.5, step: 14 });
  }
  for (let y = 0; y <= design.height; y += 1) {
    const at = layout.originY + y * layout.cellH;
    drawWobblyLine(ctx, layout.originX, at, layout.originX + floorW, at, { amplitude: 0.5, step: 14 });
  }

  if (!hovered) return;
  const cell = cellAt(layout, hovered.x, hovered.y);
  ctx.save();
  ctx.globalAlpha = 0.16 * strength;
  ctx.fillStyle = '#fff6df';
  ctx.fillRect(cell.left, cell.top, layout.cellW, layout.cellH);
  ctx.restore();
}

/**
 * A dark tag to write on.
 *
 * The floor is sunlit beaten earth now, so pale text on it is barely there and dark text is
 * lost in the mottle — what a bay is holding was written in both and could be read in neither.
 * A tag is the one thing in the room that is not of the world: it is a label, so it is allowed
 * to be, and it gives every chip and count the same ground to sit on.
 */
function tag(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = INK;
  ctx.fillRect(Math.round(x - w / 2), Math.round(y - h / 2), Math.round(w), Math.round(h));
  ctx.restore();
}

/** What a square is holding, over the thing standing on it. */
function drawLoad(
  ctx: CanvasRenderingContext2D,
  layout: RoomLayout,
  block: Block,
  state: BlockState,
  time: number,
  fraction: number,
): void {
  const cell = cellAt(layout, block.x, block.y);
  const middle = cell.left + layout.cellW / 2;
  const held = state.held;
  const size = Math.max(10, layout.cellW * 0.3);

  if (block.kind === BlockKind.Transport) {
    if (!held || held.amount <= 0) return;
    // The cooldown *is* how far across its square the load has got, with the frame's fraction of
    // a tick on top — the same reading the blueprint sheet took, so what is drawn agrees with
    // what the tick says is on the chute.
    const step = STEP[block.facing];
    const travel = Math.min(0.5, 0.5 - (state.cooldown - fraction) / PUSH_TICKS);
    // In the trough and half again as big as a chip elsewhere: a load running down a chute is
    // the one thing in the room that moves, and it has to be seen from across the floor.
    drawIcon(
      ctx,
      itemIcon(held.item),
      middle + step.x * travel * layout.cellW,
      cell.top + layout.cellH * 0.45 + step.y * travel * layout.cellH,
      size * 1.5,
    );
    return;
  }

  if (block.kind === BlockKind.Combine) {
    const recipe = recipeOf(block);
    if (recipe && state.progress > 0) {
      ctx.save();
      ctx.strokeStyle = ITEM_COLORS[recipe.output] ?? RED_PENCIL;
      ctx.lineWidth = 2;
      const turned = Math.min(1, (state.progress - 1 + fraction) / recipe.ticks);
      ctx.beginPath();
      ctx.arc(middle, cell.foot - layout.cellW * 0.52, layout.cellW * 0.42, -Math.PI / 2, -Math.PI / 2 + turned * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // What it is waiting on, in a row over the stone: a hopper with nothing in it is why a
    // machine is standing still, and that is the question the player is in here to answer.
    const hoppers = [...state.hoppers.values()];
    if (hoppers.length > 0) {
      const step = size * 2.4;
      const top = cell.top - size * 0.2;
      tag(ctx, middle, top, step * hoppers.length + 6, size + 10);
      hoppers.forEach((hopper, index) => {
        const hx = middle + (index - (hoppers.length - 1) / 2) * step;
        drawIcon(ctx, itemIcon(hopper.item), hx - size * 0.5, top, size, hopper.amount > 0 ? 1 : 0.35);
        drawPixelText(ctx, `${hopper.amount}`, hx + size * 0.5, top, {
          color: hopper.amount > 0 ? '#fdf9ec' : RED_PENCIL,
          align: 'left',
        });
      });
    }
    return;
  }

  if (!held || held.amount <= 0) return;
  // What is piled on the bay and how much of it: the sacks say something is here, the chip says
  // what, and the number says whether it is backing up. On a tag, because it has to be read at
  // a glance from the other side of the floor.
  const chip = size * 1.5;
  const label = `${held.amount}/${held.capacity}`;
  const width = chip + pixelTextWidth(label) + 14;
  const at = cell.top + layout.cellH * 0.1;
  tag(ctx, middle, at, width, chip + 8);
  drawIcon(ctx, itemIcon(held.item), middle - (width - chip) / 2 + 2, at, chip);
  drawPixelText(ctx, label, middle + chip / 2 - 1, at, {
    color: held.amount >= held.capacity ? RED_PENCIL : '#fdf9ec',
    align: 'left',
  });
}

/** What the square is, written under it — brighter for the one under the cursor. */
function drawName(
  ctx: CanvasRenderingContext2D,
  layout: RoomLayout,
  block: Block,
  state: BlockState,
  hovered: boolean,
): void {
  const name = nameOf(block, state);
  if (name === '') return;
  const cell = cellAt(layout, block.x, block.y);
  const middle = cell.left + layout.cellW / 2;
  const at = cell.foot - 8;
  if (hovered) tag(ctx, middle, at, pixelTextWidth(name) + 12, 16);
  drawPixelText(ctx, name, middle, at, {
    color: hovered ? '#fdf9ec' : INK_SOFT,
    align: 'center',
  });
}

/**
 * Which way a square hands its load on, and whether it has anywhere to hand it.
 *
 * A chute says it with the chevrons on its bed, but a bay and a vessel had nothing — and since
 * everything was laid facing east, a drop-off at the top of the floor handed east into bare
 * ground, the works sat blocked and nothing on the screen said why. The arrow is the smaller
 * half of the fix; the **cross** is the larger one. A square with nowhere to put what it is
 * holding is the single commonest reason a floor does nothing, and it was invisible.
 */
function drawFacing(
  ctx: CanvasRenderingContext2D,
  layout: RoomLayout,
  design: Design,
  block: Block,
  state: BlockState,
): void {
  // An output and the fire are termini: what reaches them waits for a carrier.
  if (block.kind === BlockKind.Output || block.kind === BlockKind.Hearth) return;

  const step = STEP[block.facing];
  const onward = design.blocks.find((other) => other.x === block.x + step.x && other.y === block.y + step.y);
  const stuck = !onward && (state.held?.amount ?? 0) > 0;
  // A bin facing open air is doing its job; anything else is backed up.
  if (!onward && block.kind === BlockKind.Storage) return;

  const cell = cellAt(layout, block.x, block.y);
  const from = { x: cell.left + layout.cellW / 2, y: cell.top + layout.cellH / 2 };
  const reach = Math.min(layout.cellW, layout.cellH) * 0.42;
  const tip = { x: from.x + step.x * reach, y: from.y + step.y * reach * TILT };

  if (!onward) {
    pencil(ctx, RED_PENCIL, stuck ? 3 : 2, stuck ? 0.95 : 0.5);
    const bar = reach * 0.4;
    drawWobblyLine(ctx, tip.x - bar, tip.y - bar * TILT, tip.x + bar, tip.y + bar * TILT, { amplitude: 0.4, step: 6 });
    drawWobblyLine(ctx, tip.x + bar, tip.y - bar * TILT, tip.x - bar, tip.y + bar * TILT, { amplitude: 0.4, step: 6 });
    return;
  }

  // Only the squares a chute does not already speak for: a run is chevroned along its bed.
  if (block.kind === BlockKind.Transport) return;
  pencil(ctx, PAPER_WARM, 2, 0.75);
  drawWobblyLine(ctx, from.x, from.y, tip.x, tip.y, { amplitude: 0.3, step: 8 });
  const back = 0.45;
  for (const side of [-1, 1]) {
    drawWobblyLine(
      ctx,
      tip.x,
      tip.y,
      tip.x - step.x * reach * back - side * step.y * reach * back,
      tip.y - step.y * reach * back * TILT - side * step.x * reach * back * TILT,
      { amplitude: 0.3, step: 5 },
    );
  }
}

/** The strip of things to lay, each drawn as the object it puts on the floor. */
function drawStrip(
  ctx: CanvasRenderingContext2D,
  layout: RoomLayout,
  selection: RoomSelection,
  hoveredTool: RoomTool | null,
): void {
  for (const { tool, rect } of layout.tools) {
    const held = selection.tool === tool;
    drawPlate(ctx, held ? 'tile-on' : hoveredTool === tool ? 'tile-hover' : 'tile', rect);

    if (tool === 'erase') {
      pencil(ctx, RED_PENCIL, 2, 0.9);
      drawWobblyLine(ctx, rect.x + 16, rect.y + 12, rect.x + rect.w - 16, rect.y + rect.h - 20, { amplitude: 0.6, step: 8 });
      drawWobblyLine(ctx, rect.x + rect.w - 16, rect.y + 12, rect.x + 16, rect.y + rect.h - 20, { amplitude: 0.6, step: 8 });
      drawPixelText(ctx, TOOL_NAMES['erase'] ?? '', rect.x + rect.w / 2, rect.y + rect.h - 9, {
        color: held ? '#fdf9ec' : BONE_SOFT,
        align: 'center',
      });
      continue;
    }

    const sample: Block =
      tool === BlockKind.Input
        ? { kind: BlockKind.Input, x: 0, y: 0, facing: Direction.South, item: selection.item }
        : tool === BlockKind.Output
          ? { kind: BlockKind.Output, x: 0, y: 0, facing: Direction.South }
          : tool === BlockKind.Combine
            ? { kind: BlockKind.Combine, x: 0, y: 0, facing: Direction.East, recipeId: selection.recipeId }
            : tool === BlockKind.Storage
              ? { kind: BlockKind.Storage, x: 0, y: 0, facing: Direction.South }
              : { kind: BlockKind.Transport, x: 0, y: 0, facing: Direction.East };
    // Shown with something on it: an empty bay is a few chalk marks, and a button with a few
    // chalk marks on it says nothing about what pressing it would do.
    const stocked: BlockState = {
      held: { item: selection.item, amount: 1, capacity: 8 },
      hoppers: new Map(),
      progress: 0,
      cooldown: 0,
    };
    const tile = tileFor(sample, stocked, 0);
    drawSpriteBox(ctx, tile.name, tile.clip, tile.step, rect.x + 5, rect.y - 4, rect.w - 10);
    // The mixer is named for the vessel the chosen recipe is worked in, so the button says
    // "mixing tub" when a tub is what pressing it puts down.
    const label = tool === BlockKind.Combine ? vesselFor(selection.recipeId).name : TOOL_NAMES[tool];
    drawPixelText(ctx, label ?? '', rect.x + rect.w / 2, rect.y + rect.h - 9, {
      color: held ? '#fdf9ec' : BONE_SOFT,
      align: 'center',
    });
  }

  if (wantsItem(selection.tool)) {
    for (const { item, rect } of layout.items) {
      drawPlate(ctx, selection.item === item ? 'tile-on' : 'tile', rect);
      drawIcon(ctx, itemIcon(item), rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w * 0.6);
    }
  }

  if (selection.tool === BlockKind.Combine) {
    for (const { recipeId, rect } of layout.recipes) {
      const recipe = RECIPES.find((entry) => entry.id === recipeId);
      drawPlate(ctx, selection.recipeId === recipeId ? 'tile-on' : 'tile', rect);
      drawPixelText(ctx, recipe ? describeRecipe(recipe) : recipeId, rect.x + 10, rect.y + rect.h / 2, {
        color: BONE_INK,
      });
    }
  }
}

/**
 * Draws the inside of a works, and the squares the player is laying in it.
 *
 * This is not a readout of the machine and never was: the squares drawn here are the squares
 * `processBuilding` moves things across, and laying one changes the building standing on the
 * map (`fitting.ts`) — there is no blueprint in between to get out of step with it.
 */
export function drawRoom(
  ctx: CanvasRenderingContext2D,
  building: Building,
  viewport: Viewport,
  layout: RoomLayout,
  selection: RoomSelection,
  hovered: RoomHit,
  time: number,
  fraction: number,
): void {
  const design = building.design;
  const { room } = layout;

  // The map dimmed right down rather than a panel laid over it: the yard is a place on the map
  // and the player is standing in it, so what is round it is the land, not a board.
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  ctx.globalAlpha = 1;

  drawYard(ctx, layout, design);

  const onFloor = hovered?.target === 'floor' ? { x: hovered.x, y: hovered.y } : null;
  drawChalk(ctx, layout, design, onFloor, 1);

  // Nearer things over further ones, by the row they stand in — the same rule `drawTowns` sorts
  // the map by, which is what lets a mill overlap the sacks behind it.
  const squares = blocksOf(building).sort(
    (a, b) => a.block.y - b.block.y || a.block.x - b.block.x,
  );

  // A row at a time, and the tiles of a row before its loads. Drawn square by square, the tile
  // of the row in front covers the load that was drawn on the row behind — which is most of a
  // chute run, and why nothing appeared to be moving along one.
  let at = 0;
  while (at < squares.length) {
    const row = squares[at]!.block.y;
    const end = squares.findIndex((square, index) => index >= at && square.block.y !== row);
    const stop = end < 0 ? squares.length : end;

    for (let i = at; i < stop; i += 1) {
      const { block, state } = squares[i]!;
      const cell = cellAt(layout, block.x, block.y);
      const tile = tileFor(block, state, time, design);
      drawSpriteBox(ctx, tile.name, tile.clip, tile.step, cell.left, cell.foot - layout.cellW * FOOT_IN_TILE, layout.cellW);
    }
    for (let i = at; i < stop; i += 1) {
      const { block, state } = squares[i]!;
      drawFacing(ctx, layout, design, block, state);
      drawLoad(ctx, layout, block, state, time, fraction);
      drawName(ctx, layout, block, state, onFloor?.x === block.x && onFloor.y === block.y);
    }
    at = stop;
  }

  // The ghost of what the hand would put down.
  if (onFloor && selection.tool !== 'erase' && canFit(building).ok) {
    const cell = cellAt(layout, onFloor.x, onFloor.y);
    const sample: Block =
      selection.tool === BlockKind.Combine
        ? { kind: BlockKind.Combine, x: 0, y: 0, facing: Direction.East, recipeId: selection.recipeId }
        : selection.tool === BlockKind.Storage
          ? { kind: BlockKind.Storage, x: 0, y: 0, facing: Direction.South }
          : selection.tool === BlockKind.Transport
            ? { kind: BlockKind.Transport, x: 0, y: 0, facing: Direction.East }
            : selection.tool === BlockKind.Output
              ? { kind: BlockKind.Output, x: 0, y: 0, facing: Direction.South }
              : { kind: BlockKind.Input, x: 0, y: 0, facing: Direction.South, item: selection.item };
    const empty: BlockState = { held: null, hoppers: new Map(), progress: 0, cooldown: 0 };
    const tile = tileFor(sample, empty, time);
    drawSpriteBox(
      ctx,
      tile.name,
      tile.clip,
      tile.step,
      cell.left,
      cell.foot - layout.cellW * FOOT_IN_TILE,
      layout.cellW,
      0.45,
    );
  }

  /* ---- what the room says about itself ---- */

  drawPixelText(ctx, design.label, room.x + room.w / 2, room.y + 30, {
    scale: HEAD_SCALE,
    color: '#f0e4cd',
    align: 'center',
  });

  const check = validateDesign(design);
  const fit = canFit(building);
  const ground = building.yields.length > 0 ? building.yields.join(' and ') : 'bare ground';
  const standing = building.retooling > 0
    ? `setting the vessel — ${building.retooling} ticks, and the bays go on being served`
    : !fit.ok
    ? `${building.state.toLowerCase()} · on ${ground} · ${fit.reason}`
    : fittingFree(building)
    ? building.design.blocks.length === 0
      ? 'the site is being prepared — fit it out now, for nothing'
      : canFit(building).reason
      : check.ok
        ? `${building.state.toLowerCase()} · on ${ground}`
        : `nothing is made here yet — ${check.reason}`;
  drawPixelText(ctx, standing, room.x + room.w / 2, room.y + 56, {
    color: !fit.ok || check.ok || fittingFree(building) ? BONE_SOFT : RED_PENCIL,
    align: 'center',
  });

  if (fit.ok) drawStrip(ctx, layout, selection, hovered?.target === 'tool' ? hovered.tool : null);

  // Keeping a copy of something that works: the library is filled by success, not by guesswork.
  if (fit.ok && design.blocks.length > 0) {
    drawPlate(ctx, hovered?.target === 'pattern' ? 'tile-hover' : 'tile', layout.pattern);
    drawPixelText(ctx, 'keep as pattern', layout.pattern.x + layout.pattern.w / 2, layout.pattern.y + 16, {
      color: BONE_INK,
      align: 'center',
    });
  }

  drawPlate(ctx, hovered?.target === 'close' ? 'tile-hover' : 'tile', layout.close);
  drawPixelText(ctx, 'x', layout.close.x + layout.close.w / 2, layout.close.y + 13, {
    color: BONE_INK,
    align: 'center',
  });

  const hint = fit.ok
    ? 'click to lay · click again to turn · right-click to clear'
    : 'click outside or press escape to close';
  drawPixelText(ctx, hint, room.x + room.w / 2, room.y + room.h - 14, {
    color: INK_FAINT,
    align: 'center',
  });

  ctx.restore();
}
