import { MIND } from '../render/palette.ts';
import { ICON_CELLS, ICON_COLS, ICON_NAMES, ICON_SCALE, SHEET_VERSION } from '../pixel/ui/metrics.ts';
import type { IconName } from '../pixel/ui/metrics.ts';
import type { MindView } from '../sim/mind/mind.ts';
import { RING_RADII, SECTORS, neuronOf, polar, sectorAt } from '../sim/mind/neurons.ts';
import { drawText, textWidth } from './pixelText.ts';

export interface MindHost {
  view(): MindView | null;
  selected(): number;
  wonder(a: number, b: number): void;
  forget(id: number): void;
  lookAt(person: number): void;
}

export const TREE_WIDTH = 480;

export const TREE_HEIGHT = 428;

export const CENTRE_X = TREE_WIDTH / 2;

export const CENTRE_Y = TREE_HEIGHT / 2;

export const SOMA = 12;

export const HIT_RADIUS = 15;

export const HOLD_SECONDS = 0.9;

const sheet = new Image();
sheet.src = `/ui/icons.png?v=${SHEET_VERSION}`;

export interface Spot {
  x: number;
  y: number;
}

export const spotOf = (angle: number, ring: number): Spot => {
  const at = polar(angle, ring);
  return { x: Math.round(CENTRE_X + at.x), y: Math.round(CENTRE_Y + at.y) };
};

export const rim = (at: Spot, toward: Spot, gap = SOMA + 1): Spot => {
  const away = Math.hypot(toward.x - at.x, toward.y - at.y) || 1;
  return { x: at.x + ((toward.x - at.x) / away) * gap, y: at.y + ((toward.y - at.y) / away) * gap };
};

export function icon(ctx: CanvasRenderingContext2D, name: IconName, x: number, y: number, size: number): void {
  if (!sheet.complete || sheet.naturalWidth === 0) return;
  const slot = ICON_NAMES.indexOf(name);
  if (slot < 0) return;
  const cell = ICON_CELLS * ICON_SCALE;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, (slot % ICON_COLS) * cell, Math.floor(slot / ICON_COLS) * cell, cell, cell, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
}

export const hash = (a: number, b: number): number => {
  let mix = Math.imul(a + 0x9e3779b1, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  mix ^= mix >>> 15;
  mix = Math.imul(mix, 0x2c1b3c6d);
  return ((mix ^ (mix >>> 12)) >>> 0) / 0xffffffff;
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, colour: string): void => {
  ctx.fillStyle = colour;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
};

function line(ctx: CanvasRenderingContext2D, from: Spot, to: Spot, colour: (step: number) => string | null): void {
  let x = Math.round(from.x);
  let y = Math.round(from.y);
  const endX = Math.round(to.x);
  const endY = Math.round(to.y);
  const dx = Math.abs(endX - x);
  const dy = -Math.abs(endY - y);
  const sx = x < endX ? 1 : -1;
  const sy = y < endY ? 1 : -1;
  let error = dx + dy;
  for (let step = 0; step < 4000; step += 1) {
    const paint = colour(step);
    if (paint) dot(ctx, x, y, paint);
    if (x === endX && y === endY) break;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y += sy;
    }
  }
}

function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, shade: (dx: number, dy: number, away: number) => string | null): void {
  const reach = Math.ceil(radius + 1);
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const away = Math.hypot(dx, dy);
      if (away > radius + 0.4) continue;
      const colour = shade(dx, dy, away);
      if (colour) dot(ctx, cx + dx, cy + dy, colour);
    }
  }
}

