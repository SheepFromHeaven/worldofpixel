import { TEXEL, levelFor } from './terrainPixels.ts';

export interface SpriteClip {
  name: string;
  frames: number;
  fps?: number;
}

const landWork = (fps: number): SpriteClip[] => [
  { name: 'default', frames: 1 },
  { name: 'work', frames: 4, fps },
  { name: 'work-man', frames: 4, fps },
];

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

export interface SpritePiece {
  clip: string;
  foot: number;
}

export const SOURCES: Record<
  string,
  { cells: number; clips: readonly SpriteClip[]; pieces?: readonly SpritePiece[] }
> = {
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
  hearth: {
    cells: 16,
    clips: [
      { name: 'bed', frames: 3 },
      { name: 'ring', frames: 1 },
      { name: 'burn-banked', frames: 3 },
      { name: 'burn', frames: 3 },
      { name: 'burn-roaring', frames: 3 },
    ],
    pieces: [{ clip: 'bed', foot: 0 }, { clip: 'ring', foot: 10.5 }, { clip: 'burn', foot: 12.85 }],
  },
  'border-stone': {
    cells: 16,
    clips: [{ name: 'default', frames: 1 }],
    pieces: [{ clip: 'default', foot: 14.02 }],
  },
  'town-huts': { cells: 32, clips: [{ name: 'default', frames: 1 }] },
  'town-village': { cells: 32, clips: [{ name: 'default', frames: 1 }] },
  'town-stone': { cells: 32, clips: [{ name: 'default', frames: 1 }] },
  'villager-woman': { cells: 16, clips: VILLAGER },
  'villager-man': { cells: 16, clips: VILLAGER },

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

  'mini-cord-walk': { cells: 16, clips: [{ name: 'default', frames: 1 }], pieces: [{ clip: 'default', foot: 12 }] },
  'mini-weaving-frame': { cells: 16, clips: [{ name: 'default', frames: 1 }], pieces: [{ clip: 'default', foot: 13 }] },
  'mini-daub-pit': { cells: 16, clips: [{ name: 'default', frames: 1 }], pieces: [{ clip: 'default', foot: 4 }] },
  'mini-pit-firing': { cells: 16, clips: [{ name: 'default', frames: 1 }], pieces: [{ clip: 'default', foot: 13 }] },
  'mini-charcoal-clamp': { cells: 16, clips: [{ name: 'default', frames: 1 }], pieces: [{ clip: 'default', foot: 14 }] },
  'mini-lean-to': { cells: 16, clips: [{ name: 'default', frames: 1 }], pieces: [{ clip: 'default', foot: 12 }] },
  'mini-well': { cells: 16, clips: [{ name: 'default', frames: 1 }], pieces: [{ clip: 'default', foot: 12 }] },
  'mini-bank-dig': { cells: 16, clips: [{ name: 'default', frames: 1 }], pieces: [{ clip: 'default', foot: 12 }] },
  'mini-clay-pit': { cells: 16, clips: [{ name: 'default', frames: 1 }], pieces: [{ clip: 'default', foot: 13 }] },
  'mini-reed-bed': { cells: 16, clips: [{ name: 'default', frames: 1 }], pieces: [{ clip: 'default', foot: 11 }] },
  'mini-fibre-patch': { cells: 16, clips: [{ name: 'default', frames: 1 }], pieces: [{ clip: 'default', foot: 12 }] },
  'mini-forage-camp': { cells: 16, clips: [{ name: 'default', frames: 1 }], pieces: [{ clip: 'default', foot: 13 }] },
  'mini-digging': { cells: 16, clips: [{ name: 'default', frames: 1 }], pieces: [{ clip: 'default', foot: 12 }] },
  'mini-woodcutter': { cells: 16, clips: [{ name: 'default', frames: 1 }], pieces: [{ clip: 'default', foot: 13 }] },
  'mini-slot': { cells: 16, clips: [{ name: 'default', frames: 1 }], pieces: [{ clip: 'default', foot: 0 }] },
  'works-roofed': {
    cells: 32,
    clips: [{ name: 'default', frames: 1 }, { name: 'smoke', frames: 3, fps: 2 }, { name: 'glow', frames: 1 }],
    pieces: [{ clip: 'default', foot: 29 }, { clip: 'smoke', foot: 30 }, { clip: 'glow', foot: 30 }],
  },
  'works-stone': {
    cells: 32,
    clips: [{ name: 'default', frames: 1 }, { name: 'smoke', frames: 3, fps: 2 }, { name: 'glow', frames: 1 }],
    pieces: [{ clip: 'default', foot: 29 }, { clip: 'smoke', foot: 30 }, { clip: 'glow', foot: 30 }],
  },

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
  'room-chute': {
    cells: 32,
    clips: ['n', 'e', 's', 'w'].flatMap((from) =>
      ['n', 'e', 's', 'w'].filter((to) => to !== from).map((to) => ({ name: `${from}${to}`, frames: 1 })),
    ),
  },
  'room-stone': {
    cells: 16,
    clips: [
      { name: 'big', frames: 1 },
      { name: 'small', frames: 1 },
    ],
  },
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

export const FRAMES_PER_SECOND = 6;

export function frameAt(time: number, frames: number, fps = FRAMES_PER_SECOND): number {
  return Math.floor(time * fps) % frames;
}

const MIN_TILE_CELLS = 8;

const loaded = new Map<string, HTMLCanvasElement[][]>();
const started = new Set<string>();

const totalFrames = (clips: readonly SpriteClip[]): number =>
  clips.reduce((sum, clip) => sum + clip.frames, 0);

function clipRange(name: string, clip: string): { at: number; frames: number } {
  let at = 0;
  for (const entry of SOURCES[name]?.clips ?? []) {
    if (entry.name === clip) return { at, frames: entry.frames };
    at += entry.frames;
  }
  return { at: 0, frames: 1 };
}

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

export interface TilePiece {
  clip?: string;
  depth: number;
}

const split = new Map<string, readonly TilePiece[]>();

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

function stepsFor(texel: number, levels: number): number | undefined {
  const steps = Math.round(Math.log2(texel / TEXEL));
  return steps >= 0 && steps < levels ? steps : undefined;
}

export function tileFits(name: string, zoom: number): boolean {
  const frames = sprite(name);
  const first = frames?.[0];
  return first !== undefined && stepsFor(levelFor(zoom).texel, first.length) !== undefined;
}

export interface Tint {
  color: string;
  strength: number;
}

const washes = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();

function tinted(frame: HTMLCanvasElement, tint: Tint | undefined): HTMLCanvasElement {
  if (!tint || tint.strength <= 0) return frame;

  const key = `${tint.color}|${tint.strength}`;
  let known = washes.get(frame);
  if (!known) washes.set(frame, (known = new Map()));
  const had = known.get(key);
  if (had) return had;

  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return frame;

  ctx.drawImage(frame, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = tint.strength;
  ctx.fillStyle = tint.color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(frame, 0, 0);

  known.set(key, canvas);
  return canvas;
}

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

export function drawTile(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  clip = 'default',
  step = 0,
  flip = false,
  tint?: Tint,
): boolean {
  const levels = frameOf(name, clip, step);
  if (!levels) return false;

  const transform = ctx.getTransform();
  if (transform.b !== 0 || transform.c !== 0) return false;

  const level = levelFor(Math.abs(transform.a));
  const steps = stepsFor(level.texel, levels.length);
  if (steps === undefined) return false;

  const canvas = tinted(levels[steps]!, tint);
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
