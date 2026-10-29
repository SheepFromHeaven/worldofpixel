import { ItemType } from '../people/items.ts';
import { LAYOUT } from './layout.ts';

export const Kind = { Thing: 0, Happening: 1 } as const;

export type Kind = (typeof Kind)[keyof typeof Kind];

export interface Neuron {
  id: string;
  label: string;
  kind: Kind;
  item: ItemType;
  angle: number;
  ring: number;
}

export interface Sector {
  id: string;
  label: string;
  from: number;
  to: number;
}

export const SECTORS: readonly Sector[] = [
  { id: 'fire', label: 'fire', from: 300, to: 60 },
  { id: 'tools', label: 'tools', from: 60, to: 180 },
  { id: 'construction', label: 'construction', from: 180, to: 240 },
  { id: 'food', label: 'food', from: 240, to: 300 },
];

export const RING_RADII: readonly number[] = [0, 56, 108, 148, 180];

export const MAX_RING = RING_RADII.length - 1;

export const radiusOf = (ring: number): number => {
  const clamped = Math.min(MAX_RING, Math.max(0, ring));
  const low = Math.floor(clamped);
  const high = Math.min(MAX_RING, low + 1);
  return (RING_RADII[low] ?? 0) + ((RING_RADII[high] ?? 0) - (RING_RADII[low] ?? 0)) * (clamped - low);
};

export const ringOf = (radius: number): number => {
  for (let ring = 0; ring < MAX_RING; ring += 1) {
    const from = RING_RADII[ring]!;
    const to = RING_RADII[ring + 1]!;
    if (radius <= to) return ring + (radius - from) / (to - from);
  }
  return MAX_RING;
};

export const polar = (angle: number, ring: number): { x: number; y: number } => {
  const radius = radiusOf(ring);
  const radians = (angle * Math.PI) / 180;
  return { x: Math.sin(radians) * radius, y: -Math.cos(radians) * radius };
};

export const sectorAt = (angle: number): Sector => {
  const wrapped = ((angle % 360) + 360) % 360;
  return SECTORS.find((sector) => (sector.from < sector.to ? wrapped >= sector.from && wrapped < sector.to : wrapped >= sector.from || wrapped < sector.to)) ?? SECTORS[0]!;
};

const BASE: readonly Neuron[] = [
  { id: 'flint', label: 'flint', kind: Kind.Thing, item: ItemType.Flint, angle: 60, ring: 1 },
  { id: 'stone', label: 'stone', kind: Kind.Thing, item: ItemType.Stone, angle: 115, ring: 1 },
  { id: 'kindling', label: 'kindling', kind: Kind.Thing, item: ItemType.DryKindling, angle: 315, ring: 1 },
  { id: 'branch', label: 'branch', kind: Kind.Thing, item: ItemType.Branch, angle: 5, ring: 1 },
  { id: 'spark', label: 'spark', kind: Kind.Happening, item: ItemType.None, angle: 35, ring: 2 },
  { id: 'dull', label: 'dull spark', kind: Kind.Happening, item: ItemType.None, angle: 165, ring: 2 },
  { id: 'ember', label: 'ember', kind: Kind.Happening, item: ItemType.None, angle: 10, ring: 3 },
  { id: 'smoke', label: 'smoke', kind: Kind.Happening, item: ItemType.None, angle: 52, ring: 3 },
  { id: 'flame', label: 'flame', kind: Kind.Happening, item: ItemType.None, angle: 355, ring: 4 },
  { id: 'sharp', label: 'sharp edge', kind: Kind.Happening, item: ItemType.None, angle: 88, ring: 2 },
  { id: 'fibre', label: 'plant fibre', kind: Kind.Thing, item: ItemType.PlantFibre, angle: 150, ring: 1 },
  { id: 'binding', label: 'binding', kind: Kind.Happening, item: ItemType.None, angle: 135, ring: 2 },
  { id: 'tool', label: 'stone tool', kind: Kind.Happening, item: ItemType.None, angle: 105, ring: 3 },
  { id: 'berries', label: 'berries', kind: Kind.Thing, item: ItemType.Berries, angle: 245, ring: 1 },
  { id: 'grubs', label: 'grubs', kind: Kind.Thing, item: ItemType.Grubs, angle: 270, ring: 1.7 },
  { id: 'egg', label: 'egg', kind: Kind.Thing, item: ItemType.Egg, angle: 292, ring: 1 },
  { id: 'cord', label: 'cord', kind: Kind.Thing, item: ItemType.Cord, angle: 195, ring: 2 },
  { id: 'basket', label: 'basket', kind: Kind.Thing, item: ItemType.Basket, angle: 220, ring: 3 },
  { id: 'cooked', label: 'cooked', kind: Kind.Thing, item: ItemType.Roast, angle: 300, ring: 4 },
  { id: 'fish', label: 'fish', kind: Kind.Thing, item: ItemType.Fish, angle: 266, ring: 2.8 },
  { id: 'rabbit', label: 'rabbit', kind: Kind.Thing, item: ItemType.Rabbit, angle: 284, ring: 2.8 },
  { id: 'spear', label: 'spear', kind: Kind.Happening, item: ItemType.None, angle: 80, ring: 3.6 },
  { id: 'snare', label: 'snare', kind: Kind.Happening, item: ItemType.None, angle: 258, ring: 4 },
  { id: 'frame', label: 'frame', kind: Kind.Happening, item: ItemType.None, angle: 236, ring: 2 },
  { id: 'bed', label: 'bed', kind: Kind.Happening, item: ItemType.None, angle: 190, ring: 3.6 },
  { id: 'shelter', label: 'shelter', kind: Kind.Happening, item: ItemType.None, angle: 228, ring: 3 },
  { id: 'hut', label: 'hut', kind: Kind.Happening, item: ItemType.None, angle: 236, ring: 4 },
];

