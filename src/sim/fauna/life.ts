import { AMPHIBIANS } from '../amphibians/species.ts';
import { BIRDS } from '../birds/species.ts';
import { MAMMALS } from '../mammals/species.ts';
import { MARGIN_TILES, WORLD_TILES } from '../grid.ts';
import type { Range } from '../plants/species.ts';
import { INSECTS, Motion } from '../insects/species.ts';
import { REPTILES, Realm } from '../reptiles/species.ts';

export const Taxon = { Insect: 1, Amphibian: 2, Reptile: 4, Fish: 8, Bird: 32, Mammal: 64 } as const;

export const Stage = { Egg: 0, Hatchling: 1, Juvenile: 2, Adult: 3 } as const;

export type Stage = (typeof Stage)[keyof typeof Stage];

export const STAGES = 4;

export const STAGE_NAMES: readonly string[] = ['egg', 'hatchling', 'juvenile', 'adult'];

export const Medium = { Land: 1, Fresh: 2, Sea: 4 } as const;

export type Group = 'insect' | 'amphibian' | 'reptile' | 'bird' | 'mammal';

export type Weights = readonly [number, number, number, number];

export const FAUNA_YEAR_DAYS = 1;

export const PATCH_TILES = 16;

export const PATCH_AREA = PATCH_TILES * PATCH_TILES;

export const FAUNA_COLUMNS = Math.ceil((WORLD_TILES.columns + 2 * MARGIN_TILES) / PATCH_TILES);

export const FAUNA_ROWS = Math.ceil((WORLD_TILES.rows + 2 * MARGIN_TILES) / PATCH_TILES);

export interface Life {
  readonly index: number;
  readonly key: string;
  readonly name: string;
  readonly group: Group;
  readonly member: number;
  readonly taxon: number;
  readonly mass: readonly [egg: number, hatchling: number, juvenile: number, adult: number];
  readonly realm: readonly [egg: number, hatchling: number, juvenile: number, adult: number];
  readonly temperature: Range;
  readonly breed: Range;
  readonly eats: number;
  readonly preyMin: number;
  readonly preyMax: number;
  readonly eggEater: boolean;
  readonly plant: readonly [hatchling: number, juvenile: number, adult: number];
  readonly lifespan: number;
  readonly mature: number;
  readonly incubation: number;
  readonly clutch: number;
  readonly live: boolean;
  readonly gestates: boolean;
  readonly density: number;
  readonly harvest: readonly [egg: number, hatchling: number, juvenile: number, adult: number];
  readonly eggLoss: number;
  readonly youngLoss: number;
  readonly roam: number;
  readonly appetite: number;
  readonly migrant: number;
  readonly aquaticYoung: boolean;
  readonly stages: number;
  readonly slots: number;
}

interface Bio {
  mass: number;
  eats?: number;
  min?: number;
  max?: number;
  eggEater?: boolean;
  plant?: number;
  plantYoung?: number;
  live?: boolean;
  lifespan?: number;
  mature?: number;
  incubation?: number;
  clutch?: number;
  kg?: number;
  density?: number;
  aquaticYoung?: boolean;
  roam?: number;
  stages?: number;
  eggLoss?: number;
  youngLoss?: number;
  appetite?: number;
  gestation?: number;
  litter?: number;
  eggs?: boolean;
  migrant?: number;
}

const I = Taxon.Insect;
const A = Taxon.Amphibian;
const R = Taxon.Reptile;
const F = Taxon.Fish;
const M = Taxon.Mammal;
const B = Taxon.Bird;

const INSECT_BIO: Record<string, Bio> = {
  honeybee: { mass: 1e-4, plant: 1, kg: 4e-4 },
  bumblebee: { mass: 3e-4, plant: 1, kg: 3e-4 },
  butterfly: { mass: 4e-4, plant: 1, kg: 3e-4 },
  moth: { mass: 6e-4, plant: 1, kg: 3e-4 },
  dragonfly: { mass: 1e-3, eats: I, min: 0.003, max: 0.5, plant: 0, kg: 8e-5, aquaticYoung: true, lifespan: 0.3 },
  midge: { mass: 2e-6, plant: 1, plantYoung: 1, kg: 2e-3, aquaticYoung: true },
  firefly: { mass: 2e-4, plant: 0.4, kg: 1e-4 },
  ant: { mass: 3e-6, eats: I, min: 0.01, max: 6, eggEater: true, plant: 0.6, kg: 3e-3, roam: 0.3 },
  beetle: { mass: 1e-3, eats: I, min: 0.002, max: 0.3, eggEater: true, plant: 0.6, kg: 1.5e-3 },
  grasshopper: { mass: 1e-3, plant: 1, kg: 1e-3 },
  termite: { mass: 3e-6, plant: 1, kg: 2e-3, roam: 0.3 },
  waterrunner: { mass: 1e-4, eats: I, min: 0.01, max: 1, plant: 0, kg: 1e-4, aquaticYoung: false },
  fly: { mass: 2e-5, plant: 1, kg: 8e-4 },
};

const AMPHIBIAN_BIO: Record<string, Bio> = {
  frog: { mass: 0.02, eats: I | A, min: 3e-5, max: 0.12 },
  toad: { mass: 0.04, eats: I, min: 3e-5, max: 0.1 },
  poolfrog: { mass: 0.03, eats: I | A, min: 3e-5, max: 0.12 },
  treefrog: { mass: 0.005, eats: I, min: 3e-5, max: 0.2 },
  firesalamander: { mass: 0.03, eats: I, min: 3e-5, max: 0.1 },
  newt: { mass: 0.008, eats: I, min: 3e-5, max: 0.15, eggEater: true },
  marinetoad: { mass: 0.5, eats: I | A | R, min: 1e-5, max: 0.12 },
  dartfrog: { mass: 0.002, eats: I, min: 2e-5, max: 0.3 },
  woodfrog: { mass: 0.015, eats: I, min: 3e-5, max: 0.12 },
  spadefoot: { mass: 0.02, eats: I, min: 3e-5, max: 0.12 },
};

