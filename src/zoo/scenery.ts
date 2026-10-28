import { seeded } from '../render/lit/growth/random.ts';
import type { SceneryTree } from '../render/lit/scenery.ts';
import type { Vec2 } from '../sim/geometry.ts';

export interface TreeLook {
  key: 'none' | 'grown';
  title: string;
}

export const TREE_LOOKS: readonly TreeLook[] = [
  { key: 'none', title: 'no trees' },
  { key: 'grown', title: 'grown' },
];

export interface Season {
  key: string;
  title: string;
  phase: number;
}

export const SEASONS: readonly Season[] = [
  { key: 'spring', title: 'spring', phase: 0.05 },
  { key: 'summer', title: 'summer', phase: 0.3 },
  { key: 'autumn', title: 'autumn', phase: 0.62 },
  { key: 'winter', title: 'winter', phase: 0.85 },
];

const GROVE: readonly (Omit<SceneryTree, 'x' | 'y'> & { dx: number; dy: number })[] = [
  { art: 'oak', variant: 0, storey: 'mid', dx: -3, dy: -1.5, flip: false, wind: 0.4 },
  { art: 'birch', variant: 0, storey: 'mid', dx: 2.5, dy: -2.5, flip: true, wind: 0.4 },
  { art: 'pine', variant: 0, storey: 'mid', dx: 1, dy: 2, flip: false, wind: 0.4 },
  { art: 'spruce', variant: 0, storey: 'mid', dx: -1.5, dy: 3.5, flip: false, wind: 0.4 },
];

export const groveAround = (origin: Vec2): SceneryTree[] =>
  GROVE.map(({ dx, dy, ...tree }) => ({ ...tree, x: origin.x + dx, y: origin.y + dy }));

export interface SeeThroughMode {
  key: 'off' | 'hole' | 'silhouette';
  title: string;
}

export const SEE_THROUGH_MODES: readonly SeeThroughMode[] = [
  { key: 'off', title: 'opaque' },
  { key: 'hole', title: 'hole' },
  { key: 'silhouette', title: 'silhouette' },
];

export interface Density {
  key: 'grove' | 'forest' | 'dense' | 'gallery';
  title: string;
  count: number;
}

export const DENSITIES: readonly Density[] = [
  { key: 'grove', title: 'grove', count: GROVE.length },
  { key: 'forest', title: 'forest', count: 140 },
  { key: 'dense', title: 'dense', count: 340 },
  { key: 'gallery', title: 'gallery', count: 0 },
];

export const STAGES: readonly string[] = ['sapling', 'young', 'low', 'mid', 'high'];

const SPECIES: readonly string[] = ['oak', 'birch', 'chestnut', 'apple', 'willow', 'olive', 'pine', 'snowpine', 'spruce', 'cypress', 'acacia', 'baobab', 'palm', 'kapok', 'jungle', 'fig', 'snag'];

const GALLERY_PER_ROW = 6;
const GALLERY_STEP = 9;

export const galleryAround = (origin: Vec2, storey: string): SceneryTree[] =>
  SPECIES.map((art, index) => ({
    art,
    variant: 0,
    storey,
    x: origin.x + (index % GALLERY_PER_ROW - (GALLERY_PER_ROW - 1) / 2) * GALLERY_STEP,
    y: origin.y + 6 + Math.floor(index / GALLERY_PER_ROW) * GALLERY_STEP,
    flip: false,
    wind: 0.4,
  }));

const FOREST_RADIUS = 26;
const CLEARING = 2.5;
const SPACING = 2.3;
const ATTEMPTS = 40;
const VARIANTS = 2;

const MIX: readonly (readonly [string, number])[] = [['oak', 0.3], ['birch', 0.2], ['pine', 0.28], ['spruce', 0.22]];
const AGES: readonly (readonly [string, number])[] = [['low', 0.25], ['mid', 0.5], ['high', 0.25]];

const choose = (options: readonly (readonly [string, number])[], roll: number): string => {
  let rest = roll;
  for (const [name, share] of options) {
    rest -= share;
    if (rest < 0) return name;
  }
  return options[options.length - 1]![0];
};

const forests = new Map<string, SceneryTree[]>();

export function standAround(density: Density, origin: Vec2, storey = 'mid'): SceneryTree[] {
  if (density.key === 'grove') return groveAround(origin);
  if (density.key === 'gallery') return galleryAround(origin, storey);
  const key = `${density.key}:${origin.x}:${origin.y}`;
  const known = forests.get(key);
  if (known) return known;
  const random = seeded(density.count * 7919);
  const trees = groveAround(origin);
  while (trees.length < density.count) {
    let placed = false;
    for (let attempt = 0; attempt < ATTEMPTS && !placed; attempt += 1) {
      const angle = random() * Math.PI * 2;
      const reach = FOREST_RADIUS * Math.sqrt(random());
      const x = origin.x + Math.cos(angle) * reach;
      const y = origin.y + Math.sin(angle) * reach;
      if (Math.hypot(x - origin.x, y - origin.y) < CLEARING) continue;
      if (trees.some((tree) => Math.hypot(tree.x - x, tree.y - y) < SPACING)) continue;
      trees.push({ art: choose(MIX, random()), variant: Math.floor(random() * VARIANTS), storey: choose(AGES, random()), x, y, flip: random() < 0.5, wind: 0.4 });
      placed = true;
    }
    if (!placed) break;
  }
  forests.set(key, trees);
  return trees;
}
