import type { Mask } from '../field.ts';
import { and, blob, capsule, noise, not, or } from '../field.ts';
import type { Grid, Stamp } from '../grid.ts';
import { outline, stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { FIRE, FOLIAGE, INK, NEEDLE, PAPER, STONE, WOOD } from '../palette.ts';
import type { Material, Region } from '../shade.ts';
import type { Crown } from '../shade.ts';
import { cone, dome, shade, surfaces } from '../shade.ts';
import { groundShadow } from '../view.ts';
import type { Decal } from './decals.ts';
import { groundStep } from './decals.ts';

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

export interface Standing {
  size: number;
  foot: { x: number; y: number };
  regions: readonly Region[];
  shadow: Mask;
  height: number;
  holes?: Mask;
  crown?: Crown;
  marks?: readonly { at: [number, number]; stamp: Stamp }[];
}

function stand(name: string, density: Decal['density'], thing: Standing): Decal {
  let size = thing.size;
  for (let y = 0; y < thing.size * 2; y += 1) {
    for (let x = 0; x < thing.size * 2; x += 1) {
      if (thing.shadow(x, y)) size = Math.max(size, x + 1, y + 1);
    }
  }

  const grid: Grid = shade(size, thing.regions, [SUN]);
  for (const mark of thing.marks ?? []) stamp(grid, mark.at[0], mark.at[1], mark.stamp);
  outline(grid, INK);

  const cells = new Uint32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const at = y * size + x;
      const color = grid.cells[at]!;
      if ((color & 0xff) !== 0) cells[at] = color;
      else if (thing.shadow(x, y)) cells[at] = groundStep(0);
    }
  }

  return { name, width: size, height: size, foot: thing.foot, density, stands: true, cells };
}

export interface LitProp {
  name: string;
  size: number;
  foot: { x: number; y: number };
  density: Decal['density'];
  height: number;
  sway: number;
  canopy: boolean;
  bend: boolean;
  emit?: boolean;
  grain?: readonly Grain[];
  albedo: Uint8Array;
  normals: Uint8Array;
}

export interface Grain {
  salt: number;
  scale: number;
  cover: number;
}

export interface Traits {
  sway: number;
  canopy: boolean;
  bend: boolean;
  emit?: boolean;
  grain?: readonly Grain[];
}

export function lit(name: string, density: Decal['density'], thing: Standing, tall: number, traits: Traits): LitProp {
  const { size } = thing;
  const { albedo: grid, normals } = surfaces(size, thing.regions, tall, thing.holes, thing.crown);

  const albedo = new Uint8Array(size * size * 4);
  for (let at = 0; at < size * size; at += 1) {
    const color = grid.cells[at]!;
    if ((color & 0xff) === 0) continue;
    albedo[at * 4] = (color >>> 24) & 0xff;
    albedo[at * 4 + 1] = (color >>> 16) & 0xff;
    albedo[at * 4 + 2] = (color >>> 8) & 0xff;
    albedo[at * 4 + 3] = 0xff;
  }

  return { name, size, foot: thing.foot, density, height: thing.height * tall, ...traits, albedo, normals };
}

export const LEAVES: Material = { ramp: FOLIAGE, relief: 4, ambient: 0.1, contrast: 0.85, speckle: 0.35 };

export const centred = (radius: number, margin: number): { size: number; foot: { x: number; y: number } } => {
  const size = Math.ceil(radius * 2 + margin);
  return { size, foot: { x: Math.round(size / 2), y: Math.round(size / 2) } };
};

const canopyShadow = (cx: number, cy: number, radius: number, seed: number): Mask =>
  blob(cx + radius * 0.3, cy + radius * 0.24, radius * 0.98, radius * 0.94, 0.1, seed);

export const canopyHoles = (foot: { x: number; y: number }, radius: number, seed: number, fringe: number): Mask => {
  const clearings = Array.from({ length: 3 }, (_, i) => {
    const angle = noise(seed, i + 60) * Math.PI * 2;
    const reach = radius * (0.2 + noise(seed, i + 70) * 0.45);
    const size = radius * (0.05 + noise(seed, i + 80) * 0.05);
    return blob(foot.x + Math.cos(angle) * reach, foot.y + Math.sin(angle) * reach, size, size * 0.8, 0.3, seed + i);
  });
  return (x, y) => {
    const d = Math.hypot(x - foot.x, y - foot.y) / radius;
    if (d > 0.7 && noise(Math.floor(x / 2), Math.floor(y / 2), seed + 5) < (d - 0.7) * fringe) return true;
    return clearings.some((clearing) => clearing(x, y));
  };
};