const REPTILE_BIO: Record<string, Bio> = {
  grasssnake: { mass: 0.3, eats: A | F | R | B, min: 0.01, max: 0.5, eggEater: true },
  adder: { mass: 0.1, eats: R | A, min: 0.02, max: 0.5, live: true },
  rattlesnake: { mass: 1.5, eats: R | A | B, min: 0.003, max: 0.4 },
  sidewinder: { mass: 0.1, eats: R | I, min: 1e-4, max: 0.3, live: true },
  cobra: { mass: 1.5, eats: A | R | B, min: 0.003, max: 0.5 },
  kingcobra: { mass: 6, eats: R, min: 0.005, max: 0.7 },
  mamba: { mass: 1.6, eats: R | A, min: 0.003, max: 0.4 },
  anaconda: { mass: 50, eats: F | A | R | M, min: 1e-4, max: 0.4, live: true },
  python: { mass: 40, eats: R | M | A | B, min: 1e-4, max: 0.5 },
  coralsnake: { mass: 0.06, eats: R, min: 0.02, max: 0.7 },
  treeboa: { mass: 0.8, eats: R | A | B, min: 0.005, max: 0.4, live: true },
  seasnake: { mass: 0.4, eats: F, min: 0.003, max: 1.6, live: true, plantYoung: 0.8 },
  slowworm: { mass: 0.04, eats: I, min: 1e-5, max: 0.1, live: true },
  walllizard: { mass: 0.005, eats: I, min: 1e-4, max: 0.2 },
  greenlizard: { mass: 0.04, eats: I, min: 3e-5, max: 0.1 },
  gecko: { mass: 0.01, eats: I, min: 1e-4, max: 0.15 },
  iguana: { mass: 4, eats: I, min: 1e-6, max: 0.01, plant: 0.92 },
  marineiguana: { mass: 1.5, eats: 0, plant: 1 },
  beardeddragon: { mass: 0.4, eats: I | R, min: 1e-5, max: 0.1, plant: 0.4 },
  thornydevil: { mass: 0.05, eats: I, min: 1e-5, max: 0.02 },
  skink: { mass: 0.4, eats: I, min: 1e-5, max: 0.05, plant: 0.3 },
  komodo: { mass: 70, eats: R | A | M | F | B, min: 1e-4, max: 0.5, eggEater: true },
  monitor: { mass: 5, eats: I | A | R | F | B, min: 1e-5, max: 0.3, eggEater: true },
  basilisk: { mass: 0.2, eats: I | R, min: 2e-5, max: 0.15 },
  chameleon: { mass: 0.1, eats: I, min: 1e-5, max: 0.1 },
  pantherchameleon: { mass: 0.15, eats: I, min: 1e-5, max: 0.1 },
  pondturtle: { mass: 1, eats: I | A | F, min: 1e-5, max: 0.1, plant: 0.4 },
  snapper: { mass: 8, eats: F | A | R | I, min: 1e-5, max: 0.25, plant: 0.2, eggEater: true },
  boxturtle: { mass: 0.4, eats: I, min: 1e-5, max: 0.05, plant: 0.55 },
  tortoise: { mass: 250, eats: 0, plant: 1 },
  deserttortoise: { mass: 4, eats: 0, plant: 1 },
  seaturtle: { mass: 150, eats: 0, plant: 1 },
  alligator: { mass: 200, eats: F | A | R | M | I | B, min: 1e-5, max: 0.3 },
  nilecroc: { mass: 400, eats: F | A | R | M | B, min: 1e-4, max: 0.3 },
  saltcroc: { mass: 500, eats: F | A | R | M | B, min: 1e-4, max: 0.3 },
  caiman: { mass: 30, eats: F | A | R | I, min: 1e-5, max: 0.3 },
  gharial: { mass: 160, eats: F, min: 1e-4, max: 0.08 },
};

const BIRD_BIO: Record<string, Bio> = {
  sparrow: { mass: 0.027, eats: I, min: 1e-5, max: 0.1, plant: 0.6 },
  robin: { mass: 0.018, eats: I, min: 1e-5, max: 0.15, plant: 0.3 },
  bluetit: { mass: 0.011, eats: I, min: 1e-5, max: 0.15, plant: 0.25 },
  swallow: { mass: 0.02, eats: I, min: 1e-5, max: 0.08, plant: 0, roam: 3 },
  starling: { mass: 0.08, eats: I, min: 1e-5, max: 0.1, plant: 0.5, roam: 2 },
  pigeon: { mass: 0.35, plant: 1 },
  crow: { mass: 0.5, eats: I | A | R | B, min: 1e-5, max: 0.15, plant: 0.4, eggEater: true, roam: 1.5 },
  woodpecker: { mass: 0.08, eats: I, min: 1e-5, max: 0.05, plant: 0.35 },
  parrot: { mass: 0.9, plant: 1, roam: 2 },
  hummingbird: { mass: 0.004, eats: I, min: 1e-5, max: 0.1, plant: 0.75, roam: 2 },
  kestrel: { mass: 0.2, eats: I | A | R | B, min: 1e-4, max: 0.6, appetite: 0.6 },
  owl: { mass: 0.45, eats: I | A | R | B, min: 1e-4, max: 0.8, appetite: 0.35 },
  eagle: { mass: 4.5, eats: F | A | R | B | M, min: 1e-3, max: 1.6, appetite: 0.35 },
  mallard: { mass: 1.1, eats: I | A, min: 1e-6, max: 0.05, plant: 0.6 },
  heron: { mass: 1.5, eats: F | A | I | R, min: 1e-4, max: 0.3, appetite: 0.4 },
  kingfisher: { mass: 0.04, eats: F | I, min: 0.02, max: 0.8, appetite: 0.6 },
  gull: { mass: 1, eats: F | I | A | B, min: 1e-5, max: 0.4, plant: 0.2, eggEater: true, roam: 3 },
  cormorant: { mass: 2, eats: F, min: 1e-3, max: 0.5, appetite: 0.5 },
  pheasant: { mass: 1, eats: I, min: 1e-5, max: 0.02, plant: 0.8 },
  stork: { mass: 3.5, eats: A | R | I | F | B, min: 1e-5, max: 0.1, roam: 3, appetite: 0.4 },
  emu: { mass: 35, eats: I, min: 1e-7, max: 0.003, plant: 0.92 },
  ostrich: { mass: 100, eats: I, min: 1e-7, max: 0.002, plant: 0.95 },
  turkey: { mass: 7, eats: I, min: 1e-6, max: 0.02, plant: 0.8 },
  peacock: { mass: 4.5, eats: I | R, min: 1e-6, max: 0.03, plant: 0.7 },
  chicken: { mass: 1.5, eats: I, min: 1e-6, max: 0.02, plant: 0.6 },
  hawk: { mass: 1.1, eats: I | A | R | B, min: 1e-4, max: 0.8, appetite: 0.4 },
  penguin: { mass: 25, eats: F | I, min: 1e-6, max: 0.1, plant: 0.7, appetite: 0.5, roam: 1 },
  flamingo: { mass: 3, eats: I, min: 1e-7, max: 0.003, plant: 0.3 },
  swan: { mass: 10, eats: I, min: 1e-7, max: 0.001, plant: 0.95 },
  goose: { mass: 3.5, plant: 1 },
  pelican: { mass: 8, eats: F, min: 1e-3, max: 0.3, appetite: 0.4 },
  vulture: { mass: 7, eats: R | A | B | M, min: 1e-4, max: 1.2, appetite: 0.35 },
  snowyowl: { mass: 2, eats: I | A | R | B | M, min: 1e-5, max: 0.8, appetite: 0.3 },
  toucan: { mass: 0.6, eats: I, min: 1e-5, max: 0.05, plant: 0.9 },
  crane: { mass: 5, eats: I | A | R, min: 1e-6, max: 0.1, plant: 0.5 },
};

