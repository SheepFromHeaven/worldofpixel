import { TEXEL, levelFor } from './terrainPixels.ts';

/**
 * Pixel art on a hand-drawn map, loaded once and drawn with smoothing off.
 *
 * The tile that ships is the authored grid magnified to a fixed 1024; drawn straight from that
 * it would be resampled by whatever the camera's zoom happens to be, and the cells would bleed
 * into each other. So it is stepped back down to its own grid once at load — a filtered
 * reduction of a whole-number magnification returns the original cells — and every draw after
 * that magnifies that grid instead. Which is what keeps the edges square at any zoom.
 *
 * Every clip's frames lie end to end in one strip, in the order the clips are declared: one
 * file and one decode per sprite, and no chance of the frames drifting out of step on disk.
 */

export interface SpriteClip {
  name: string;
  frames: number;
  fps?: number;
}

/**
 * What is in each strip. Declared here rather than imported from `pixel/sprites`, which is
 * authoring code the game bundle has no business carrying — `npm run sprites` reads this table
 * and refuses to bake if it disagrees with the sprite it is baking, so the two cannot drift.
 */
const landWork = (fps: number): SpriteClip[] => [
  { name: 'default', frames: 1 },
  { name: 'work', frames: 4, fps },
  { name: 'work-man', frames: 4, fps },
];

/** The eight ways a villager walks; `s` is towards the viewer. Same order as `villager.ts`. */
export const HEADINGS = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'] as const;
export type Heading = (typeof HEADINGS)[number];

const VILLAGER: readonly SpriteClip[] = [
  { name: 'idle', frames: 2, fps: 2 },
  ...HEADINGS.flatMap((heading) => [
    { name: `walk-${heading}`, frames: 4 },
    { name: `carry-${heading}`, frames: 4 },
  ]),
  { name: 'chop-w', frames: 4, fps: 4 },
  { name: 'chop-e', frames: 4, fps: 4 },
  { name: 'dig-w', frames: 4, fps: 3 },
  { name: 'dig-e', frames: 4, fps: 3 },
];

/**
 * Where a piece of a drawing meets the ground, in rows of the authored grid.
 *
 * **The depth sort is feet against feet**, and a building is not one object: a hearth is a pit, a
 * ring of stones round it and a fire standing out of the middle; a works is a floor with nine
 * separate stones on it. Each meets the ground somewhere different — the works' ring spans
 * eighteen rows, half a parcel of depth — so each is baked as a clip of its own and sorted on its
 * own foot, beside the trees and the villagers. One picture can only carry one foot, and whichever
 * it is given is wrong for every part of it but one: a villager coming up the left side of a yard
 * popped behind the whole ring at once.
 *
 * `foot` is the row the piece *stands* on, not the row it is drawn on — a flame rises out of the
 * bed it burns in. These repeat what the sprite itself declares (`Piece` in `pixel/sprite.ts`,
 * where the geometry is); the game cannot import authoring code, so `npm run sprites` refuses to
 * bake when the two disagree and prints the line to paste.
 */
export interface SpritePiece {
  clip: string;
  foot: number;
}

export const SOURCES: Record<
  string,
  { cells: number; clips: readonly SpriteClip[]; pieces?: readonly SpritePiece[] }