const cast = (mask: Mask, dx: number, dy: number): Mask => (x, y) => mask(Math.round(x - dx), Math.round(y - dy));

export interface Bump {
  x: number;
  y: number;
  r: number;
  h: number;
  shape?: 'flat' | 'cone';
}

export function crownOf(bumps: readonly Bump[]): Crown {
  return (x, y) => {
    let sum = 0;
    for (const bump of bumps) {
      const d = Math.hypot(x - bump.x, y - bump.y) / bump.r;
      if (d >= 1) continue;
      const rise =
        bump.shape === 'cone' ? 1 - d : bump.shape === 'flat' ? Math.min(1, Math.sqrt(1 - d * d) / 0.55) : Math.sqrt(1 - d * d);
      sum += (bump.h * rise) ** 4;
    }
    return sum ** 0.25;
  };
}

const roomy = (radius: number): { size: number; foot: { x: number; y: number } } => centred(radius * 1.3, 10);

function oak(radius: number, seed: number): Standing {
  const { size, foot } = roomy(radius);
  const kind = Math.floor(noise(seed, 99) * 4);
  const turn = noise(seed, 98) * Math.PI * 2;
  const axis = { x: Math.cos(turn), y: Math.sin(turn) };

  const squash = kind === 1 ? { x: 1.28, y: 0.8 } : { x: 1, y: 1 };
  const lean = kind === 3 ? 0.2 : 0;
  const shift = (side: number): { x: number; y: number } => ({
    x: axis.x * (lean + side * (kind === 2 ? 0.3 : 0)) * radius,
    y: axis.y * (lean + side * (kind === 2 ? 0.3 : 0)) * radius,
  });

  const lobes: { x: number; y: number; r: number; h: number }[] = [];
  const place = (cx: number, cy: number, r: number, side: number, rise: number): void => {
    const move = shift(side);
    const x = foot.x + cx * squash.x + move.x;
    const y = foot.y + cy * squash.y + move.y;
    const lifted = 1 + 0.55 * (axis.x * (x - foot.x) + axis.y * (y - foot.y)) / radius * (kind === 3 ? 1 : 0.35);
    lobes.push({ x, y, r, h: radius * rise * lifted * (kind === 1 ? 0.62 : 1) });
  };

  if (kind === 2) {
    place(0, 0, radius * 0.5, 1, 0.95);
    place(0, 0, radius * 0.5, -1, 0.85);
  } else {
    place(0, 0, radius * 0.62, 0, 0.7 + noise(seed, 97) * 0.3);
  }
  const count = 9 + Math.floor(noise(seed, 0) * 3);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + noise(seed, i) * 0.5;
    const reach = radius * (0.5 + noise(seed, i + 20) * 0.14);
    place(
      Math.cos(angle) * reach,
      Math.sin(angle) * reach,
      radius * (0.38 + noise(seed, i + 40) * 0.1),
      i % 2 === 0 ? 1 : -1,
      0.4 + noise(seed, i + 120) * 0.55,
    );
  }
  lobes.sort((a, b) => b.x + b.y - (a.x + a.y));

  const tufts: Bump[] = Array.from({ length: 3 }, (_, i) => {
    const angle = noise(seed, i + 130) * Math.PI * 2;
    const reach = radius * noise(seed, i + 140) * 0.55;
    return { x: foot.x + Math.cos(angle) * reach, y: foot.y + Math.sin(angle) * reach, r: radius * 0.22, h: radius * (0.9 + noise(seed, i + 150) * 0.3) };
  });

  return {
    size,
    foot,
    shadow: canopyShadow(foot.x, foot.y, radius, seed),
    height: radius * (kind === 1 ? 0.35 : 0.45),
    holes: canopyHoles(foot, radius, seed, 0.6),
    crown: crownOf([...lobes.map((lobe) => ({ x: lobe.x, y: lobe.y, r: lobe.r * 1.2, h: lobe.h })), ...(kind === 1 ? [] : tufts)]),
    regions: lobes.map((lobe, i) => ({
      mask: blob(lobe.x, lobe.y, lobe.r, lobe.r, 0.14, seed + i),
      material: { ...LEAVES, relief: lobe.r * 0.5 },
    })),
  };
}