const herb = (mass: number, o: Partial<Bio> = {}): Bio => ({ mass, plant: 1, ...o });

const bug = (mass: number, eats: number, min: number, max: number, o: Partial<Bio> = {}): Bio => ({ mass, eats, min, max, ...o });

const omni = (mass: number, plant: number, eats: number, min: number, max: number, o: Partial<Bio> = {}): Bio => ({ mass, plant, eats, min, max, ...o });

const hunt = (mass: number, eats: number, min: number, max: number, o: Partial<Bio> = {}): Bio => ({ mass, eats, min, max, ...o });

const years = (lifespan: number, mature: number, gestation: number, litter: number): Partial<Bio> => ({ lifespan, mature, gestation, litter });

const MAMMAL_BIO: Record<string, Bio> = {
  mole: bug(0.1, I, 1e-5, 0.1, { ...years(3, 0.3, 0.1, 4), roam: 0.3 }),
  starnose: bug(0.05, I | A, 1e-5, 0.2, { ...years(3, 0.8, 0.12, 5), roam: 0.3 }),
  hedgehog: omni(0.8, 0.1, I | A | R | B, 1e-5, 0.08, { ...years(5, 1, 0.15, 4), eggEater: true, roam: 0.5 }),
  shrew: bug(0.01, I, 1e-5, 0.3, { ...years(1.5, 0.15, 0.05, 6), roam: 0.4 }),
  molerat: herb(0.035, { ...years(30, 1, 0.15, 8), roam: 0.2 }),
  gopher: herb(0.15, { ...years(4, 0.5, 0.1, 4), roam: 0.3 }),
  aardvark: bug(55, I, 1e-9, 1e-5, { ...years(23, 2, 0.6, 1), appetite: 0.5 }),
  anteater: bug(30, I, 1e-9, 1e-5, { ...years(20, 3, 0.5, 1), appetite: 0.5 }),
  pangolin: bug(8, I, 1e-8, 1e-5, { ...years(15, 2, 0.35, 1), appetite: 0.6 }),
  armadillo: omni(5, 0.1, I, 1e-8, 1e-3, { ...years(12, 1, 0.3, 4) }),
  echidna: bug(4, I, 1e-8, 1e-4, { ...years(16, 3, 0.03, 1), eggs: true }),
  platypus: bug(1.5, I, 1e-6, 1e-3, { ...years(12, 2, 0.04, 2), eggs: true }),

  fieldmouse: omni(0.02, 0.85, I, 1e-5, 0.1, { ...years(1.5, 0.15, 0.06, 5), roam: 0.5 }),
  rat: omni(0.3, 0.6, I | A | B, 1e-5, 0.1, { ...years(2, 0.3, 0.06, 7), eggEater: true, roam: 0.6 }),
  vole: herb(0.03, { ...years(1.5, 0.15, 0.06, 5), roam: 0.5 }),
  lemming: herb(0.06, { ...years(2, 0.2, 0.06, 7), roam: 0.5 }),
  hamster: omni(0.3, 0.9, I, 1e-5, 0.1, { ...years(3, 0.3, 0.06, 8), roam: 0.4 }),
  squirrel: omni(0.3, 0.9, I | B, 1e-5, 0.1, { ...years(6, 1, 0.12, 3), eggEater: true }),
  flyingsquirrel: omni(0.14, 0.8, I, 1e-5, 0.1, years(6, 1, 0.1, 3)),
  chipmunk: omni(0.1, 0.85, I, 1e-5, 0.1, years(5, 0.8, 0.1, 4)),
  marmot: herb(4, years(15, 3, 0.11, 4)),
  prairiedog: herb(1, { ...years(8, 2, 0.1, 4), roam: 0.4 }),
  dormouse: omni(0.025, 0.7, I, 1e-5, 0.2, years(5, 1, 0.06, 4)),
  beaver: herb(20, years(12, 2.5, 0.3, 3)),
  muskrat: omni(1.2, 0.9, I | A, 1e-5, 0.05, years(3, 0.5, 0.07, 6)),
  capybara: herb(50, years(8, 1.5, 0.4, 4)),
  porcupine: herb(15, years(15, 2, 0.2, 1)),
  agouti: herb(3, years(15, 1, 0.3, 2)),
  mara: herb(10, years(12, 1, 0.25, 1)),
  jerboa: omni(0.07, 0.6, I, 1e-5, 0.2, years(3, 0.3, 0.1, 3)),
  rabbit: herb(1.6, years(3, 0.5, 0.09, 5)),
  hare: herb(3.5, years(5, 0.8, 0.13, 3)),
  arctichare: herb(4, years(5, 0.8, 0.13, 5)),
  pika: herb(0.15, years(5, 1, 0.08, 3)),

  macaque: omni(10, 0.8, I, 1e-5, 0.1, years(25, 4, 0.45, 1)),
  snowmonkey: omni(10, 0.85, I, 1e-5, 0.1, years(25, 4, 0.45, 1)),
  baboon: omni(20, 0.75, I | R | M, 1e-5, 0.1, years(30, 6, 0.5, 1)),
  chimpanzee: omni(45, 0.85, I | M, 1e-4, 0.3, years(45, 11, 0.6, 1)),
  gorilla: herb(150, years(40, 10, 0.7, 1)),
  orangutan: herb(60, { ...years(45, 12, 0.65, 1), plant: 0.98 }),
  howler: herb(7, years(20, 4, 0.5, 1)),
  spidermonkey: herb(8, years(25, 5, 0.6, 1)),
  lemur: omni(2.5, 0.9, I, 1e-5, 0.05, years(18, 2.5, 0.35, 1)),
  gibbon: omni(6, 0.9, I, 1e-5, 0.05, years(30, 8, 0.5, 1)),

  pipistrelle: bug(0.005, I, 1e-4, 0.3, { ...years(10, 1, 0.15, 1), roam: 2, migrant: 0.3 }),
  flyingfox: herb(0.7, { ...years(20, 2, 0.5, 1), roam: 3, migrant: 0.5 }),
  freetail: bug(0.012, I, 1e-5, 0.3, { ...years(12, 1, 0.2, 1), roam: 3, migrant: 1 }),

  wolf: hunt(40, M, 0.02, 3.5, { ...years(8, 2, 0.17, 5), plant: 0.05, appetite: 0.5 }),
  redfox: hunt(6, M | I | A | R | B, 1e-4, 0.7, { ...years(5, 1, 0.14, 5), plant: 0.15, eggEater: true, appetite: 0.7 }),
  arcticfox: hunt(3.5, M | B | I, 1e-4, 0.8, { ...years(5, 1, 0.14, 8), plant: 0.1, eggEater: true, appetite: 0.7 }),
  fennec: hunt(1.2, I | R | M | B, 1e-5, 0.5, { ...years(10, 0.8, 0.14, 3), plant: 0.3, eggEater: true, appetite: 0.8 }),
  coyote: hunt(15, M | I | R | B | A, 1e-4, 1.5, { ...years(8, 1, 0.17, 6), plant: 0.2, eggEater: true, appetite: 0.6 }),
  jackal: hunt(9, M | I | R | B | A, 1e-4, 1.5, { ...years(8, 1, 0.17, 4), plant: 0.25, eggEater: true, appetite: 0.6 }),
  wilddog: hunt(25, M, 0.02, 3, { ...years(11, 1.8, 0.2, 10), appetite: 0.5 }),
  lion: hunt(190, M, 0.02, 3.2, { ...years(14, 3.5, 0.3, 3), appetite: 0.45 }),
  tiger: hunt(220, M, 0.02, 2.5, { ...years(15, 4, 0.28, 3), appetite: 0.45 }),
  leopard: hunt(55, M | B | R, 0.01, 2.5, { ...years(14, 2.5, 0.26, 2), appetite: 0.45 }),
  jaguar: hunt(90, M | R | F | B, 0.01, 2.5, { ...years(14, 3, 0.28, 2), appetite: 0.45 }),
  cheetah: hunt(50, M, 0.03, 1.5, { ...years(12, 2.5, 0.26, 3), appetite: 0.45 }),
  puma: hunt(60, M | B, 0.01, 3, { ...years(13, 2.5, 0.27, 3), appetite: 0.45 }),
  snowleopard: hunt(40, M | B, 0.01, 2.5, { ...years(14, 2.5, 0.27, 2), appetite: 0.45 }),
  lynx: hunt(20, M | B, 0.005, 2, { ...years(15, 2, 0.18, 3), appetite: 0.5 }),
  wildcat: hunt(5, M | B | R | A | I, 1e-4, 1, { ...years(10, 1, 0.17, 4), eggEater: true, appetite: 0.7 }),
  hyena: hunt(60, M | B | R, 0.01, 4, { ...years(20, 3, 0.27, 2), appetite: 0.45 }),
  brownbear: omni(250, 0.6, M | F | I | B, 1e-5, 0.8, { ...years(25, 5, 0.55, 2), eggEater: true, appetite: 0.45 }),
  polarbear: hunt(450, M | F, 0.005, 0.6, { ...years(25, 5, 0.6, 2), plant: 0.05, appetite: 0.4 }),
  blackbear: omni(110, 0.75, M | F | I | B, 1e-5, 0.7, { ...years(20, 4, 0.55, 2), eggEater: true, appetite: 0.45 }),
  panda: herb(100, years(20, 6, 0.4, 1)),
  stoat: hunt(0.25, M | B | A, 0.01, 1.5, { ...years(3, 1, 0.1, 6), eggEater: true, appetite: 0.9 }),
  marten: hunt(1.5, M | B | I, 1e-4, 0.6, { ...years(8, 1.5, 0.12, 4), plant: 0.2, eggEater: true, appetite: 0.8 }),
  badger: omni(11, 0.3, I | A | M | R | B, 1e-5, 0.3, { ...years(10, 1.5, 0.12, 3), eggEater: true }),
  otter: hunt(8, F | A | I | M | B, 1e-4, 0.4, { ...years(10, 2, 0.17, 3), appetite: 0.7 }),
  seaotter: hunt(25, F | I, 1e-5, 0.1, { ...years(15, 4, 0.5, 1), appetite: 0.8 }),
  wolverine: hunt(14, M | B, 0.005, 3, { ...years(12, 2, 0.12, 3), eggEater: true, appetite: 0.5 }),
  honeybadger: hunt(10, R | M | I | A | B, 1e-4, 0.6, { ...years(20, 1.5, 0.17, 2), plant: 0.1, eggEater: true, appetite: 0.6 }),
  skunk: omni(2.5, 0.4, I | A | M | B, 1e-5, 0.3, { ...years(6, 1, 0.17, 5), eggEater: true }),
  giantotter: hunt(30, F | A | R, 1e-4, 0.1, { ...years(12, 2.5, 0.19, 3), appetite: 0.6 }),
  meerkat: bug(0.7, I | R, 1e-5, 0.2, { ...years(12, 1, 0.2, 3), eggEater: true, appetite: 0.9 }),
  mongoose: bug(1.5, I | R | A | B, 1e-5, 0.3, { ...years(10, 1, 0.17, 3), eggEater: true, appetite: 0.8 }),
  raccoon: omni(7, 0.4, I | A | F | R | B | M, 1e-5, 0.3, { ...years(8, 1, 0.17, 4), eggEater: true }),
  coati: omni(4, 0.6, I | A | R | M, 1e-5, 0.1, { ...years(10, 2, 0.18, 4), eggEater: true }),

  harbourseal: hunt(90, F, 1e-4, 0.08, { ...years(25, 4, 0.75, 1), appetite: 0.5 }),
  elephantseal: hunt(2000, F, 1e-5, 0.06, { ...years(20, 5, 0.9, 1), appetite: 0.35, migrant: 0.4 }),
  sealion: hunt(250, F, 1e-4, 0.05, { ...years(20, 4, 0.9, 1), appetite: 0.45 }),
  walrus: hunt(1000, F, 1e-5, 0.02, { ...years(40, 8, 1.2, 1), plant: 0.35, appetite: 0.4, migrant: 0.3 }),
  leopardseal: hunt(400, M | B | F, 1e-4, 0.5, { ...years(25, 4, 0.9, 1), appetite: 0.4 }),

  kangaroo: herb(60, years(15, 2, 0.1, 1)),
  wallaby: herb(15, years(12, 1.5, 0.1, 1)),
  koala: herb(8, years(15, 3, 0.1, 1)),
  wombat: herb(30, years(15, 2, 0.09, 1)),
  devil: hunt(8, M | B | R | I | A, 1e-4, 1, { ...years(7, 2, 0.06, 4), eggEater: true, appetite: 0.7 }),
  possum: omni(3.5, 0.9, I | B, 1e-5, 0.05, { ...years(11, 1, 0.05, 1), eggEater: true }),
  opossum: omni(3, 0.5, I | A | R | B | M, 1e-5, 0.3, { ...years(3, 0.5, 0.04, 8), eggEater: true }),
  sugarglider: omni(0.13, 0.6, I, 1e-5, 0.1, years(8, 1, 0.05, 2)),

  bluewhale: hunt(100000, F, 1e-7, 1e-4, { ...years(80, 10, 1, 1), appetite: 0.3, migrant: 0.6 }),
  humpback: hunt(30000, F, 1e-7, 2e-4, { ...years(60, 8, 1, 1), appetite: 0.3, migrant: 1 }),
  greywhale: hunt(30000, F, 1e-7, 2e-4, { ...years(60, 8, 1.1, 1), appetite: 0.3, migrant: 1 }),
  spermwhale: hunt(25000, F, 1e-6, 1e-2, { ...years(60, 12, 1.3, 1), appetite: 0.3, migrant: 0.3 }),
  orca: hunt(4000, M | F | B, 1e-5, 0.1, { ...years(60, 12, 1.4, 1), appetite: 0.35, migrant: 0.2 }),
  bottlenose: hunt(200, F, 1e-4, 0.05, { ...years(40, 8, 1, 1), appetite: 0.5 }),
  commondolphin: hunt(80, F, 1e-4, 0.06, { ...years(30, 5, 0.95, 1), appetite: 0.55 }),
  porpoise: hunt(55, F, 1e-4, 0.08, { ...years(20, 4, 0.9, 1), appetite: 0.6 }),
  beluga: hunt(1300, F, 1e-5, 0.02, { ...years(50, 8, 1.2, 1), appetite: 0.4, migrant: 0.3 }),
  narwhal: hunt(1500, F, 1e-5, 0.02, { ...years(50, 10, 1.3, 1), appetite: 0.4, migrant: 0.3 }),
  riverdolphin: hunt(100, F, 1e-4, 0.1, { ...years(30, 7, 0.9, 1), appetite: 0.5 }),
  manatee: herb(500, years(50, 6, 1, 1)),
  dugong: herb(300, years(50, 8, 1, 1)),

  zebra: herb(300, years(20, 3, 0.9, 1)),
  horse: herb(300, years(25, 3, 0.9, 1)),
  onager: herb(250, years(25, 3, 0.9, 1)),
  whiterhino: herb(2300, years(40, 7, 1.3, 1)),
  indianrhino: herb(2000, years(40, 7, 1.3, 1)),
  tapir: herb(300, years(30, 4, 1.1, 1)),
  hippo: herb(1500, years(40, 7, 0.65, 1)),
  boar: omni(100, 0.8, I | A | R | B, 1e-5, 0.1, { ...years(10, 1.5, 0.33, 6), eggEater: true }),
  warthog: omni(80, 0.95, I, 1e-5, 0.05, years(12, 1.5, 0.45, 3)),
  peccary: omni(25, 0.9, I | A | R, 1e-5, 0.1, years(12, 1, 0.38, 2)),
  dromedary: herb(500, years(40, 5, 1.1, 1)),
  bactrian: herb(450, years(40, 5, 1.1, 1)),
  guanaco: herb(110, years(20, 2, 0.95, 1)),
  giraffe: herb(1000, years(25, 5, 1.3, 1)),
  reddeer: herb(150, years(15, 2.5, 0.6, 1)),
  roedeer: herb(25, years(10, 1.5, 0.6, 2)),
  fallowdeer: herb(60, years(15, 2, 0.6, 1)),
  moose: herb(400, years(18, 3, 0.65, 2)),
  reindeer: herb(100, { ...years(12, 2, 0.55, 1), migrant: 0.7 }),
  whitetail: herb(70, years(12, 2, 0.55, 2)),
  bison: herb(700, years(20, 3, 0.75, 1)),
  buffalo: herb(600, years(20, 4, 0.9, 1)),
  waterbuffalo: herb(700, years(25, 3, 0.95, 1)),
  yak: herb(500, years(20, 4, 0.7, 1)),
  muskox: herb(300, years(15, 3, 0.65, 1)),
  wildebeest: herb(200, { ...years(20, 2, 0.7, 1), migrant: 0.5 }),
  impala: herb(55, years(13, 1.5, 0.55, 1)),
  gazelle: herb(20, years(10, 1, 0.5, 1)),
  springbok: herb(35, years(10, 1, 0.5, 1)),
  oryx: herb(200, years(18, 2, 0.75, 1)),
  kudu: herb(200, years(15, 2, 0.65, 1)),
  ibex: herb(80, years(15, 2.5, 0.45, 1)),
  mountaingoat: herb(80, years(12, 2.5, 0.5, 1)),
  bighorn: herb(80, years(12, 2.5, 0.45, 1)),
  mouflon: herb(40, years(12, 2, 0.4, 1)),
  saiga: herb(40, { ...years(8, 1, 0.4, 2), migrant: 0.4 }),
  chamois: herb(40, years(15, 2.5, 0.45, 1)),
  elephant: herb(4500, { ...years(60, 12, 1.8, 1), appetite: 0.55 }),
  asianelephant: herb(3500, { ...years(55, 12, 1.8, 1), appetite: 0.55 }),
  hyrax: herb(3.5, years(10, 2, 0.6, 2)),
  sloth: herb(4, years(20, 3, 0.5, 1)),
};

