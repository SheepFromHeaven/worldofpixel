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
];

export const SOURCES: Record<string, { cells: number; clips: readonly SpriteClip[] }> = {
  // A land work stands empty as `default`, and plays a work clip while a villager is in it — one
  // per villager, since the building has to show the same person who walked in.
  well: { cells: 32, clips: landWork(2) },
  dig: { cells: 32, clips: landWork(3) },
  woodcutter: { cells: 32, clips: landWork(4) },
  hearth: { cells: 16, clips: [{ name: 'burn', frames: 3 }] },
  'border-stone': { cells: 16, clips: [{ name: 'default', frames: 1 }] },
  'villager-woman': { cells: 16, clips: VILLAGER },
  'villager-man': { cells: 16, clips: VILLAGER },
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