function pine(radius: number, seed: number, snow: boolean): Standing {
  const { size, foot } = roomy(radius);
  const tiers = 3 + Math.floor(noise(seed, 90) * 3);
  const spray = 8 + Math.floor(noise(seed, 91) * 5);
  const broad = 0.8 + noise(seed, 92) * 0.5;
  const turn = noise(seed, 93) * Math.PI * 2;
  const leanBy = radius * (0.05 + noise(seed, 94) * 0.2);

  const centre = (index: number): { x: number; y: number } => {
    const along = index / tiers;
    return { x: foot.x + Math.cos(turn) * leanBy * along, y: foot.y + Math.sin(turn) * leanBy * along };
  };
  const reachOf = (index: number): number =>
    radius * broad * (1 - (index * 0.78) / tiers) * (0.9 + noise(seed, index + 95) * 0.2);

  const needles: Material = { ramp: NEEDLE, profile: dome, relief: 3, ambient: 0.08, contrast: 0.9, speckle: 0.55, grit: 0.9 };
  const core: Material = { ramp: NEEDLE, profile: cone, relief: radius * 0.3, ambient: 0.05, contrast: 0.9, speckle: 0.4, grit: 0.5 };

  const regions: Region[] = [];
  const tops: Mask[] = [];

  for (let index = 0; index < tiers; index += 1) {
    const at = centre(index);
    const reach = reachOf(index);
    const count = spray + (index % 2) * 2;
    const turned = noise(seed, index + 110) * Math.PI * 2;

    const sprays = Array.from({ length: count }, (_, i) => {
      const angle = turned + (i / count) * Math.PI * 2 + (noise(seed, index * 40 + i) - 0.5) * 0.5;
      const length = reach * (0.82 + noise(seed, index * 40 + i + 20) * 0.38);
      const width = Math.max(2.1, length * (0.14 + noise(seed, index * 40 + i + 10) * 0.07));
      const tip = { x: at.x + Math.cos(angle) * length, y: at.y + Math.sin(angle) * length };
      return { tip, width, angle, length };
    });
    sprays.sort((a, b) => a.tip.x + a.tip.y - (b.tip.x + b.tip.y));

    const heart = blob(at.x, at.y, reach * 0.55, reach * 0.55, 0.2, seed + index);
    regions.push({ mask: heart, material: core });

    const masks = sprays.map((spr, i) =>
      or(
        capsule(at.x, at.y, spr.tip.x, spr.tip.y, spr.width * 0.8),
        blob(spr.tip.x, spr.tip.y, spr.width * 1.15, spr.width * 0.95, 0.35, seed + index * 50 + i),
      ),
    );
    for (const mask of masks) regions.push({ mask, material: needles });
    tops.push(masks.reduce((all, mask) => or(all, mask), heart));
  }

  if (snow) {
    const white: Material = { ramp: PAPER, profile: dome, relief: 1, ambient: 0.45, contrast: 0.5, grit: 0.4 };
    tops.forEach((mask, i) => {
      const inner = tops[i + 1];
      const lying: Mask = (x, y) =>
        mask(x, y) &&
        !(inner?.(x, y) ?? false) &&
        x - foot.x + (y - foot.y) < radius * 0.2 &&
        noise(x, y, seed) > 0.4;
      regions.push({ mask: lying, material: white });
    });
  }

  const crown = crownOf(
    Array.from({ length: tiers }, (_, i) => {
      const at = centre(i);
      return { x: at.x, y: at.y, r: reachOf(i) * 1.05, h: radius * (0.55 + 0.35 * (i / tiers)) * (0.8 + noise(seed, i + 105) * 0.4), shape: 'cone' as const };
    }),
  );

  return { size, foot, shadow: canopyShadow(foot.x, foot.y, radius * 0.92, seed), height: radius * 0.9, holes: canopyHoles(foot, radius, seed, 0.2), crown, regions };
}