const MAMMAL_SURVIVAL = (mass: number, eggs: boolean): Target => ({
  egg: eggs ? 0.5 : 0.88,
  young: Math.min(0.8, Math.max(0.15, 0.12 * Math.log10(mass * 1000) - 0.05)),
  replacement: Math.min(7, Math.max(2.2, 7 - 1.1 * Math.log10(mass * 1000))),
});

const mammalHarvest = (mass: number): readonly [number, number, number, number] => [0, 3, 2, mass < 0.1 ? 1.4 : mass < 10 ? 1 : mass < 200 ? 0.7 : mass < 2000 ? 0.35 : 0.12];

const LAND_COMPRESSION = 0.2;

const mammalTerritory = (mass: number, eats: number, plant: number, sea: boolean): number => {
  if (sea) return mass > 5000 ? 2 * mass ** 0.75 : 6 * mass ** 0.75 + 100;
  const base = ((mass > 500 ? 15 : 40) * mass ** 0.75 + 30) * LAND_COMPRESSION;
  if (plant >= 0.7) return base;
  if (plant >= 0.3) return base * 2.5;
  return base * (eats & ~(Taxon.Insect | Taxon.Amphibian) ? (mass > 8 ? 6 : 3) : 2);
};

const neonateOf = (mass: number): number => 0.075 * mass ** 0.9;

