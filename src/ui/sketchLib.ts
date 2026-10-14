/**
 * A small drawing kit for the world scene. Hand-written path data tops out at a handful of
 * control points, which is what makes a shape read as a cartoon: an oval for a sea, a triangle
 * for a mountain. These helpers build silhouettes from seeded harmonics and shade them with
 * clipped hatching, so every instance is irregular, unrepeated and dense enough to look drawn.
 */

export type Point = { x: number; y: number };

export function rng(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (value: number) => Math.round(value * 10) / 10;

/** Catmull-Rom through the points, emitted as cubic Béziers so the outline stays smooth. */
export function curveThrough(points: Point[], closed = true, tension = 1): string {
  const n = points.length;
  if (n < 2) return '';
  let d = `M ${r1(points[0]!.x)} ${r1(points[0]!.y)}`;
  const last = closed ? n : n - 1;

  for (let i = 0; i < last; i += 1) {
    const p0 = points[(i - 1 + n) % n]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n]!;
    const p3 = points[(i + 2) % n]!;
    const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * tension, y: p1.y + ((p2.y - p0.y) / 6) * tension };
    const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * tension, y: p2.y - ((p3.y - p1.y) / 6) * tension };
    d += ` C ${r1(c1.x)} ${r1(c1.y)}, ${r1(c2.x)} ${r1(c2.y)}, ${r1(p2.x)} ${r1(p2.y)}`;
  }

  return closed ? `${d} Z` : d;
}

export interface BlobOptions {
  points?: number;
  /** Amplitude of the low-frequency lobes: bays and headlands. */
  lobes?: number;
  /** Amplitude of the per-vertex wobble: the small irregularity of a real edge. */
  grit?: number;
  squashY?: number;
}

export function blobPoints(seed: number, radius: number, options: BlobOptions = {}): Point[] {
  const { points = 30, lobes = 0.16, grit = 0.05, squashY = 1 } = options;
  const random = rng(seed);
  const harmonics = [3, 5, 7, 11].map((k) => ({
    k,
    phase: random() * Math.PI * 2,
    amp: (lobes * (random() * 0.7 + 0.5)) / Math.sqrt(k),
  }));

  return Array.from({ length: points }, (_, index) => {
    const theta = (index / points) * Math.PI * 2;
    const wave = harmonics.reduce((sum, h) => sum + h.amp * Math.sin(h.k * theta + h.phase), 0);
    const r = radius * (1 + wave + (random() - 0.5) * grit);
    return { x: Math.cos(theta) * r, y: Math.sin(theta) * r * squashY };
  });
}

export function blobPath(seed: number, radius: number, options: BlobOptions = {}): string {
  return curveThrough(blobPoints(seed, radius, options));
}

/** The same outline pulled inward — a second coastline, a cliff edge, an inner shadow. */
export function insetPath(seed: number, radius: number, inset: number, options: BlobOptions = {}): string {
  return curveThrough(
    blobPoints(seed, radius, options).map((point) => {
      const length = Math.hypot(point.x, point.y) || 1;
      const scale = Math.max(0.05, (length - inset) / length);
      return { x: point.x * scale, y: point.y * scale };
    }),
  );
}

/** A mountain silhouette: a jagged skyline with sub-peaks, not an isoceles triangle. */
export function ridgePath(
  seed: number,
  width: number,
  height: number,
  options: { segments?: number; crater?: number } = {},
): string {
  const { segments = 9, crater = 0 } = options;
  const random = rng(seed);
  const points: Point[] = [{ x: -width / 2, y: 0 }];
  const peak = Math.floor(segments / 2);

  for (let i = 1; i < segments; i += 1) {
    const t = i / segments;
    const x = -width / 2 + width * t;
    const slope = 1 - Math.abs(t - 0.5) * 2;
    const jag = (random() - 0.5) * height * 0.16;
    const shoulder = i === peak ? 1 : 0.82 + random() * 0.18;
    points.push({ x: x + (random() - 0.5) * width * 0.04, y: -height * slope * shoulder + jag });
  }
  points.push({ x: width / 2, y: 0 });

  const climb = points.slice(0, peak + 1);
  const fall = points.slice(peak + 1);
  const lip = crater
    ? [
        { x: -crater / 2, y: climb[climb.length - 1]!.y + crater * 0.12 },
        { x: 0, y: climb[climb.length - 1]!.y + crater * 0.3 },
        { x: crater / 2, y: climb[climb.length - 1]!.y + crater * 0.1 },
      ]
    : [];

  const outline = [...climb, ...lip, ...fall];
  const body = outline.map((p) => `L ${r1(p.x)} ${r1(p.y)}`).join(' ');
  return `M ${r1(outline[0]!.x)} ${r1(outline[0]!.y)} ${body} Z`;
}

/**
 * Engraver's hatching: parallel strokes across a region, meant to be clipped to a shape.
 * Lengths and bow vary per stroke; a grid of identical lines looks printed, not drawn.
 */
export function hatchStrokes(
  seed: number,
  extent: number,
  spacing: number,
  options: { bow?: number; ragged?: number } = {},
): string[] {
  const { bow = 1.6, ragged = 0.22 } = options;
  const random = rng(seed);
  const strokes: string[] = [];

  for (let y = -extent; y <= extent; y += spacing) {
    const trim = extent * ragged;
    const x1 = -extent + random() * trim;
    const x2 = extent - random() * trim;
    const mid = (x1 + x2) / 2;
    const yy = y + (random() - 0.5) * spacing * 0.3;
    strokes.push(
      `M ${r1(x1)} ${r1(yy)} Q ${r1(mid)} ${r1(yy + (random() - 0.5) * bow * 2)} ${r1(x2)} ${r1(yy + (random() - 0.5) * bow)}`,
    );
  }

  return strokes;
}

/** Short tapering ticks used for foam, grass tufts and leaf edges. */
export function tickMarks(
  seed: number,
  count: number,
  radius: number,
  length: number,
  squashY = 1,
): string[] {
  const random = rng(seed);
  return Array.from({ length: count }, () => {
    const theta = random() * Math.PI * 2;
    const r = radius * (0.88 + random() * 0.18);
    const x = Math.cos(theta) * r;
    const y = Math.sin(theta) * r * squashY;
    const len = length * (0.6 + random() * 0.8);
    return `M ${r1(x)} ${r1(y)} l ${r1(Math.cos(theta) * len)} ${r1(Math.sin(theta) * len * squashY)}`;
  });
}