function acacia(radius: number, seed: number): Standing {
  const { size, foot } = roomy(radius);
  const count = 5 + Math.floor(noise(seed, 85) * 3);
  const lobes = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + noise(seed, i) * 0.6;
    const reach = radius * (0.42 + noise(seed, i + 9) * 0.2);
    return { x: foot.x + Math.cos(angle) * reach * 1.1, y: foot.y + Math.sin(angle) * reach * 0.85, r: radius * (0.32 + noise(seed, i + 19) * 0.1) };
  });
  const dry: Material = { ramp: FOLIAGE, relief: 3, ambient: 0.05, contrast: 0.75, speckle: 0.45 };
  const clumps: Bump[] = [
    { x: foot.x, y: foot.y, r: radius * 0.55, h: radius * 0.42, shape: 'flat' },
    ...lobes.map((lobe, i) => ({ ...lobe, r: lobe.r * 1.25, h: radius * (0.3 + noise(seed, i + 160) * 0.28), shape: 'flat' as const })),
  ];
  return {
    size,
    foot,
    shadow: canopyShadow(foot.x, foot.y, radius, seed),
    height: radius * 0.4,
    holes: canopyHoles(foot, radius, seed, 0.9),
    crown: crownOf(clumps),
    regions: [
      { mask: blob(foot.x, foot.y, radius * 0.6, radius * 0.5, 0.12, seed + 31), material: dry },
      ...lobes.map((lobe, i) => ({ mask: blob(lobe.x, lobe.y, lobe.r, lobe.r * 0.85, 0.16, seed + i), material: dry })),
    ],
  };
}

function snag(reach: number, seed: number): Standing {
  const { size, foot } = centred(reach, 10);
  let body: Mask = blob(foot.x, foot.y, 3.2, 3.2, 0.12, seed);
  const arms = 6;
  for (let i = 0; i < arms; i += 1) {
    const angle = (i / arms) * Math.PI * 2 + noise(seed, i) * 0.7;
    const length = reach * (0.6 + noise(seed, i + 7) * 0.4);
    const ex = foot.x + Math.cos(angle) * length;
    const ey = foot.y + Math.sin(angle) * length;
    body = or(body, capsule(foot.x, foot.y, ex, ey, 1.1));
    const fork = angle + (i % 2 === 0 ? 0.55 : -0.55);
    const mx = foot.x + Math.cos(angle) * length * 0.55;
    const my = foot.y + Math.sin(angle) * length * 0.55;
    body = or(body, capsule(mx, my, mx + Math.cos(fork) * length * 0.4, my + Math.sin(fork) * length * 0.4, 0.7));
  }
  return {
    size,
    foot,
    shadow: cast(body, 2, 2),
    height: reach * 0.5,
    regions: [{ mask: body, material: { ramp: WOOD, relief: 1.5, ambient: 0.25, contrast: 0.7 } }],
  };
}

function bareCrown(crown: Standing, seed: number): Standing {
  const { size, foot } = crown;
  const reach = ((size - 10) / 2 / 1.3) * 0.95;
  let body: Mask = blob(foot.x, foot.y, 3.4, 3.4, 0.12, seed);
  const limbs = 7 + Math.floor(noise(seed, 3) * 3);
  const at = (angle: number, length: number): { x: number; y: number } => ({
    x: foot.x + Math.cos(angle) * length,
    y: foot.y + Math.sin(angle) * length,
  });

  for (let i = 0; i < limbs; i += 1) {
    const angle = (i / limbs) * Math.PI * 2 + (noise(seed, i) - 0.5) * 0.7;
    const length = reach * (0.6 + noise(seed, i + 7) * 0.38);
    const bend = angle + (noise(seed, i + 15) - 0.5) * 0.5;
    const knee = at(angle, length * 0.5);
    const tip = { x: knee.x + Math.cos(bend) * length * 0.5, y: knee.y + Math.sin(bend) * length * 0.5 };
    body = or(body, capsule(foot.x, foot.y, knee.x, knee.y, 1.5));
    body = or(body, capsule(knee.x, knee.y, tip.x, tip.y, 1.05));

    for (const [t, side] of [[0.45, 1], [0.75, -1]] as const) {
      const base = { x: knee.x + (tip.x - knee.x) * t, y: knee.y + (tip.y - knee.y) * t };
      const fork = bend + side * (0.6 + noise(seed, i + 30) * 0.4);
      const twig = length * (0.26 + noise(seed, i + 40) * 0.12);
      const end = { x: base.x + Math.cos(fork) * twig, y: base.y + Math.sin(fork) * twig };
      body = or(body, capsule(base.x, base.y, end.x, end.y, 0.7));
      const spur = fork + side * 0.7;
      body = or(body, capsule(end.x, end.y, end.x + Math.cos(spur) * twig * 0.5, end.y + Math.sin(spur) * twig * 0.5, 0.5));
    }
  }

  return {
    size,
    foot,
    shadow: body,
    height: crown.height,
    regions: [{ mask: body, material: { ramp: WOOD, relief: 1.6, ambient: 0.2, contrast: 0.8, speckle: 0.3, grit: 0.5 } }],
  };
}