const INSECT_DEFAULT = { lifespan: 0.2, mature: 0.07, incubation: 0.02, harvest: [8, 8, 8, 6] as const, roam: 1.2 };

const SURVIVAL = {
  insect: { egg: 0.3, young: 0.15, replacement: 8 },
  amphibian: { egg: 0.2, young: 0.05, replacement: 6 },
  reptile: { egg: 0.5, young: 0.25, replacement: 4 },
  bird: { egg: 0.5, young: 0.3, replacement: 4 },
} as const satisfies Record<string, Target>;

const FEMALE_SHARE = 0.5;

interface Target {
  readonly egg: number;
  readonly young: number;
  readonly replacement: number;
}

const survivalOf = (target: Target, lifespan: number, mature: number, incubation: number, stages: number): { eggLoss: number; youngLoss: number; clutch: number } => {
  const adultYears = Math.max(0.1, lifespan - mature);
  return {
    eggLoss: -Math.log(target.egg) / incubation,
    youngLoss: -Math.log(target.young) / (stages === 4 ? 0.675 * mature : mature),
    clutch: target.replacement / (FEMALE_SHARE * target.egg * target.young * adultYears),
  };
};

const smallFirst = (mass: number): readonly [number, number, number, number] => [6, 4, 2.5, mass < 0.02 ? 3.2 : mass < 1 ? 2 : mass < 20 ? 1.2 : 0.6];