export const NEURONS: readonly Neuron[] = BASE.map((neuron) => ({ ...neuron, ...(LAYOUT[neuron.id] ?? {}) }));

export type NeuronId = (typeof NEURONS)[number]['id'];

export const NEURON_COUNT = NEURONS.length;

export const neuronIndex = (id: string): number => NEURONS.findIndex((neuron) => neuron.id === id);

export const neuronOf = (index: number): Neuron => NEURONS[index]!;

export const Outcome = { Success: 0, Weak: 1, Scar: 2 } as const;

export type Outcome = (typeof Outcome)[keyof typeof Outcome];

export interface Recipe {
  a: string;
  b: string;
  result: string;
  outcome: Outcome;
  spend: readonly ItemType[];
  make: readonly ItemType[];
  title: string;
  words: string;
  order?: string;
  station?: 'floor';
}

export const RECIPES: readonly Recipe[] = [
  { a: 'flint', b: 'flint', result: 'spark', outcome: Outcome.Success, spend: [], make: [], title: 'Spark', words: 'Flint struck on flint throws a bright spark.' },
  {
    a: 'spark',
    b: 'kindling',
    result: 'ember',
    outcome: Outcome.Success,
    spend: [ItemType.DryKindling],
    make: [],
    title: 'Ember',
    words: 'A spark that lands in dry kindling smoulders.',
  },
  {
    a: 'ember',
    b: 'branch',
    result: 'flame',
    outcome: Outcome.Success,
    spend: [ItemType.Branch],
    make: [ItemType.BurningBranch],
    title: 'Fire',
    words: 'A branch laid to an ember catches, and a flame can be carried.',
  },
  { a: 'flint', b: 'stone', result: 'sharp', outcome: Outcome.Success, spend: [], make: [], title: 'Sharp edge', words: 'A stone knocked on flint takes an edge.' },
  {
    a: 'branch',
    b: 'fibre',
    result: 'binding',
    outcome: Outcome.Success,
    spend: [ItemType.Branch, ItemType.PlantFibre],
    make: [],
    title: 'Binding',
    words: 'Fibre wound round a stick holds a thing fast.',
  },
  {
    a: 'sharp',
    b: 'binding',
    result: 'tool',
    outcome: Outcome.Success,
    spend: [ItemType.Flint],
    make: [ItemType.HandAxe],
    title: 'Stone tool',
    order: 'Knap Hand Axe',
    station: 'floor',
    words: 'An edge bound to a handle is a tool, and a place to work it is a knapping floor.',
  },
  {
    a: 'fibre',
    b: 'fibre',
    result: 'cord',
    outcome: Outcome.Success,
    spend: [ItemType.PlantFibre, ItemType.PlantFibre],
    make: [ItemType.Cord],
    title: 'Cord',
    order: 'Twist Cord',
    words: 'Fibres twisted together make a cord that holds.',
  },
  {
    a: 'cord',
    b: 'fibre',
    result: 'basket',
    outcome: Outcome.Success,
    spend: [ItemType.PlantFibre, ItemType.Cord],
    make: [ItemType.Basket],
    title: 'Basket',
    order: 'Weave Basket',
    words: 'Cord and fibre woven round make something to carry a lot in.',
  },
  {
    a: 'flame',
    b: 'egg',
    result: 'cooked',
    outcome: Outcome.Success,
    spend: [ItemType.Egg],
    make: [ItemType.Roast],
    title: 'Cooked food',
    words: 'An egg held to the flame is better for it.',
  },
  { a: 'branch', b: 'branch', result: 'frame', outcome: Outcome.Success, spend: [], make: [], title: 'Frame', words: 'Two sticks leaned together stand up on their own.' },
  { a: 'frame', b: 'fibre', result: 'bed', outcome: Outcome.Success, spend: [], make: [], title: 'Bed', words: 'Fibre laid over a frame is softer than the ground, and off it.' },
  { a: 'frame', b: 'cord', result: 'shelter', outcome: Outcome.Success, spend: [], make: [], title: 'Shelter', words: 'A frame lashed with cord keeps its shape against the wind.' },
  { a: 'shelter', b: 'fibre', result: 'hut', outcome: Outcome.Success, spend: [], make: [], title: 'Hut', words: 'Fibre thatched over a shelter turns the weather away.' },
  { a: 'sharp', b: 'branch', result: 'spear', outcome: Outcome.Success, spend: [], make: [], title: 'Spear', words: 'A stick with an edge on it reaches farther than a hand.' },
  { a: 'cord', b: 'branch', result: 'snare', outcome: Outcome.Success, spend: [], make: [], title: 'Snare', words: 'A loop of cord on a bent stick holds what walks into it.' },
  { a: 'stone', b: 'stone', result: 'dull', outcome: Outcome.Weak, spend: [], make: [], title: 'Dull spark', words: 'Stone on stone only gives a dull spark. Something harder is close.' },
  { a: 'spark', b: 'branch', result: 'smoke', outcome: Outcome.Weak, spend: [], make: [], title: 'Smoke', words: 'A spark on a green branch only smokes. It wants something finer.' },
];