export function drawBackdrop(ctx: CanvasRenderingContext2D, time: number, active: ReadonlySet<string>): void {
  const bands = [MIND.sky, MIND.sky2, MIND.sky, MIND.deep];
  for (let y = 0; y < TREE_HEIGHT; y += 1) {
    for (let x = 0; x < TREE_WIDTH; x += 1) {
      const away = Math.hypot(x - CENTRE_X, (y - CENTRE_Y) * 1.1) / (TREE_WIDTH * 0.62);
      const level = Math.min(bands.length - 1, away * (bands.length - 1));
      const lower = Math.floor(level);
      const pick = BAYER[(y % 4) * 4 + (x % 4)]! / 16 < level - lower ? lower + 1 : lower;
      dot(ctx, x, y, bands[Math.min(bands.length - 1, pick)]!);
    }
  }
  for (const radius of RING_RADII.slice(1)) {
    const steps = Math.ceil(radius * 6.3);
    for (let step = 0; step < steps; step += 1) {
      if (step % 4 !== 0) continue;
      const angle = (step / steps) * Math.PI * 2;
      dot(ctx, CENTRE_X + Math.cos(angle) * radius, CENTRE_Y + Math.sin(angle) * radius, MIND.halo);
    }
  }
  const outer = RING_RADII[RING_RADII.length - 1]! + 16;
  for (const sector of SECTORS) {
    const edge = polar(sector.from, 1);
    const length = Math.hypot(edge.x, edge.y) || 1;
    for (let reach = 18; reach < outer; reach += 1) {
      if (reach % 5 < 2) dot(ctx, CENTRE_X + (edge.x / length) * reach, CENTRE_Y + (edge.y / length) * reach, MIND.halo);
    }
    const span = (sector.to - sector.from + 360) % 360;
    const middle = polar(sector.from + span / 2, 1);
    const direction = Math.hypot(middle.x, middle.y) || 1;
    const lit = active.has(sector.id);
    const label = sector.label;
    const reachOut = outer + 4;
    drawText(ctx, label, CENTRE_X + (middle.x / direction) * reachOut - textWidth(label) / 2, CENTRE_Y + (middle.y / direction) * reachOut - 4, lit ? MIND.light : MIND.rim, MIND.deep);
  }
  for (let spark = 0; spark < 40; spark += 1) {
    const lit = Math.sin(time * (0.5 + hash(spark, 4)) + spark * 3) > 0.2;
    dot(ctx, hash(spark, 5) * TREE_WIDTH, hash(spark, 6) * TREE_HEIGHT, lit ? MIND.light : MIND.rim);
  }
}

export function drawCore(ctx: CanvasRenderingContext2D, time: number): void {
  const at = { x: CENTRE_X, y: CENTRE_Y };
  halo(ctx, at, 9, 0.6 + 0.2 * Math.sin(time * 2));
  disc(ctx, at.x, at.y, 9, (_dx, _dy, away) => (away > 8 ? MIND.rim : MIND.nucleus));
  icon(ctx, 'brain', at.x, at.y, 14);
}

export const sectorsOf = (angles: readonly number[]): Set<string> => new Set(angles.map((angle) => sectorAt(angle).id));

function halo(ctx: CanvasRenderingContext2D, at: Spot, radius: number, strength: number): void {
  const reach = Math.round(radius + 4 + 8 * strength);
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const away = Math.hypot(dx, dy);
      if (away <= radius || away > reach) continue;
      const fall = (away - radius) / (reach - radius);
      if (BAYER[(((at.y + dy) & 3) * 4 + ((at.x + dx) & 3))]! / 16 < (1 - fall) * 0.8) dot(ctx, at.x + dx, at.y + dy, fall < 0.5 ? MIND.halo : MIND.haloFar);
    }
  }
}

export function drawDendrites(ctx: CanvasRenderingContext2D, at: Spot, seed: number, radius: number, time: number): void {
  const arms = 5;
  for (let arm = 0; arm < arms; arm += 1) {
    const base = -Math.PI / 2 + (arm / arms) * Math.PI * 2 + (hash(seed, arm) - 0.5) * 0.5;
    let angle = base;
    let x = at.x + Math.cos(angle) * radius;
    let y = at.y + Math.sin(angle) * radius;
    const length = 7 + hash(seed, arm + 9) * 8;
    const trail: Spot[] = [{ x, y }];
    for (let step = 0; step < length; step += 1) {
      angle += (hash(seed, arm * 50 + step) - 0.5) * 0.35;
      x += Math.cos(angle);
      y += Math.sin(angle);
      trail.push({ x, y });
    }
    trail.forEach((point, step) => {
      dot(ctx, point.x, point.y, step % 7 === 3 && Math.floor(time * 3 + arm) % 4 === 0 ? MIND.white : MIND.light);
    });
    for (const fork of [0.45, 0.75]) {
      const origin = trail[Math.floor(trail.length * fork)]!;
      const side = hash(seed, arm * 3 + (fork > 0.5 ? 1 : 2)) > 0.5 ? 1 : -1;
      let branchAngle = base + side * 0.8;
      let bx = origin.x;
      let by = origin.y;
      for (let step = 0; step < 4; step += 1) {
        branchAngle += (hash(seed, arm * 90 + step + 7) - 0.5) * 0.3;
        bx += Math.cos(branchAngle);
        by += Math.sin(branchAngle);
        dot(ctx, bx, by, MIND.glow);
      }
      dot(ctx, bx, by, MIND.bright);
    }
    const tip = trail[trail.length - 1]!;
    dot(ctx, tip.x, tip.y, MIND.bright);
  }
}