const eggMassOf = (mass: number, group: Group): number =>
  group === 'insect' ? mass * 0.04 : group === 'bird' ? 0.045 * mass ** 0.77 : group === 'amphibian' ? 0.0004 + 0.02 * mass : Math.max(0.0003, 0.0016 * mass ** 0.6);

const hatchMassOf = (mass: number, group: Group): number =>
  group === 'insect' ? mass * 0.3 : group === 'bird' ? 0.4 * mass : group === 'amphibian' ? 0.002 + 0.03 * mass : Math.max(0.0004, 0.012 * mass ** 0.7);

const AMPHIBIAN_TADPOLE_REALM = Medium.Fresh;

const appetiteOf = (form: number, mass: number): number => (form === 0 ? 0.3 : form === 1 ? (mass > 1 ? 0.5 : mass < 0.05 ? 1 : 0.8) : form === 2 ? 0.4 : form === 3 ? 0.45 : 0.35);

const birdHarvest = (mass: number): readonly [number, number, number, number] => [5, 3, 1.8, mass < 0.05 ? 1.4 : mass < 1 ? 0.9 : 0.5];

const reptileRealm = (mask: number): number => (mask & Realm.Land ? Medium.Land : 0) | (mask & Realm.Fresh ? Medium.Fresh : 0) | (mask & Realm.Sea ? Medium.Sea : 0);