const BERRY: Stamp = [[0, 0, FIRE[3]!], [1, 1, FIRE[1]!]];

function bush(radius: number, seed: number, berries: boolean): Standing {
  const size = Math.ceil(radius * 2.6 + 4);
  const foot = { x: Math.round(size / 2), y: size - 4 };
  const c = { x: foot.x, y: foot.y - radius * 0.75 };
  const lobes = [
    blob(c.x - radius * 0.3, c.y - radius * 0.35, radius * 0.55, radius * 0.5, 0.15, seed + 3),
    blob(c.x + radius * 0.35, c.y - radius * 0.2, radius * 0.5, radius * 0.45, 0.15, seed + 1),
    and(blob(c.x, c.y, radius, radius * 0.8, 0.16, seed), (_x, y) => y <= foot.y),
    blob(c.x - radius * 0.2, c.y + radius * 0.25, radius * 0.5, radius * 0.4, 0.15, seed + 2),
  ];
  const marks = berries
    ? [0, 1, 2, 3, 4].map((i) => ({
        at: [Math.round(c.x + (noise(seed, i) - 0.5) * radius * 1.3), Math.round(c.y + (noise(seed, i + 5) - 0.5) * radius)] as [number, number],
        stamp: BERRY,
      }))
    : [];
  return {
    size,
    foot,
    shadow: groundShadow(foot.x, foot.y, radius * 2, seed, 0.3),
    height: radius * 0.5,
    regions: lobes.map((mask) => ({ mask, material: { ...LEAVES, relief: 3 } })),
    marks,
  };
}

const LICHEN: Stamp = [[0, 0, FIRE[2]!], [1, 0, FIRE[3]!], [0, 1, FIRE[1]!]];

function boulder(radius: number, seed: number, cover: 'bare' | 'lichen' | 'snow'): Standing {
  const size = Math.ceil(radius * 2.6 + 4);
  const foot = { x: Math.round(size / 2), y: size - 4 };
  const c = { x: foot.x, y: foot.y - radius * 0.62 };
  const body = and(blob(c.x, c.y, radius, radius * 0.72, 0.13, seed), (_x, y) => y <= foot.y);
  const top = and(body, blob(c.x - radius * 0.15, c.y - radius * 0.3, radius * 0.75, radius * 0.38, 0.15, seed + 5));
  const regions: Region[] = [
    { mask: body, material: { ramp: STONE, relief: radius * 0.7, ambient: 0.08, contrast: 0.8, speckle: 0.25 } },
    { mask: top, material: { ramp: STONE, relief: radius * 0.3, ambient: 0.45, contrast: 0.5, speckle: 0.2 } },
  ];
  if (cover === 'snow') {
    regions.push({
      mask: and(top, not(blob(c.x + radius * 0.5, c.y, radius * 0.4, radius * 0.4, 0.2, seed + 7))),
      material: { ramp: PAPER, relief: 1, ambient: 0.5, contrast: 0.45 },
    });
  }
  const marks =
    cover === 'lichen'
      ? [0, 1, 2].map((i) => ({
          at: [Math.round(c.x + (noise(seed, i) - 0.5) * radius * 1.2), Math.round(c.y + (noise(seed, i + 3) - 0.3) * radius * 0.6)] as [number, number],
          stamp: LICHEN,
        }))
      : [];
  return { size, foot, shadow: groundShadow(foot.x, foot.y, radius * 2, seed, 0.25), height: radius * 0.5, regions, marks };
}