export function drawCell(ctx: CanvasRenderingContext2D, at: Spot, strength: number, name: IconName | null, time: number, glyph: readonly string[] | null = null): void {
  halo(ctx, at, SOMA, strength);
  drawDendrites(ctx, at, at.x * 31 + at.y, SOMA - 2, time);
  disc(ctx, at.x, at.y, SOMA, (dx, dy, away) => {
    if (away > SOMA - 0.6) return MIND.rim;
    const lean = (dx + dy) / SOMA;
    return lean < -0.5 ? MIND.light : lean < 0.15 ? MIND.glow : MIND.rim;
  });
  disc(ctx, at.x, at.y, 8, (_dx, _dy, away) => (away > 7.2 ? MIND.bright : MIND.nucleus));
  if (name) icon(ctx, name, at.x, at.y, 14);
  if (glyph) {
    glyph.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) if (row[x] === 'X') dot(ctx, at.x - Math.floor(row.length / 2) + x, at.y - Math.floor(glyph.length / 2) + y, MIND.white);
    });
  }
}

export const QUERY_GLYPH: readonly string[] = ['.XXX.', 'X...X', '....X', '..XX.', '..X..', '.....', '..X..'];

const FAN_LENGTH = 12;

export type Fate = 'pulsing' | 'fixed' | 'weak' | 'dead';

function pointOn(from: Spot, to: Spot, bend: number, t: number): Spot {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const nx = -(to.y - from.y) / length;
  const ny = (to.x - from.x) / length;
  const midX = (from.x + to.x) / 2 + nx * bend;
  const midY = (from.y + to.y) / 2 + ny * bend;
  const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * midX + t * t * to.x;
  const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * midY + t * t * to.y;
  const seed = from.x * 0.13 + to.y * 0.07;
  const sway = (Math.sin(t * Math.PI * 3 + seed) * 5 + Math.sin(t * Math.PI * 7 + seed * 2.3) * 2.2) * Math.sin(t * Math.PI) * Math.min(1, length / 60);
  return { x: x + nx * sway, y: y + ny * sway };
}


function strand(ctx: CanvasRenderingContext2D, points: readonly Spot[], fate: Fate, time: number, seed: number, thin: boolean): void {
  const steps = points.length - 1;
  const beat = Math.floor(time * 5) % 2 === 0;
  const body = fate === 'dead' ? MIND.mute : fate === 'weak' ? MIND.glow : beat && fate === 'pulsing' ? MIND.bright : MIND.light;
  points.forEach((point, step) => {
    if (fate === 'dead') {
      const gone = Math.floor(step / 7) % 3 === 1 || hash(step, seed) < 0.18;
      if (!gone) dot(ctx, point.x, point.y, step % 4 === 0 ? MIND.witherDark : step % 3 === 0 ? MIND.witherPale : MIND.wither);
      return;
    }
    if (fate === 'pulsing' && (step + Math.floor(time * 12)) % 4 === 3) return;
    dot(ctx, point.x, point.y, thin ? (step % 2 === 0 ? body : MIND.rim) : body);
    if (!thin && fate !== 'pulsing' && step % 6 < 3) dot(ctx, point.x + 1, point.y, MIND.rim);
  });
  if (fate === 'dead' || steps < 4) return;
  const speed = fate === 'pulsing' ? 70 : 36;
  const spacing = 55;
  const period = Math.max(steps, spacing) + spacing;
  const phase = (seed * 17) % period;
  for (let beatAt = 0; beatAt * spacing < period; beatAt += 1) {
    const travelled = (time * speed + phase + beatAt * spacing) % period;
    for (let tail = 0; tail < 4; tail += 1) {
      const along = Math.floor(travelled) - tail;
      const point = along >= 0 && along <= steps ? points[steps - along] : undefined;
      if (point) dot(ctx, point.x, point.y, tail === 0 ? MIND.white : tail < 3 ? MIND.bright : MIND.light);
    }
  }
}