function build(): Life[] {
  const lives: Life[] = [];
  const push = (life: Omit<Life, 'index' | 'gestates'> & { gestates?: boolean }): void => void lives.push({ gestates: false, ...life, index: lives.length });

  INSECTS.forEach((species, member) => {
    if (species.motion === Motion.Mound) return;
    const bio = INSECT_BIO[species.key];
    if (!bio) throw new Error(`no biology for insect ${species.key}`);
    const { mass } = bio;
    const aquatic = bio.aquaticYoung ?? false;
    const lifespan = bio.lifespan ?? INSECT_DEFAULT.lifespan;
    const mature = bio.mature ?? INSECT_DEFAULT.mature;
    const incubation = bio.incubation ?? INSECT_DEFAULT.incubation;
    const young = aquatic ? Medium.Fresh : Medium.Land;
    const adult = species.motion === Motion.Skate ? Medium.Fresh : Medium.Land | Medium.Fresh;
    push({
      key: species.key,
      name: species.name,
      group: 'insect',
      member,
      taxon: I,
      mass: [eggMassOf(mass, 'insect'), hatchMassOf(mass, 'insect'), hatchMassOf(mass, 'insect') * 2, mass],
      realm: [young, young, young, adult],
      temperature: species.temperature,
      breed: [species.temperature[0] + 1, species.temperature[1] + 2, species.temperature[2] - 2, species.temperature[3]],
      eats: bio.eats ?? 0,
      preyMin: bio.min ?? 0,
      preyMax: bio.max ?? 0,
      eggEater: bio.eggEater ?? false,
      plant: [bio.plantYoung ?? bio.plant ?? 0, bio.plantYoung ?? bio.plant ?? 0, bio.plant ?? 0],
      lifespan,
      mature,
      incubation,
      ...survivalOf(SURVIVAL.insect, lifespan, mature, incubation, 3),
      live: false,
      density: (bio.kg ?? 1e-3) / mass,
      harvest: INSECT_DEFAULT.harvest,
      roam: bio.roam ?? INSECT_DEFAULT.roam,
      appetite: 1,
      migrant: 0,
      aquaticYoung: aquatic,
      stages: 3,
      slots: species.slots,
    });
  });

  AMPHIBIANS.forEach((species, member) => {
    const bio = AMPHIBIAN_BIO[species.key];
    if (!bio) throw new Error(`no biology for amphibian ${species.key}`);
    const { mass } = bio;
    const lifespan = bio.lifespan ?? 5 * mass ** 0.1 + 1;
    const mature = bio.mature ?? 0.5 + 0.8 * mass ** 0.25;
    const incubation = bio.incubation ?? 0.04;
    push({
      key: species.key,
      name: species.name,
      group: 'amphibian',
      member,
      taxon: A,
      mass: [eggMassOf(mass, 'amphibian'), hatchMassOf(mass, 'amphibian'), mass * 0.3, mass],
      realm: [AMPHIBIAN_TADPOLE_REALM, AMPHIBIAN_TADPOLE_REALM, Medium.Land | Medium.Fresh, Medium.Land | Medium.Fresh],
      temperature: species.temperature,
      breed: species.water[3] > 0 ? species.water : [species.temperature[0], species.temperature[1], species.temperature[2], species.temperature[3]],
      eats: bio.eats ?? 0,
      preyMin: bio.min ?? 3e-5,
      preyMax: bio.max ?? 0.12,
      eggEater: bio.eggEater ?? false,
      plant: [1, 0, bio.plant ?? 0],
      lifespan,
      mature,
      incubation,
      ...survivalOf(SURVIVAL.amphibian, lifespan, mature, incubation, 4),
      live: false,
      density: bio.density ?? 1 / (30 + 90 * mass ** 0.5),
      harvest: smallFirst(mass),
      roam: bio.roam ?? 1.5,
      appetite: 1,
      migrant: 0,
      aquaticYoung: true,
      stages: 4,
      slots: species.adults,
    });
  });

  REPTILES.forEach((species, member) => {
    const bio = REPTILE_BIO[species.key];
    if (!bio) throw new Error(`no biology for reptile ${species.key}`);
    const { mass } = bio;
    const adult = reptileRealm(species.realm);
    const sea = (adult & Medium.Sea) !== 0;
    const live = bio.live ?? false;
    const egg = species.key === 'seaturtle' ? Medium.Land : Medium.Land;
    const young = adult;
    const juvenileMass = mass * 0.18;
    const lifespan = bio.lifespan ?? 10 * mass ** 0.2;
    const mature = bio.mature ?? 1.4 * mass ** 0.25 + 0.3;
    const incubation = bio.incubation ?? 0.12 + 0.05 * mass ** 0.2;
    push({
      key: species.key,
      name: species.name,
      group: 'reptile',
      member,
      taxon: R,
      mass: [eggMassOf(mass, 'reptile'), hatchMassOf(mass, 'reptile'), juvenileMass, mass],
      realm: [egg, young, adult, adult],
      temperature: species.temperature,
      breed: [species.temperature[0] + 2, species.temperature[1] + 3, species.temperature[2] - 2, species.temperature[3]],
      eats: bio.eats ?? 0,
      preyMin: bio.min ?? 1e-5,
      preyMax: bio.max ?? 0.3,
      eggEater: bio.eggEater ?? false,
      plant: [bio.plantYoung ?? bio.plant ?? 0, bio.plantYoung ?? bio.plant ?? 0, bio.plant ?? 0],
      lifespan,
      mature,
      incubation,
      ...survivalOf(SURVIVAL.reptile, lifespan, mature, incubation, 4),
      live,
      density: bio.density ?? 1 / (300 * mass ** 0.6 + 1),
      harvest: smallFirst(mass),
      roam: bio.roam ?? (sea ? 2.5 : 1),
      appetite: appetiteOf(species.form, mass),
      migrant: 0,
      aquaticYoung: false,
      stages: 4,
      slots: species.adults,
    });
  });

  BIRDS.forEach((species, member) => {
    const bio = BIRD_BIO[species.key];
    if (!bio) throw new Error(`no biology for bird ${species.key}`);
    const { mass } = bio;
    const adult = reptileRealm(species.realm);
    const lifespan = bio.lifespan ?? 5 * mass ** 0.2 + 2;
    const mature = bio.mature ?? 0.4 + 0.5 * mass ** 0.3;
    const incubation = bio.incubation ?? 0.03 + 0.05 * mass ** 0.35;
    push({
      key: species.key,
      name: species.name,
      group: 'bird',
      member,
      taxon: B,
      mass: [eggMassOf(mass, 'bird'), hatchMassOf(mass, 'bird'), 0.85 * mass, mass],
      realm: [Medium.Land, Medium.Land, adult, adult],
      temperature: species.temperature,
      breed: [species.temperature[0] + 3, species.temperature[1] + 4, species.temperature[2] - 3, species.temperature[3] - 1],
      eats: bio.eats ?? 0,
      preyMin: bio.min ?? 1e-5,
      preyMax: bio.max ?? 0.3,
      eggEater: bio.eggEater ?? false,
      plant: [bio.plantYoung ?? bio.plant ?? 0, bio.plantYoung ?? bio.plant ?? 0, bio.plant ?? 0],
      lifespan,
      mature,
      incubation,
      ...survivalOf(SURVIVAL.bird, lifespan, mature, incubation, 4),
      live: false,
      density: bio.density ?? 1 / (200 * mass ** 0.8 + 60),
      harvest: birdHarvest(mass),
      roam: bio.roam ?? 1,
      appetite: bio.appetite ?? 1,
      migrant: species.migrant,
      aquaticYoung: false,
      stages: 4,
      slots: species.adults,
    });
  });

  MAMMALS.forEach((species, member) => {
    const bio = MAMMAL_BIO[species.key];
    if (!bio) throw new Error(`no biology for mammal ${species.key}`);
    const { mass } = bio;
    const adult = reptileRealm(species.realm);
    const eggs = bio.eggs ?? false;
    const lifespan = bio.lifespan ?? 4.5 * mass ** 0.18;
    const mature = bio.mature ?? 0.15 + 0.35 * mass ** 0.27;
    const gestation = bio.gestation ?? 0.07 + 0.075 * mass ** 0.3;
    const newborn = eggs ? 0.0016 * mass ** 0.6 : neonateOf(mass);
    const plant = bio.plant ?? 0;
    const young = species.realm === Realm.Sea || (species.realm & Realm.Sea) === 0 ? adult : Medium.Land;
    const t = species.temperature;
    push({
      key: species.key,
      name: species.name,
      group: 'mammal',
      member,
      taxon: M,
      mass: [newborn, eggs ? newborn * 6 : newborn, Math.max(newborn * 1.6, 0.4 * mass), mass],
      realm: [eggs ? Medium.Land : adult, young, adult, adult],
      temperature: t,
      breed: [t[0] + 4, t[1] + 4, t[2] - 2, t[3] - 3],
      eats: bio.eats ?? 0,
      preyMin: bio.min ?? 1e-5,
      preyMax: bio.max ?? 0.3,
      eggEater: bio.eggEater ?? false,
      plant: [bio.plantYoung ?? plant, bio.plantYoung ?? plant, plant],
      lifespan,
      mature,
      incubation: gestation,
      ...survivalOf(MAMMAL_SURVIVAL(mass, eggs), lifespan, mature, gestation, 4),
      live: false,
      gestates: !eggs,
      density: bio.density ?? 1 / mammalTerritory(mass, bio.eats ?? 0, plant, species.realm === Realm.Sea || (species.realm & Realm.Sea) !== 0 && (bio.eats ?? 0) === Taxon.Fish),
      harvest: mammalHarvest(mass),
      roam: bio.roam ?? ((species.realm & Realm.Sea) !== 0 ? 0.5 : mass > 3000 ? 0.8 : 0.7),
      appetite: bio.appetite ?? (plant >= 0.7 ? 0.7 : 0.8),
      migrant: bio.migrant ?? 0,
      aquaticYoung: false,
      stages: 4,
      slots: species.slots,
    });
  });

  return lives;
}

