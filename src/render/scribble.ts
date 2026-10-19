import type { Vec2 } from '../sim/geometry.ts';
import { distance } from '../sim/geometry.ts';
import { hashString, rng } from '../sim/rng.ts';
import { HAND_FONT, INK } from './palette.ts';

export interface WobbleOptions {
  /** Peak sideways deviation in pixels. */
  amplitude?: number;
  /** Pixels per wobble period — long wavelengths read as a hand, short ones as a tremor. */
  wavelength?: number;
  /** Chosen once per stroke: the same seed must redraw the same line every frame. */
  seed?: number;
  /** Pixels between sampled points; smaller is smoother and slower. */
  step?: number;
}

const DEFAULTS = { amplitude: 1.6, wavelength: 42, step: 9 } as const;

function seedFor(parts: number[], explicit: number | undefined): number {
  if (explicit !== undefined) return explicit;
  return hashString(parts.map((value) => Math.round(value * 4)).join(':'));
}

/**
 * The sampled points of a hand-drawn version of the segment. A sine carries the long bow of a
 * drawn line and a seeded per-sample jitter supplies the grain; the seed defaults to a hash of
 * the endpoints, so a line redrawn every frame at the same place keeps the exact same wobble
 * instead of shimmering.
 */
export function wobblePoints(x1: number, y1: number, x2: number, y2: number, options: WobbleOptions = {}): Vec2[] {
  // One segment, one line, whichever end it is drawn from. The seed is a hash of the endpoints
  // in order and the offset is measured along the normal, so a segment traversed backwards got a
  // different seed *and* a mirrored wobble: two cells sharing an edge drew two different curves
  // and the mesh looked doubled. Canonicalise the direction and reverse the result instead.
  if (x2 < x1 || (x2 === x1 && y2 < y1)) {
    return wobblePoints(x2, y2, x1, y1, options).reverse();
  }

  const requested = options.amplitude ?? DEFAULTS.amplitude;
  const wavelength = options.wavelength ?? DEFAULTS.wavelength;
  const step = options.step ?? DEFAULTS.step;

  const span = Math.hypot(x2 - x1, y2 - y1);
  if (span < 0.001) return [{ x: x1, y: y1 }];

  // A dense polyline has segments a few units long, and a 2-unit wobble across a 5-unit segment
  // is not a drawn line, it is a saw. Cap the deviation against the segment it belongs to.
  const amplitude = Math.min(requested, span * 0.14);

  const nx = -(y2 - y1) / span;
  const ny = (x2 - x1) / span;
  const samples = Math.max(2, Math.ceil(span / step));
  const random = rng(seedFor([x1, y1, x2, y2], options.seed));
  const phase = random() * Math.PI * 2;
  const bow = (random() - 0.5) * amplitude * 0.8;

  const points: Vec2[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    // Taper to zero at both ends so joined strokes still meet at the corner.
    const taper = Math.sin(t * Math.PI) ** 0.6;
    const wave = Math.sin((t * span) / wavelength + phase) * amplitude;
    const grain = (random() - 0.5) * amplitude * 0.5;
    const offset = (wave + grain + bow) * taper;
    points.push({ x: x1 + (x2 - x1) * t + nx * offset, y: y1 + (y2 - y1) * t + ny * offset });
  }

  return points;
}

export function tracePoints(ctx: CanvasRenderingContext2D, points: readonly Vec2[], closed = false): void {
  const first = points[0];
  if (!first) return;
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i]!;
    ctx.lineTo(point.x, point.y);
  }
  if (closed) ctx.closePath();
}

export function drawWobblyLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: WobbleOptions = {},
): void {
  ctx.beginPath();
  tracePoints(ctx, wobblePoints(x1, y1, x2, y2, options));
  ctx.stroke();
}

/** A stroke restated: pencils double back, and the second pass is what sells the look. */
export function drawInkedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: WobbleOptions = {},
): void {
  drawWobblyLine(ctx, x1, y1, x2, y2, options);
  const previous = ctx.globalAlpha;
  ctx.globalAlpha = previous * 0.4;
  drawWobblyLine(ctx, x1, y1, x2, y2, { ...options, seed: (options.seed ?? hashString(`${x1}${y1}${x2}${y2}`)) + 7 });
  ctx.globalAlpha = previous;
}

export function wobblyPolylinePoints(points: readonly Vec2[], options: WobbleOptions = {}, closed = false): Vec2[] {
  const out: Vec2[] = [];
  const last = closed ? points.length : points.length - 1;
  for (let i = 0; i < last; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const segment = wobblePoints(a.x, a.y, b.x, b.y, options);
    out.push(...(i === 0 ? segment : segment.slice(1)));
  }
  return out;
}

