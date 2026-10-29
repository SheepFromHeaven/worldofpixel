export type Layer = 'canopy' | 'under' | 'ground';

export type Habit = 'broadleaf' | 'conifer' | 'palm' | 'shrub' | 'vine' | 'fern' | 'succulent' | 'bamboo' | 'grass' | 'moss' | 'snag';

export type Leaf = 'evergreen' | 'deciduous' | 'dry';

export type Dispersal = 'gravity' | 'wind' | 'animal' | 'water';

export type Range = readonly [number, number, number, number];

export interface Fruit {
  readonly name: string;
  readonly from: number;
  readonly to: number;
  readonly kcal: number;
}

export interface Species {
  readonly key: string;
  readonly name: string;
  readonly layer: Layer;
  readonly habit: Habit;
  readonly leaf: Leaf;
  readonly art: string;
  readonly snowArt: string | null;
  readonly temperature: Range;
  readonly rain: Range;
  readonly altitude: Range;
  readonly salt: Range;
  readonly damp: Range;
  readonly shade: number;
  readonly thirst: number;
  readonly height: number;
  readonly seedling: number;
  readonly yearsTo90: number;
  readonly lifespan: number;
  readonly matureAge: number;
  readonly crown: number;
  readonly recruits: number;
  readonly dispersal: Dispersal;
  readonly reach: number;
  readonly wood: number;
  readonly fruit: Fruit | null;
}

const ANY: Range = [0, 0, 1, 1];

const INLAND: Range = [0, 0, 0.3, 0.7];

interface Draft {
  key: string;
  name: string;
  layer: Layer;
  habit: Habit;
  leaf?: Leaf;
  art?: string;
  snowArt?: string;
  temperature: Range;
  rain: Range;
  altitude?: number;
  salt?: Range;
  damp?: Range;
  shade: number;
  thirst?: number;
  height: number;
  seedling?: number;
  yearsTo90: number;
  lifespan: number;
  matureAge: number;
  crown: number;
  recruits: number;
  dispersal: Dispersal;
  reach: number;
  wood?: number;
  fruit?: Fruit;
}

const HABIT_WOOD: Readonly<Record<Habit, number>> = { broadleaf: 1, conifer: 0.85, palm: 0.6, shrub: 0.4, vine: 0.2, fern: 0.3, succulent: 0.1, bamboo: 0.6, grass: 0, moss: 0, snag: 0.5 };

const WOOD_BY_KEY: Readonly<Record<string, number>> = { oak: 1.3, chestnut: 1.2, olive: 1.2, mahogany: 1.3, apple: 0.95, birch: 0.85, willow: 0.55, baobab: 0.5, kapok: 0.5, acacia: 0.8, fig: 0.9, pine: 0.9, spruce: 0.75, fir: 0.7, cypress: 1 };

const make = (draft: Draft): Species => ({
  key: draft.key,
  name: draft.name,
  layer: draft.layer,
  habit: draft.habit,
  leaf: draft.leaf ?? 'evergreen',
  art: draft.art ?? draft.key,
  snowArt: draft.snowArt ?? null,
  temperature: draft.temperature,
  rain: draft.rain,
  altitude: [0, 0, (draft.altitude ?? 0.6) * 0.7, draft.altitude ?? 0.6],
  salt: draft.salt ?? INLAND,
  damp: draft.damp ?? ANY,
  shade: draft.shade,
  thirst: draft.thirst ?? 0.5,
  height: draft.height,
  seedling: draft.seedling ?? Math.min(0.2, draft.height * 0.05),
  yearsTo90: draft.yearsTo90,
  lifespan: draft.lifespan,
  matureAge: draft.matureAge,
  crown: draft.crown,
  recruits: draft.recruits,
  dispersal: draft.dispersal,
  reach: draft.reach,
  wood: draft.wood ?? WOOD_BY_KEY[draft.key] ?? HABIT_WOOD[draft.habit],
  fruit: draft.fruit ?? null,
});

const fruit = (name: string, from: number, to: number, kcal: number): Fruit => ({ name, from, to, kcal });