export const LIVES: readonly Life[] = build();

export const LIFE_COUNT = LIVES.length;

export const FAUNA_ATLAS_ACROSS = 4;

export const FAUNA_ATLAS_DOWN = Math.ceil(LIFE_COUNT / FAUNA_ATLAS_ACROSS);

export const lifeOf = (key: string): Life => {
  const life = LIVES.find((candidate) => candidate.key === key);
  if (!life) throw new Error(`no species ${key}`);
  return life;
};

export const firstOf = (group: Group): number => LIVES.findIndex((life) => life.group === group);

export const countOf = (group: Group): number => LIVES.filter((life) => life.group === group).length;

export const GROUP_BASE: Record<Group, number> = { insect: firstOf('insect'), amphibian: firstOf('amphibian'), reptile: firstOf('reptile'), bird: firstOf('bird'), mammal: firstOf('mammal') };

export const NEED_EXPONENT = 0.67;

export const needOf = (mass: number, group: Group): number => (group === 'amphibian' ? 9 : group === 'insect' ? 4 : group === 'mammal' ? 6 : group === 'bird' ? 8 : 5) * mass ** NEED_EXPONENT;

export const INSECT_LIFE: readonly number[] = INSECTS.map((species) => {
  const own = LIVES.findIndex((life) => life.group === 'insect' && life.key === species.key);
  if (own >= 0) return own;
  return LIVES.findIndex((life) => life.key === (species.key === 'anthill' ? 'ant' : 'termite'));
});