export function drawLink(ctx: CanvasRenderingContext2D, from: Spot, to: Spot, bend: number, fate: Fate, time: number): void {
  const length = Math.hypot(to.x - from.x, to.y - from.y) + Math.abs(bend);
  const sample = (a: Spot, b: Spot, bow: number, last: number, count: number): Spot[] =>
    Array.from({ length: count + 1 }, (_, step) => pointOn(a, b, bow, (step / count) * last));
  const fan = Math.min(FAN_LENGTH, length * 0.25);
  const split = 1 - fan / Math.max(1, length);
  const trunkSteps = Math.max(8, Math.ceil(length * split));
  const trunk = sample(from, to, bend, split, trunkSteps);
  strand(ctx, trunk, fate, time, from.x + to.y, false);

  const joint = trunk[trunk.length - 1]!;
  const dead = fate === 'dead';
  for (let branch = -2; branch <= 2; branch += 1) {
    const wilt = dead ? 0.55 : 1;
    const run = Math.hypot(to.x - joint.x, to.y - joint.y) || 1;
    const px = -(to.y - joint.y) / run;
    const py = (to.x - joint.x) / run;
    const side = branch * (dead ? 2 : 2.6);
    const end = {
      x: joint.x + (to.x - joint.x) * wilt + px * side,
      y: joint.y + (to.y - joint.y) * wilt + py * side + (dead ? 2 + Math.abs(branch) : 0),
    };
    const reach = Math.max(3, Math.ceil(Math.hypot(end.x - joint.x, end.y - joint.y) + 2));
    strand(ctx, sample(joint, end, branch * (dead ? 1 : 2), 1, reach), fate, time, from.x + branch * 31, true);
    if (!dead) dot(ctx, end.x, end.y, MIND.bright);
  }

  const middle = trunk[Math.floor(trunk.length / 2)]!;
  const mx = Math.round(middle.x);
  const my = Math.round(middle.y);
  const beat = Math.floor(time * 5) % 2 === 0;
  const swell = fate === 'pulsing' ? (beat ? 4 : 3) : 3;
  if (fate === 'dead') {
    disc(ctx, mx, my + 1, 2, (dx, dy, away) => (away > 1.4 ? MIND.witherDark : dx + dy < 0 ? MIND.witherPale : MIND.wither));
    for (const [ax, ay] of [[-2, -1], [2, 0], [0, -2], [1, 2]] as const) dot(ctx, mx + ax, my + ay, MIND.witherDark);
    dot(ctx, mx, my + 1, MIND.witherDark);
    return;
  }
  const tone = fate === 'weak' ? [MIND.glow, MIND.rim, MIND.nucleus] : [MIND.bright, MIND.light, MIND.glow];
  for (const [ax, ay] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    for (let reach = swell + 1; reach <= swell + 3; reach += 1) dot(ctx, mx + ax * reach, my + ay * (reach - 1), reach === swell + 3 ? tone[0]! : tone[1]!);
  }
  disc(ctx, mx, my, swell, (dx, dy, away) => (away > swell - 0.8 ? tone[2]! : dx + dy < 0 ? tone[0]! : tone[1]!));
  dot(ctx, mx, my, MIND.white);
}

export function caption(ctx: CanvasRenderingContext2D, text: string, at: Spot, colour: string, offset = SOMA + 6): void {
  drawText(ctx, text, at.x - textWidth(text) / 2, at.y + offset, colour, MIND.deep);
}