export const SPECIES: readonly Species[] = [
  make({ key: 'oak', name: 'oak', layer: 'canopy', habit: 'broadleaf', leaf: 'deciduous', temperature: [3, 8, 18, 24], rain: [5.5, 9, 22, 60], altitude: 0.55, shade: 0.55, thirst: 0.6, height: 28, seedling: 0.2, yearsTo90: 120, lifespan: 350, matureAge: 40, crown: 0.8, recruits: 0.6, dispersal: 'animal', reach: 18, fruit: fruit('acorns', 0.55, 0.75, 2500) }),
  make({ key: 'birch', name: 'birch', layer: 'canopy', habit: 'broadleaf', leaf: 'deciduous', temperature: [-6, 0, 12, 18], rain: [5, 7, 18, 40], altitude: 0.7, shade: 0.15, thirst: 0.45, height: 20, seedling: 0.1, yearsTo90: 40, lifespan: 90, matureAge: 12, crown: 0.45, recruits: 5, dispersal: 'wind', reach: 30 }),
  make({ key: 'chestnut', name: 'sweet chestnut', layer: 'canopy', habit: 'broadleaf', leaf: 'deciduous', temperature: [8, 12, 20, 25], rain: [8, 12, 26, 60], altitude: 0.5, shade: 0.5, thirst: 0.6, height: 28, seedling: 0.2, yearsTo90: 100, lifespan: 400, matureAge: 30, crown: 0.85, recruits: 0.5, dispersal: 'animal', reach: 12, fruit: fruit('chestnuts', 0.58, 0.78, 7000) }),
  make({ key: 'apple', name: 'wild apple', layer: 'canopy', habit: 'broadleaf', leaf: 'deciduous', temperature: [4, 8, 16, 22], rain: [7, 10, 22, 40], altitude: 0.5, shade: 0.3, thirst: 0.5, height: 9, seedling: 0.15, yearsTo90: 30, lifespan: 100, matureAge: 8, crown: 0.6, recruits: 1.2, dispersal: 'animal', reach: 25, fruit: fruit('apples', 0.5, 0.7, 1800) }),
  make({ key: 'willow', name: 'willow', layer: 'canopy', habit: 'broadleaf', leaf: 'deciduous', temperature: [3, 9, 22, 28], rain: [8, 14, 60, 200], altitude: 0.35, damp: [0.45, 0.8, 1, 1], shade: 0.3, thirst: 1, height: 14, seedling: 0.1, yearsTo90: 25, lifespan: 80, matureAge: 8, crown: 0.55, recruits: 4, dispersal: 'water', reach: 20 }),
  make({ key: 'pine', name: 'pine', layer: 'canopy', habit: 'conifer', snowArt: 'snowpine', temperature: [-4, 2, 14, 22], rain: [4.5, 6, 16, 35], altitude: 0.75, shade: 0.2, thirst: 0.35, height: 30, seedling: 0.1, yearsTo90: 90, lifespan: 300, matureAge: 25, crown: 0.6, recruits: 2.5, dispersal: 'wind', reach: 25 }),
  make({ key: 'spruce', name: 'spruce', layer: 'canopy', habit: 'conifer', snowArt: 'snowpine', temperature: [-8, -1, 8, 14], rain: [6, 8, 25, 60], altitude: 0.8, shade: 0.6, thirst: 0.5, height: 35, seedling: 0.1, yearsTo90: 120, lifespan: 400, matureAge: 30, crown: 0.95, recruits: 2, dispersal: 'wind', reach: 20 }),
  make({ key: 'fir', name: 'mountain fir', layer: 'canopy', habit: 'conifer', art: 'pine', snowArt: 'snowpine', temperature: [-12, -6, 4, 10], rain: [4, 5, 25, 60], altitude: 0.9, shade: 0.4, thirst: 0.3, height: 22, seedling: 0.1, yearsTo90: 150, lifespan: 500, matureAge: 40, crown: 0.8, recruits: 1.5, dispersal: 'wind', reach: 15 }),
  make({ key: 'cypress', name: 'cypress', layer: 'canopy', habit: 'conifer', temperature: [8, 12, 22, 28], rain: [4.5, 5.5, 12, 25], altitude: 0.5, shade: 0.3, thirst: 0.25, height: 25, seedling: 0.1, yearsTo90: 70, lifespan: 500, matureAge: 20, crown: 0.7, recruits: 1, dispersal: 'wind', reach: 15 }),
  make({ key: 'olive', name: 'olive', layer: 'canopy', habit: 'broadleaf', temperature: [10, 14, 24, 30], rain: [4.5, 5.5, 13, 24], altitude: 0.4, shade: 0.25, thirst: 0.2, height: 9, seedling: 0.15, yearsTo90: 60, lifespan: 1000, matureAge: 12, crown: 0.5, recruits: 0.4, dispersal: 'animal', reach: 20, fruit: fruit('olives', 0.62, 0.85, 1500) }),
  make({ key: 'acacia', name: 'acacia', layer: 'canopy', habit: 'broadleaf', leaf: 'dry', temperature: [16, 21, 28, 32], rain: [4, 5, 14, 24], altitude: 0.4, shade: 0.1, thirst: 0.2, height: 12, seedling: 0.1, yearsTo90: 40, lifespan: 120, matureAge: 10, crown: 0.35, recruits: 1.5, dispersal: 'animal', reach: 25, fruit: fruit('pods', 0.3, 0.6, 800) }),
  make({ key: 'baobab', name: 'baobab', layer: 'canopy', habit: 'broadleaf', leaf: 'dry', temperature: [20, 24, 30, 34], rain: [4.5, 6, 12, 20], altitude: 0.3, shade: 0.2, thirst: 0.15, height: 20, seedling: 0.15, yearsTo90: 300, lifespan: 1500, matureAge: 150, crown: 0.3, recruits: 0.3, dispersal: 'animal', reach: 40, fruit: fruit('baobab fruit', 0.1, 0.4, 4000) }),
  make({ key: 'coconut', name: 'coconut palm', layer: 'canopy', habit: 'palm', art: 'palm', temperature: [22, 25, 30, 34], rain: [6, 9, 40, 200], altitude: 0.12, salt: [0.2, 0.45, 1, 1], shade: 0.25, thirst: 0.5, height: 25, seedling: 0.3, yearsTo90: 35, lifespan: 80, matureAge: 7, crown: 0.35, recruits: 0.6, dispersal: 'water', reach: 30, fruit: fruit('coconuts', 0, 1, 4000) }),
  make({ key: 'date', name: 'date palm', layer: 'canopy', habit: 'palm', art: 'palm', temperature: [18, 23, 32, 36], rain: [4, 4.5, 8, 16], altitude: 0.3, damp: [0.4, 0.75, 1, 1], salt: [0, 0, 0.5, 0.9], shade: 0.2, thirst: 0.6, height: 20, seedling: 0.3, yearsTo90: 40, lifespan: 150, matureAge: 8, crown: 0.3, recruits: 0.5, dispersal: 'animal', reach: 15, fruit: fruit('dates', 0.4, 0.62, 6000) }),
  make({ key: 'kapok', name: 'kapok', layer: 'canopy', habit: 'broadleaf', temperature: [21, 24, 30, 34], rain: [18, 26, 200, 300], altitude: 0.3, shade: 0.15, thirst: 1, height: 55, seedling: 0.2, yearsTo90: 80, lifespan: 400, matureAge: 40, crown: 0.9, recruits: 1.5, dispersal: 'wind', reach: 40 }),
  make({ key: 'mahogany', name: 'rainforest tree', layer: 'canopy', habit: 'broadleaf', art: 'jungle', temperature: [20, 23, 30, 34], rain: [14, 20, 200, 300], altitude: 0.45, shade: 0.5, thirst: 0.9, height: 35, seedling: 0.2, yearsTo90: 70, lifespan: 300, matureAge: 30, crown: 0.95, recruits: 1, dispersal: 'animal', reach: 20 }),
  make({ key: 'fig', name: 'wild fig', layer: 'canopy', habit: 'broadleaf', temperature: [18, 22, 30, 34], rain: [10, 16, 200, 300], altitude: 0.35, shade: 0.6, thirst: 0.8, height: 25, seedling: 0.1, yearsTo90: 50, lifespan: 200, matureAge: 15, crown: 0.8, recruits: 2, dispersal: 'animal', reach: 40, fruit: fruit('figs', 0.3, 0.9, 2500) }),

  make({ key: 'shrub', name: 'hawthorn', layer: 'under', habit: 'shrub', leaf: 'deciduous', art: 'shrub', temperature: [2, 8, 18, 26], rain: [5, 8, 22, 60], altitude: 0.6, shade: 0.6, thirst: 0.4, height: 3, seedling: 0.08, yearsTo90: 12, lifespan: 40, matureAge: 4, crown: 0.6, recruits: 3, dispersal: 'animal', reach: 15 }),
  make({ key: 'bramble', name: 'bramble', layer: 'under', habit: 'shrub', leaf: 'deciduous', art: 'berry', temperature: [4, 9, 18, 26], rain: [6, 9, 24, 60], altitude: 0.5, shade: 0.5, thirst: 0.5, height: 2, seedling: 0.05, yearsTo90: 5, lifespan: 12, matureAge: 2, crown: 0.55, recruits: 4, dispersal: 'animal', reach: 20, fruit: fruit('blackberries', 0.38, 0.6, 400) }),
  make({ key: 'hazel', name: 'hazel', layer: 'under', habit: 'shrub', leaf: 'deciduous', art: 'shrub', temperature: [3, 8, 16, 22], rain: [7, 10, 22, 50], altitude: 0.5, shade: 0.55, thirst: 0.5, height: 6, seedling: 0.1, yearsTo90: 20, lifespan: 80, matureAge: 7, crown: 0.6, recruits: 1.5, dispersal: 'animal', reach: 12, fruit: fruit('hazelnuts', 0.5, 0.68, 1500) }),
  make({ key: 'thornbush', name: 'thorn scrub', layer: 'under', habit: 'shrub', leaf: 'dry', art: 'thorn', temperature: [14, 20, 30, 36], rain: [4, 4.5, 10, 18], altitude: 0.4, shade: 0.1, thirst: 0.15, height: 3, seedling: 0.06, yearsTo90: 15, lifespan: 50, matureAge: 5, crown: 0.3, recruits: 3, dispersal: 'animal', reach: 15 }),
  make({ key: 'maquis', name: 'maquis scrub', layer: 'under', habit: 'shrub', art: 'maquis', temperature: [8, 13, 22, 28], rain: [4.5, 5.5, 12, 24], altitude: 0.5, shade: 0.3, thirst: 0.2, height: 2.5, seedling: 0.05, yearsTo90: 12, lifespan: 60, matureAge: 5, crown: 0.45, recruits: 3, dispersal: 'animal', reach: 10 }),
  make({ key: 'heather', name: 'heather', layer: 'under', habit: 'shrub', art: 'heather', temperature: [-4, 2, 12, 18], rain: [5, 7, 22, 50], altitude: 0.85, shade: 0.1, thirst: 0.3, height: 0.6, seedling: 0.03, yearsTo90: 8, lifespan: 30, matureAge: 3, crown: 0.35, recruits: 5, dispersal: 'wind', reach: 10 }),
  make({ key: 'crowberry', name: 'dwarf shrub', layer: 'under', habit: 'shrub', art: 'tundrashrub', temperature: [-14, -8, 2, 8], rain: [4, 5, 20, 60], altitude: 0.9, shade: 0.1, thirst: 0.3, height: 0.5, seedling: 0.03, yearsTo90: 15, lifespan: 80, matureAge: 5, crown: 0.3, recruits: 2, dispersal: 'animal', reach: 15, fruit: fruit('crowberries', 0.4, 0.6, 200) }),
  make({ key: 'juniper', name: 'juniper', layer: 'under', habit: 'shrub', art: 'juniper', temperature: [-8, 0, 14, 22], rain: [4, 5, 12, 24], altitude: 0.7, shade: 0.2, thirst: 0.25, height: 3, seedling: 0.05, yearsTo90: 40, lifespan: 200, matureAge: 10, crown: 0.5, recruits: 1.5, dispersal: 'animal', reach: 20, fruit: fruit('juniper berries', 0.5, 0.9, 150) }),
  make({ key: 'seabuck', name: 'sea buckthorn', layer: 'under', habit: 'shrub', art: 'thorn', temperature: [4, 8, 18, 26], rain: [4, 5, 14, 30], altitude: 0.2, salt: [0.3, 0.5, 1, 1], shade: 0.15, thirst: 0.3, height: 3, seedling: 0.05, yearsTo90: 10, lifespan: 40, matureAge: 4, crown: 0.4, recruits: 3, dispersal: 'animal', reach: 20, fruit: fruit('sea buckthorn berries', 0.55, 0.8, 300) }),
  make({ key: 'saltbush', name: 'saltbush', layer: 'under', habit: 'shrub', art: 'maquis', temperature: [6, 12, 34, 40], rain: [4, 4, 6, 10], altitude: 0.4, shade: 0, thirst: 0.1, height: 2, seedling: 0.04, yearsTo90: 8, lifespan: 40, matureAge: 3, crown: 0.25, recruits: 3, dispersal: 'wind', reach: 15 }),
  make({ key: 'sage', name: 'sagebrush', layer: 'under', habit: 'shrub', art: 'maquis', temperature: [0, 5, 16, 24], rain: [4, 4.5, 7, 12], altitude: 0.6, shade: 0.05, thirst: 0.15, height: 1.5, seedling: 0.04, yearsTo90: 15, lifespan: 80, matureAge: 4, crown: 0.3, recruits: 3, dispersal: 'wind', reach: 12 }),
  make({ key: 'treefern', name: 'tree fern', layer: 'under', habit: 'fern', art: 'treefern', temperature: [18, 22, 30, 34], rain: [14, 22, 200, 300], altitude: 0.4, shade: 0.8, thirst: 0.9, height: 8, seedling: 0.1, yearsTo90: 30, lifespan: 150, matureAge: 10, crown: 0.5, recruits: 3, dispersal: 'wind', reach: 25 }),
  make({ key: 'banana', name: 'wild banana', layer: 'under', habit: 'shrub', art: 'banana', temperature: [20, 24, 30, 34], rain: [12, 18, 200, 300], altitude: 0.3, shade: 0.6, thirst: 0.9, height: 6, seedling: 0.2, yearsTo90: 4, lifespan: 25, matureAge: 2, crown: 0.6, recruits: 3, dispersal: 'gravity', reach: 2, fruit: fruit('bananas', 0.05, 0.95, 3000) }),
  make({ key: 'grapevine', name: 'grapevine', layer: 'under', habit: 'vine', leaf: 'deciduous', art: 'grapevine', temperature: [8, 12, 24, 30], rain: [5, 6.5, 16, 30], altitude: 0.45, shade: 0.4, thirst: 0.35, height: 4, seedling: 0.1, yearsTo90: 8, lifespan: 60, matureAge: 3, crown: 0.55, recruits: 2, dispersal: 'animal', reach: 25, fruit: fruit('grapes', 0.5, 0.68, 1200) }),
  make({ key: 'liana', name: 'liana', layer: 'under', habit: 'vine', art: 'liana', temperature: [20, 24, 30, 34], rain: [14, 20, 200, 300], altitude: 0.35, shade: 0.5, thirst: 0.8, height: 12, seedling: 0.1, yearsTo90: 12, lifespan: 40, matureAge: 3, crown: 0.6, recruits: 3, dispersal: 'wind', reach: 20, fruit: fruit('jungle fruit', 0.3, 0.7, 500) }),
  make({ key: 'bamboo', name: 'bamboo', layer: 'under', habit: 'bamboo', art: 'bamboo', temperature: [10, 16, 28, 34], rain: [10, 16, 60, 200], altitude: 0.5, shade: 0.5, thirst: 0.8, height: 12, seedling: 0.15, yearsTo90: 5, lifespan: 60, matureAge: 20, crown: 0.7, recruits: 4, dispersal: 'gravity', reach: 2 }),
  make({ key: 'cactus', name: 'prickly pear', layer: 'under', habit: 'succulent', art: 'cactus', temperature: [10, 16, 32, 40], rain: [4, 4, 7, 12], altitude: 0.4, shade: 0.05, thirst: 0.05, height: 4, seedling: 0.05, yearsTo90: 60, lifespan: 150, matureAge: 15, crown: 0.1, recruits: 0.6, dispersal: 'animal', reach: 15, fruit: fruit('prickly pears', 0.3, 0.55, 800) }),
  make({ key: 'fern', name: 'fern', layer: 'under', habit: 'fern', art: 'fern', temperature: [2, 8, 20, 28], rain: [8, 12, 40, 200], altitude: 0.6, shade: 0.95, thirst: 0.7, height: 1, seedling: 0.05, yearsTo90: 5, lifespan: 30, matureAge: 3, crown: 0.5, recruits: 5, dispersal: 'wind', reach: 15 }),

  make({ key: 'meadow', name: 'meadow grass', layer: 'ground', habit: 'grass', leaf: 'deciduous', art: 'grass', temperature: [3, 8, 20, 28], rain: [5, 8, 25, 80], altitude: 0.7, shade: 0.5, thirst: 0.4, height: 0.5, yearsTo90: 1, lifespan: 5, matureAge: 1, crown: 0.2, recruits: 4, dispersal: 'wind', reach: 2 }),
  make({ key: 'savanna', name: 'savanna grass', layer: 'ground', habit: 'grass', leaf: 'dry', art: 'savannagrass', temperature: [16, 21, 30, 36], rain: [4.5, 6, 14, 24], altitude: 0.4, shade: 0.1, thirst: 0.25, height: 1.5, yearsTo90: 1, lifespan: 5, matureAge: 1, crown: 0.2, recruits: 4, dispersal: 'wind', reach: 2 }),
  make({ key: 'steppe', name: 'steppe grass', layer: 'ground', habit: 'grass', leaf: 'dry', art: 'steppegrass', temperature: [-2, 4, 16, 24], rain: [4, 4.5, 8, 14], altitude: 0.7, shade: 0.2, thirst: 0.15, height: 0.4, yearsTo90: 1, lifespan: 5, matureAge: 1, crown: 0.15, recruits: 4, dispersal: 'wind', reach: 2 }),
  make({ key: 'tussock', name: 'tundra sedge', layer: 'ground', habit: 'grass', art: 'tussock', temperature: [-15, -6, 4, 10], rain: [4, 5, 30, 100], altitude: 1, shade: 0.3, thirst: 0.3, height: 0.3, yearsTo90: 2, lifespan: 10, matureAge: 2, crown: 0.2, recruits: 3, dispersal: 'wind', reach: 2 }),
  make({ key: 'dunegrass', name: 'dune grass', layer: 'ground', habit: 'grass', art: 'dunegrass', temperature: [0, 8, 28, 36], rain: [4, 4, 12, 30], altitude: 0.15, salt: [0.35, 0.6, 1, 1], shade: 0.1, thirst: 0.1, height: 0.8, yearsTo90: 1, lifespan: 8, matureAge: 1, crown: 0.15, recruits: 4, dispersal: 'wind', reach: 2 }),
  make({ key: 'moss', name: 'moss', layer: 'ground', habit: 'moss', art: 'moss', temperature: [-15, -3, 12, 20], rain: [8, 14, 200, 300], altitude: 1, shade: 1, thirst: 0.6, height: 0.05, yearsTo90: 1, lifespan: 10, matureAge: 1, crown: 0.05, recruits: 3, dispersal: 'wind', reach: 2 }),
  make({ key: 'jungle', name: 'jungle floor', layer: 'ground', habit: 'fern', art: 'junglefloor', temperature: [20, 24, 30, 34], rain: [14, 20, 200, 300], altitude: 0.5, shade: 1, thirst: 0.9, height: 0.6, yearsTo90: 1, lifespan: 5, matureAge: 1, crown: 0.3, recruits: 4, dispersal: 'wind', reach: 2 }),
  make({ key: 'scrubgrass', name: 'desert grass', layer: 'ground', habit: 'grass', leaf: 'dry', art: 'desertgrass', temperature: [10, 15, 34, 40], rain: [4, 4, 5.5, 9], altitude: 0.4, shade: 0.05, thirst: 0.05, height: 0.4, yearsTo90: 1, lifespan: 4, matureAge: 1, crown: 0.1, recruits: 3, dispersal: 'wind', reach: 2 }),
  make({ key: 'woodland', name: 'woodland herbs', layer: 'ground', habit: 'grass', leaf: 'deciduous', art: 'woodland', temperature: [6, 9, 20, 26], rain: [8, 12, 40, 200], altitude: 0.6, shade: 0.9, thirst: 0.6, height: 0.4, yearsTo90: 1, lifespan: 6, matureAge: 1, crown: 0.3, recruits: 4, dispersal: 'animal', reach: 3 }),
  make({ key: 'sedge', name: 'marsh sedge', layer: 'ground', habit: 'grass', art: 'sedge', temperature: [0, 8, 26, 32], rain: [8, 12, 200, 300], altitude: 0.3, damp: [0.55, 0.85, 1, 1], shade: 0.4, thirst: 1, height: 0.8, yearsTo90: 1, lifespan: 8, matureAge: 1, crown: 0.25, recruits: 4, dispersal: 'water', reach: 3 }),

  make({ key: 'snag', name: 'dead tree', layer: 'canopy', habit: 'snag', art: 'snag', temperature: [-30, -30, 50, 50], rain: [0, 0, 400, 400], altitude: 1, shade: 0, thirst: 0, height: 20, seedling: 0.2, yearsTo90: 1000, lifespan: 12, matureAge: 1000, crown: 0.05, recruits: 0, dispersal: 'gravity', reach: 1 }),
];

export const NONE = 0;

export const speciesOf = (id: number): Species | undefined => SPECIES[id - 1];

export const idOf = (key: string): number => SPECIES.findIndex((species) => species.key === key) + 1;

export const SPECIES_COUNT = SPECIES.length;

export const SNAG = idOf('snag');

export const IDS_BY_LAYER: Record<Layer, number[]> = { canopy: [], under: [], ground: [] };

SPECIES.forEach((species, index) => {
  if (species.key !== 'snag') IDS_BY_LAYER[species.layer].push(index + 1);
});