type Make = (scale: number, variant: number) => Standing;

const TREES: readonly (readonly [string, Decal['density'], number, Make])[] = [
  ['tree.oak.1', { forest: 0.35, meadow: 0.02 }, 2, (s, v) => oak(28 * s, 301 + 97 * v)],
  ['tree.oak.2', { forest: 0.35, meadow: 0.02 }, 2, (s, v) => oak(32 * s, 317 + 97 * v)],
  ['tree.oak.3', { forest: 0.3, meadow: 0.015 }, 2, (s, v) => oak(36 * s, 331 + 97 * v)],
  ['tree.pine.1', { forest: 0.15, highland: 0.1 }, 2, (s, v) => pine(14 * s, 401 + 97 * v, false)],
  ['tree.pine.2', { forest: 0.15, highland: 0.1 }, 2, (s, v) => pine(16 * s, 419 + 97 * v, false)],
  ['tree.pine.3', { forest: 0.12, highland: 0.08, marsh: 0.03 }, 2, (s, v) => pine(11 * s, 433 + 97 * v, false)],
  ['tree.pine.snow.1', { tundra: 0.1 }, 2, (s, v) => pine(14 * s, 449 + 97 * v, true)],
  ['tree.pine.snow.2', { tundra: 0.08 }, 2, (s, v) => pine(11 * s, 463 + 97 * v, true)],
  ['tree.acacia', { desert: 0.02, meadow: 0.005 }, 3, (s, v) => acacia(30 * s, 503 + 97 * v)],
  ['tree.dead', { marsh: 0.04, tundra: 0.02, desert: 0.01 }, 3, (s, v) => snag(14 * s, 521 + 97 * v)],
];

export const STOREYS: readonly { name: string; scale: number; tall: number; share: number }[] = [
  { name: 'low', scale: 0.82, tall: 0.6, share: 0.35 },
  { name: 'mid', scale: 1, tall: 1, share: 0.4 },
  { name: 'high', scale: 1.18, tall: 1.6, share: 0.25 },
];

export const shared = (density: Decal['density'], share: number): Decal['density'] =>
  Object.fromEntries(Object.entries(density).map(([material, weight]) => [material, weight * share]));

const TREE_TRAITS: Traits = { sway: 1, canopy: true, bend: false };

export const LIT_TREES: readonly LitProp[] = TREES.flatMap(([name, density, variants, make]) =>
  Array.from({ length: variants }, (_, variant) =>
    STOREYS.map((storey) =>
      lit(
        `${name}.v${variant}.${storey.name}`,
        shared(density, storey.share / variants),
        make(storey.scale, variant),
        storey.tall,
        TREE_TRAITS,
      ),
    ),
  ).flat(),
);

export const LIT_BARE: readonly LitProp[] = TREES.filter(([name]) => name.startsWith('tree.oak')).flatMap(([name, , variants, make]) =>
  Array.from({ length: variants }, (_, variant) =>
    STOREYS.map((storey) =>
      lit(
        `${name.replace('tree.', 'bare.')}.v${variant}.${storey.name}`,
        {},
        bareCrown(make(storey.scale, variant), 400 + variant * 53 + name.length),
        storey.tall,
        { sway: 0, canopy: false, bend: false },
      ),
    ),
  ).flat(),
);

export const OBJECTS: readonly Decal[] = [
  ...TREES.map(([name, density, , make]) => stand(name, density, make(1, 0))),
  stand('bush.1', { meadow: 0.12, forest: 0.2, highland: 0.08 }, bush(6, 601, false)),
  stand('bush.2', { meadow: 0.1, forest: 0.2, marsh: 0.1 }, bush(5, 613, false)),
  stand('bush.berries', { meadow: 0.06, forest: 0.1 }, bush(6, 627, true)),
  stand('boulder.1', { highland: 0.15, meadow: 0.02 }, boulder(7, 701, 'bare')),
  stand('boulder.2', { highland: 0.12, desert: 0.04 }, boulder(5, 719, 'bare')),
  stand('boulder.lichen', { highland: 0.1, tundra: 0.08 }, boulder(6, 733, 'lichen')),
  stand('boulder.snow', { tundra: 0.1 }, boulder(7, 751, 'snow')),
];