> = {
  // A land work stands empty as the several things it is, and plays a work clip while a villager
  // is in it — one per villager, since the building has to show the same person who walked in, and
  // one drawing of the whole tile, since the axe leaves the stump for their hands.
  //
  // The well is masonry, the bucket standing a third of a parcel in front of it, and the grass
  // between them; the woodcutter is a woodpile, a stump and a felled trunk twenty rows apart. The
  // small stuff lying about each of them — tufts, chips, clods, saplings — is one layer, the
  // `floor`, since a thing two cells across is not worth a piece of its own. The dig is the hole
  // itself and the heap of spoil standing beside it.
  well: {
    cells: 32,
    clips: [...landWork(2), { name: 'floor', frames: 1 }, { name: 'bucket', frames: 1 }],
    pieces: [
      { clip: 'floor', foot: 0 },
      { clip: 'default', foot: 17.99 },
      { clip: 'bucket', foot: 30 },
    ],
  },
  dig: {
    cells: 32,
    clips: [...landWork(3), { name: 'floor', frames: 1 }, { name: 'heap', frames: 1 }],
    pieces: [{ clip: 'floor', foot: 0 }, { clip: 'heap', foot: 16 }],
  },
  woodcutter: {
    cells: 32,
    clips: [
      ...landWork(4),
      { name: 'floor', frames: 1 },
      { name: 'pile', frames: 1 },
      { name: 'stump', frames: 1 },
      { name: 'trunk', frames: 1 },
    ],
    pieces: [
      { clip: 'floor', foot: 0 },
      { clip: 'pile', foot: 14 },
      { clip: 'stump', foot: 20 },
      { clip: 'trunk', foot: 27 },
    ],
  },
  // The pit, the fire out of it, and the ring of stones round it, back to front.
  hearth: {
    cells: 16,
    clips: [{ name: 'bed', frames: 3 }, { name: 'ring', frames: 1 }, { name: 'burn', frames: 3 }],
    pieces: [{ clip: 'bed', foot: 0 }, { clip: 'ring', foot: 10.5 }, { clip: 'burn', foot: 12.85 }],
  },
  'border-stone': {
    cells: 16,
    clips: [{ name: 'default', frames: 1 }],
    pieces: [{ clip: 'default', foot: 14.02 }],
  },
  // Symbols, not tiles: drawn at a fixed size in buffer pixels by `drawMark`, never through
  // `drawTile`, because a mark covers no world and must not shrink with the rung. One per stage
  // of a town — the first stage is the `hearth` above, which is all a new settlement has.
  'town-huts': { cells: 32, clips: [{ name: 'default', frames: 1 }] },
  'town-village': { cells: 32, clips: [{ name: 'default', frames: 1 }] },
  'town-stone': { cells: 32, clips: [{ name: 'default', frames: 1 }] },
  'villager-woman': { cells: 16, clips: VILLAGER },
  'villager-man': { cells: 16, clips: VILLAGER },

  // What stands on the floor of a works (`pixel/sprites/room.ts`). One tile to a square of the
  // floor, drawn in the room rather than on the map — so these are the only sprites that never
  // go through `drawTile`, which anchors to the ground's own texel lattice.
  // The works on the map, one drawing whatever is inside: what it makes is the room's question.
  // The floor, and then every stone of the ring on its own foot — the near ones are half a parcel
  // nearer the viewer than the far ones (`pixel/sprites/works.ts` places them).
  works: {
    cells: 32,
    clips: [
      { name: 'floor', frames: 1 },
      { name: 'stone-0', frames: 1 },
      { name: 'stone-1', frames: 1 },
      { name: 'stone-2', frames: 1 },
      { name: 'stone-3', frames: 1 },
      { name: 'stone-4', frames: 1 },
      { name: 'stone-5', frames: 1 },
      { name: 'stone-6', frames: 1 },
      { name: 'stone-7', frames: 1 },
      { name: 'stone-8', frames: 1 },
    ],
    pieces: [
      { clip: 'floor', foot: 8 },
      { clip: 'stone-0', foot: 10 },
      { clip: 'stone-1', foot: 11 },
      { clip: 'stone-2', foot: 15 },
      { clip: 'stone-3', foot: 20 },
      { clip: 'stone-4', foot: 25 },
      { clip: 'stone-5', foot: 25 },
      { clip: 'stone-6', foot: 20 },
      { clip: 'stone-7', foot: 15 },
      { clip: 'stone-8', foot: 12 },
    ],
  },

  // The pit firing: a hollow scraped in the ground with pots stacked in it, the near half of it
  // heaped over with turf and smouldering, and the turf that was lifted piled clear of the hole.
  // The hole lies in the ground and takes the back of the sort with the clods and sherds on the
  // grass; the cover stands in front of the pots; the smoke rises out of the cover.
  'pit-firing': {
    cells: 32,
    clips: [
      { name: 'floor', frames: 1 },
      { name: 'heap', frames: 1 },
      { name: 'pots', frames: 1 },
      { name: 'cover', frames: 1 },
      { name: 'smoke', frames: 3, fps: 2 },
    ],
    pieces: [
      { clip: 'floor', foot: 0 },
      { clip: 'heap', foot: 16 },
      { clip: 'pots', foot: 26 },
      { clip: 'cover', foot: 27 },
      { clip: 'smoke', foot: 28 },
    ],
  },
  // The charcoal clamp, which stands up where the pit beside it goes down: the apron it is built
  // on takes its *far* edge like anything lying on the ground, then the earthed cone, the smoke
  // out of its crown, and the split billets waiting at the near edge of the apron.
  'charcoal-clamp': {
    cells: 32,
    clips: [
      { name: 'floor', frames: 1 },
      { name: 'mound', frames: 1 },
      { name: 'billets', frames: 1 },
      { name: 'smoke', frames: 3, fps: 2 },
    ],
    pieces: [
      { clip: 'floor', foot: 15 },
      { clip: 'mound', foot: 27 },
      { clip: 'smoke', foot: 28 },
      { clip: 'billets', foot: 30 },
    ],
  },

  // What stands on the floor of a works (`pixel/sprites/room.ts`). One tile to a square of the
  // floor, drawn in the room rather than on the map — so these are the only sprites that never
  // go through `drawTile`, which anchors to the ground's own texel lattice.
  'room-drop': {
    cells: 32,
    clips: [
      { name: 'empty', frames: 1 },
      { name: 'full', frames: 1 },
    ],
  },
  'room-pick': {
    cells: 32,
    clips: [
      { name: 'empty', frames: 1 },
      { name: 'full', frames: 1 },
    ],
  },
  'room-bin': {
    cells: 32,
    clips: [
      { name: 'empty', frames: 1 },
      { name: 'water', frames: 1 },
      { name: 'dirt', frames: 1 },
      { name: 'mud', frames: 1 },
      { name: 'wood', frames: 1 },
    ],
  },
  // Four straights and eight bends: the way in crossed with the way out, named `<from><to>`.
  // A run that turns needs the bend drawn as one piece — two straights butted end to side leave
  // the outside of every corner open.
  'room-chute': {
    cells: 32,
    clips: ['n', 'e', 's', 'w'].flatMap((from) =>
      ['n', 'e', 's', 'w'].filter((to) => to !== from).map((to) => ({ name: `${from}${to}`, frames: 1 })),
    ),
  },
  // The ring that bounds a works, in the room: half a square across, so half the cells.
  'room-stone': {
    cells: 16,
    clips: [
      { name: 'big', frames: 1 },
      { name: 'small', frames: 1 },
    ],
  },
  // A combine is drawn for what it does: mud is mixed in a tub, not ground under a stone.
  'room-tub': {
    cells: 32,
    clips: [
      { name: 'idle', frames: 1 },
      { name: 'work', frames: 4, fps: 4 },
    ],
  },
  'room-mill': {
    cells: 32,
    clips: [
      { name: 'idle', frames: 1 },
      { name: 'work', frames: 4, fps: 4 },
    ],
  },
};