export function drawWobblyPath(
  ctx: CanvasRenderingContext2D,
  points: readonly Vec2[],
  options: WobbleOptions = {},
  closed = false,
): void {
  ctx.beginPath();
  tracePoints(ctx, wobblyPolylinePoints(points, options, closed), closed);
  ctx.stroke();
}

/**
 * Fill a polygon exactly as given. Fills of neighbouring cells have to share their edge to the
 * last bit: wobble each one independently and the two edges part company, leaving a pale gap
 * between every pair of cells. The wobble belongs on the stroke, where only one line is drawn.
 */
export function fillPolygon(ctx: CanvasRenderingContext2D, points: readonly Vec2[]): void {
  if (points.length < 3) return;
  ctx.beginPath();
  tracePoints(ctx, points, true);
  ctx.fill();
}

export function fillWobblyPath(
  ctx: CanvasRenderingContext2D,
  points: readonly Vec2[],
  options: WobbleOptions = {},
): void {
  ctx.beginPath();
  tracePoints(ctx, wobblyPolylinePoints(points, options, true), true);
  ctx.fill();
}

export function drawWobblyCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  options: WobbleOptions = {},
): void {
  const segments = Math.max(8, Math.round(radius));
  const random = rng(seedFor([cx, cy, radius], options.seed));
  const amplitude = options.amplitude ?? 1.2;
  const points: Vec2[] = [];

  // Overshoot the circle slightly: a drawn ring closes past where it started.
  for (let i = 0; i <= segments + 1; i += 1) {
    const theta = (i / segments) * Math.PI * 2;
    const r = radius + (random() - 0.5) * amplitude + Math.sin(theta * 3) * amplitude * 0.3;
    points.push({ x: cx + Math.cos(theta) * r, y: cy + Math.sin(theta) * r });
  }

  ctx.beginPath();
  tracePoints(ctx, points);
  ctx.stroke();
}

/** Parallel pencil strokes clipped to the current path region — a flat colour never reads as drawn. */
export function hatchRegion(
  ctx: CanvasRenderingContext2D,
  points: readonly Vec2[],
  options: { spacing?: number; angle?: number; seed?: number; alpha?: number } = {},
): void {
  const { spacing = 9, angle = -Math.PI / 4, alpha = 0.3 } = options;

  // Along the lines, and across them.
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = Math.cos(angle + Math.PI / 2);
  const ny = Math.sin(angle + Math.PI / 2);

  let minAcross = Infinity;
  let maxAcross = -Infinity;
  let minAlong = Infinity;
  let maxAlong = -Infinity;
  for (const point of points) {
    const across = point.x * nx + point.y * ny;
    const along = point.x * dx + point.y * dy;
    minAcross = Math.min(minAcross, across);
    maxAcross = Math.max(maxAcross, across);
    minAlong = Math.min(minAlong, along);
    maxAlong = Math.max(maxAlong, along);
  }
  if (!Number.isFinite(minAcross)) return;

  ctx.save();
  ctx.beginPath();
  tracePoints(ctx, points, true);
  ctx.clip();
  ctx.globalAlpha *= alpha;

  const step = 14;
  const start = Math.floor(minAcross / spacing);
  const end = Math.ceil(maxAcross / spacing);

  for (let line = start; line <= end; line += 1) {
    const jitter = (rng(hashString(`hatch:${line}`))() - 0.5) * spacing * 0.35;
    const across = line * spacing + jitter;
    const phase = rng(hashString(`hatchphase:${line}`))() * Math.PI * 2;

    ctx.beginPath();
    for (let along = minAlong - spacing; along <= maxAlong + spacing; along += step) {
      // The wobble is a function of the absolute distance along the line, never of the shape, so
      // two chunks drawing the same stretch of a biome draw the same stroke. Anchoring any of
      // this to the shape's own centre puts the whole pattern on the chunk grid, which shows up
      // as a faint checkerboard across the map.
      const offset = across + Math.sin(along / 60 + phase);
      const x = dx * along + nx * offset;
      const y = dy * along + ny * offset;
      if (along <= minAlong - spacing) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

export function sketchText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: { size?: number; color?: string; align?: CanvasTextAlign; rotate?: number; alpha?: number } = {},
): void {
  const { size = 13, color = INK, align = 'center', rotate = 0, alpha = 1 } = options;
  ctx.save();
  ctx.translate(x, y);
  if (rotate) ctx.rotate(rotate);
  ctx.globalAlpha *= alpha;
  ctx.font = `${size}px ${HAND_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export const strokeWeight = {
  silhouette: 2.2,
  form: 1.5,
  detail: 1,
  texture: 0.7,
} as const;

export function pencil(ctx: CanvasRenderingContext2D, color: string, weight: number, alpha = 1): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

export const strokeSeed = (key: string): number => hashString(key);

export const spanOf = (a: Vec2, b: Vec2): number => distance(a, b);