export function ringAround(ctx: CanvasRenderingContext2D, at: Spot, radius: number, colour: string, every = 2): void {
  const steps = Math.ceil(radius * 6);
  for (let step = 0; step < steps; step += 1) {
    if (step % every !== 0) continue;
    const angle = (step / steps) * Math.PI * 2;
    dot(ctx, at.x + Math.cos(angle) * radius, at.y + Math.sin(angle) * radius, colour);
  }
}

export function drawTrail(ctx: CanvasRenderingContext2D, path: readonly Spot[], heading: number, time: number, growing: boolean, ready: boolean): void {
  path.forEach((point, step) => {
    const lit = (step + Math.floor(time * 14)) % 9 < 2;
    dot(ctx, point.x, point.y, lit ? MIND.white : step % 2 === 0 ? MIND.light : MIND.glow);
    if (step % 11 === 5) {
      const side = hash(step, 3) > 0.5 ? 1 : -1;
      const base = path[Math.max(0, step - 1)]!;
      const angle = Math.atan2(point.y - base.y, point.x - base.x) + side * 1.1;
      for (let reach = 1; reach <= 3; reach += 1) dot(ctx, point.x + Math.cos(angle) * reach, point.y + Math.sin(angle) * reach, reach === 3 ? MIND.bright : MIND.glow);
    }
  });
  const tip = path[path.length - 1];
  if (!tip) return;
  const flick = Math.floor(time * 12);
  for (let spine = -1; spine <= 1; spine += 1) {
    const angle = heading + spine * 0.7 + (hash(flick, spine + 5) - 0.5) * 0.5;
    const length = 3 + Math.floor(hash(flick, spine + 9) * 3);
    for (let reach = 1; reach <= length; reach += 1) dot(ctx, tip.x + Math.cos(angle) * reach, tip.y + Math.sin(angle) * reach, reach === length ? MIND.white : MIND.light);
  }
  disc(ctx, Math.round(tip.x), Math.round(tip.y), growing || ready ? 2 : 1, (_dx, _dy, away) => (away < 1 ? MIND.white : ready ? MIND.white : MIND.bright));
}

export function drawWitheredCell(ctx: CanvasRenderingContext2D, at: Spot, time: number): void {
  for (let arm = 0; arm < 4; arm += 1) {
    let angle = Math.PI / 2 + (arm - 1.5) * 0.9 + (hash(at.x, arm) - 0.5) * 0.4;
    let x = at.x + Math.cos(angle) * 9;
    let y = at.y + Math.sin(angle) * 9;
    const length = 5 + hash(at.y, arm) * 5;
    for (let step = 0; step < length; step += 1) {
      angle += 0.12 * Math.sign(Math.cos(angle) || 1);
      x += Math.cos(angle);
      y += Math.sin(angle) * 0.8 + 0.35;
      if (hash(step, arm + at.x) > 0.22) dot(ctx, x, y, step % 3 === 0 ? MIND.witherPale : MIND.wither);
    }
    dot(ctx, x, y, MIND.witherDark);
  }
  disc(ctx, at.x, at.y + 1, SOMA - 2, (dx, dy, away) => {
    if (away > SOMA - 3.2 && hash(dx * 7 + at.x, dy * 5 + at.y) > 0.55) return null;
    if (away > SOMA - 3.6) return MIND.witherDark;
    return (dx + dy) / SOMA < -0.3 ? MIND.witherPale : MIND.wither;
  });
  disc(ctx, at.x + 1, at.y + 2, 5, (dx, dy, away) => (away > 3.8 ? MIND.wither : dx + dy < 0 ? MIND.witherDark : MIND.deep));
  for (const [ax, ay] of [[-6, -3], [-5, -4], [5, -2], [6, 1], [-2, 6], [-1, 7], [3, 5]] as const) dot(ctx, at.x + ax, at.y + ay, MIND.witherDark);
  for (let crack = 0; crack < 6; crack += 1) dot(ctx, at.x - 3 + crack, at.y - 1 + (crack % 3), MIND.witherDark);
  if (Math.floor(time * 0.7 + at.x) % 5 === 0) dot(ctx, at.x + 4, at.y + SOMA, MIND.wither);
}

export const iconOf = (id: string): IconName => `neuron-${id}` as IconName;

export const nameOf = (neuron: number): string => neuronOf(neuron).label;

export { dot, line };