/**
 * How fast a clip runs when it is played off the clock and says nothing itself. Slow, and
 * deliberately: a pixel is one colour or another, so a few frames at a stride the eye can follow
 * read as movement, where the same frames at screen rate read as noise.
 */
export const FRAMES_PER_SECOND = 6;

/** The frame a clip is on at a given wall-clock time. The renderer's clock, never the tick. */
export function frameAt(time: number, frames: number, fps = FRAMES_PER_SECOND): number {
  return Math.floor(time * fps) % frames;
}

/**
 * The smallest a tile may be cut down to. Below eight cells a well is four brown pixels and a
 * blue one, which is not a smaller drawing of a well but a smudge; out there the map says what
 * is happening in words and a mark per town instead.
 */
const MIN_TILE_CELLS = 8;

/** One frame, at the sizes the ground's rungs ask for: authored first, then halved. */
const loaded = new Map<string, HTMLCanvasElement[][]>();
const started = new Set<string>();

const totalFrames = (clips: readonly SpriteClip[]): number =>
  clips.reduce((sum, clip) => sum + clip.frames, 0);

/** Where a clip's frames start in the strip, and how many it has. */
function clipRange(name: string, clip: string): { at: number; frames: number } {
  let at = 0;
  for (const entry of SOURCES[name]?.clips ?? []) {
    if (entry.name === clip) return { at, frames: entry.frames };
    at += entry.frames;
  }
  return { at: 0, frames: 1 };
}