export const GOALS: readonly string[] = ['flame', 'tool', 'bed', 'hut', 'spear', 'snare'];

const pairKey = (a: number, b: number): string => (a <= b ? `${a}:${b}` : `${b}:${a}`);

const BY_PAIR = new Map<string, Recipe>(RECIPES.map((recipe) => [pairKey(neuronIndex(recipe.a), neuronIndex(recipe.b)), recipe]));

export const recipeFor = (a: number, b: number): Recipe | null => BY_PAIR.get(pairKey(a, b)) ?? null;

export const recipeMaking = (result: number): Recipe | null => RECIPES.find((recipe) => neuronIndex(recipe.result) === result) ?? null;

export type Tally = Map<ItemType, number>;

export interface Chain {
  needs: Tally;
  spend: Tally;
  make: ItemType[];
}

const add = (into: Tally, kind: ItemType, count: number): void => {
  into.set(kind, (into.get(kind) ?? 0) + count);
};

function leaves(neuron: number, chain: Chain, depth = 0): void {
  const { item } = neuronOf(neuron);
  if (item !== ItemType.None) {
    add(chain.needs, item, 1);
    return;
  }
  const recipe = depth > 8 ? null : recipeMaking(neuron);
  if (!recipe) return;
  for (const part of [recipe.a, recipe.b]) leaves(neuronIndex(part), chain, depth + 1);
  for (const kind of recipe.spend) add(chain.spend, kind, 1);
  chain.make.push(...recipe.make);
}

export function chainOf(a: number, b: number, final: Recipe | null): Chain {
  const chain: Chain = { needs: new Map(), spend: new Map(), make: [] };
  leaves(a, chain);
  leaves(b, chain);
  if (final) {
    for (const kind of final.spend) add(chain.spend, kind, 1);
    chain.make.push(...final.make);
  }
  for (const [kind, count] of chain.spend) {
    for (let used = 0; used < count; used += 1) {
      const at = chain.make.indexOf(kind);
      if (at < 0) break;
      chain.make.splice(at, 1);
      chain.spend.set(kind, (chain.spend.get(kind) ?? 0) - 1);
    }
  }
  const reused = new Map<ItemType, number>();
  for (const [kind, count] of chain.needs) {
    const wanted = Math.max(count, chain.spend.get(kind) ?? 0);
    reused.set(kind, wanted);
  }
  chain.needs = reused;
  return chain;
}