/**
 * Halvings of a frame, sharpest first.
 *
 * Not a trick for drawing it small: it is the same rule as everywhere else. A sprite cell is a
 * pixel of the ground, so when the ground steps out to a rung whose texels are twice the size,
 * the sprite has to be drawn from a grid with half as many cells in it — same size on the map,
 * half the pixels, like anything else seen from further away. Each step is an exact two-to-one
 * reduction, which averages whole cells into one and leaves a smaller grid of hard pixels; it
 * is not a smooth rescale, and nothing is ever drawn at a size between two of these.
 */
function halvings(frame: HTMLCanvasElement): HTMLCanvasElement[] {
  const steps = [frame];
  for (let size = frame.width / 2; size >= MIN_TILE_CELLS; size /= 2) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(steps[steps.length - 1]!, 0, 0, size, size);
    steps.push(canvas);
  }
  return steps;
}

/** The frames of a sprite, in strip order, or nothing until the tile has decoded. */
export function sprite(name: string): HTMLCanvasElement[][] | undefined {
  const source = SOURCES[name];
  if (!source) return undefined;

  if (!started.has(name)) {
    started.add(name);
    const image = new Image();
    image.src = `/tiles/${name}.png`;
    image.decode().then(
      () => {
        const frames = totalFrames(source.clips);
        const tile = image.naturalWidth / frames;
        const cut: HTMLCanvasElement[][] = [];

        for (let frame = 0; frame < frames; frame += 1) {
          const canvas = document.createElement('canvas');
          canvas.width = source.cells;
          canvas.height = source.cells;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(image, frame * tile, 0, tile, tile, 0, 0, source.cells, source.cells);
          cut.push(halvings(canvas));
        }

        loaded.set(name, cut);
      },
      () => undefined,
    );
  }

  return loaded.get(name);
}

function frameOf(name: string, clip: string, step: number): HTMLCanvasElement[] | undefined {
  const frames = sprite(name);
  if (!frames) return undefined;
  const range = clipRange(name, clip);
  return frames[range.at + (((step % range.frames) + range.frames) % range.frames)];
}

/**
 * A piece of a tile, as the painter sorts it: the clip it is drawn from, and how far down the map
 * it stands from the tile's middle, in world units. A sprite that declares no pieces is one piece
 * at the middle, which is what a thing standing up — a villager, a border stone — is.
 */
export interface TilePiece {
  clip?: string;
  depth: number;
}

const split = new Map<string, readonly TilePiece[]>();

/** Back to front, the pieces a tile is sorted and drawn in. Asked for every building every frame. */
export function tilePieces(name: string): readonly TilePiece[] {
  const known = split.get(name);
  if (known) return known;

  const source = SOURCES[name];
  if (!source) return [{ depth: 0 }];

  const middle = source.cells / 2;
  const pieces: TilePiece[] = (source.pieces ?? [{ clip: '', foot: middle }]).map((piece) => ({
    depth: (piece.foot - middle) * TEXEL,
    ...(piece.clip ? { clip: piece.clip } : {}),
  }));
  pieces.sort((a, b) => a.depth - b.depth);

  split.set(name, pieces);
  return pieces;
}

/** Which halving a rung asks for, or nothing if the ground is coarser than the tile can go. */
function stepsFor(texel: number, levels: number): number | undefined {
  const steps = Math.round(Math.log2(texel / TEXEL));
  return steps >= 0 && steps < levels ? steps : undefined;
}

/** Whether a tile can be drawn at all at a zoom, for callers deciding whether to bother. */
export function tileFits(name: string, zoom: number): boolean {
  const frames = sprite(name);
  const first = frames?.[0];
  return first !== undefined && stepsFor(levelFor(zoom).texel, first.length) !== undefined;
}

/**
 * Draws a sprite centred on a point in the world, one cell to one *buffer pixel*.
 *
 * The other way of drawing a sprite, and the rule that tells them apart is what the drawing is
 * of. `drawTile` is for a thing standing on the ground: it covers a patch of world, so it keeps
 * that patch at every zoom and coarsens with the rung, like the ground under it. A mark covers
 * no world at all — it says a town is *here* — and it has to say it as loudly from the world
 * view as from one rung in, so it is a fixed size on screen and follows no rung.
 *
 * Which is also why it is never halved: it is only ever drawn from the grid it was authored on.
 *
 * Hands back the box it drew, in buffer pixels, so a caller can put a name under it without
 * knowing how big the drawing is.
 */
export function drawMark(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  clip = 'default',
  step = 0,
): { left: number; top: number; size: number } | undefined {
  const canvas = frameOf(name, clip, step)?.[0];
  if (!canvas) return undefined;

  const transform = ctx.getTransform();
  if (transform.b !== 0 || transform.c !== 0) return undefined;

  const size = canvas.width;
  const left = Math.round(transform.a * x + transform.e - size / 2);
  const top = Math.round(transform.d * y + transform.f - size / 2);

  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(canvas, left, top, size, size);
  ctx.restore();
  ctx.imageSmoothingEnabled = smoothing;
  return { left, top, size };
}

/**
 * Draws a tile centred on a point *in the world*, one cell to the terrain's own texel.
 *
 * There is no size to pass, and that is the point: a sprite cell is a pixel of the ground. The
 * tile keeps the same patch of world at every zoom, and what changes with the rung is how many
 * cells it is drawn out of — the sharpest rung draws the authored grid, the rung above it the
 * halving, and so on, exactly as the ground itself coarsens.
 *
 * Two rules make tile and ground one image rather than two grids that happen to be nearby.
 *
 * The tile is **anchored to the world texel lattice** of the rung it is drawn on, so its cell
 * boundaries are the ground's cell boundaries. Centred on a marker's own position instead, a
 * tile lands wherever that position falls inside a texel and every cell in it is drawn half a
 * ground-pixel off.
 *
 * Its edges are then **rounded the way the ground's chunks round theirs**, both corners through
 * the same world-to-buffer function. Since the drawn zoom puts a whole number of buffer pixels
 * in a texel, that comes out as exactly that many pixels per cell, with no cell wider than its
 * neighbour anywhere on the tile.
 */
export function drawTile(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  clip = 'default',
  step = 0,
  flip = false,
): boolean {
  const levels = frameOf(name, clip, step);
  if (!levels) return false;

  const transform = ctx.getTransform();
  // A rotated or skewed transform has no grid to snap to; nothing draws a tile under one.
  if (transform.b !== 0 || transform.c !== 0) return false;

  const level = levelFor(Math.abs(transform.a));
  const steps = stepsFor(level.texel, levels.length);
  if (steps === undefined) return false;

  const canvas = levels[steps]!;
  const span = canvas.width * level.texel;
  const leftWorld = Math.round((x - span / 2) / level.texel) * level.texel;
  const topWorld = Math.round((y - span / 2) / level.texel) * level.texel;

  const left = Math.round(transform.a * leftWorld + transform.e);
  const top = Math.round(transform.d * topWorld + transform.f);
  const width = Math.round(transform.a * (leftWorld + span) + transform.e) - left;
  const height = Math.round(transform.d * (topWorld + span) + transform.f) - top;

  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (flip) {
    ctx.translate(left + width, top);
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, 0, 0, width, height);
  } else {
    ctx.drawImage(canvas, left, top, width, height);
  }
  ctx.restore();
  ctx.imageSmoothingEnabled = smoothing;
  return true;
}

/**
 * A tile drawn into a box on the screen, for the one place that is not the map: the inside of a
 * works (`roomLayer.ts`), which is a cutaway at its own scale rather than a patch of ground.
 *
 * Everything else goes through `drawTile`, which takes a point in the world and no size at all,
 * because out there a sprite cell *is* a pixel of the ground. In here there is no ground to
 * agree with, so the caller says how big a square of floor is and the tile fills it — still at a
 * whole number of pixels to the cell, still with smoothing off, which is what keeps it pixel art
 * rather than a photograph of some.
 */
export function drawSpriteBox(
  ctx: CanvasRenderingContext2D,
  name: string,
  clip: string,
  step: number,
  x: number,
  y: number,
  size: number,
  alpha = 1,
): boolean {
  const levels = frameOf(name, clip, step);
  const canvas = levels?.[0];
  if (!canvas) return false;

  // A whole number of pixels to the cell, so no cell comes out wider than its neighbour. Below
  // one pixel a cell there is nothing to round to and the tile is drawn as it falls.
  const cells = canvas.width;
  const perCell = size / cells;
  const span = perCell >= 1 ? Math.max(1, Math.floor(perCell)) * cells : size;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, Math.round(x + (size - span) / 2), Math.round(y + (size - span)), span, span);
  ctx.restore();
  return true;
}
