import { AMPHIBIANS } from '../amphibians/species.ts';
import { BIRDS } from '../birds/species.ts';
import { MARGIN_TILES, WORLD_TILES } from '../grid.ts';
import type { Range } from '../plants/species.ts';
import { INSECTS, Motion } from '../insects/species.ts';
import { REPTILES, Realm } from '../reptiles/species.ts';

export const Taxon = { Insect: 1, Amphibian: 2, Reptile: 4, Fish: 8, Game: 16, Bird: 32 } as const;

export const Stage = { Egg: 0, Hatchling: 1, Juvenile: 2, Adult: 3 } as const;

export type Stage = (typeof Stage)[keyof typeof Stage];

export const STAGES = 4;

export const STAGE_NAMES: readonly string[] = ['egg', 'hatchling', 'juvenile', 'adult'];

export const Medium = { Land: 1, Fresh: 2, Sea: 4 } as const;

export type Group = 'insect' | 'amphibian' | 'reptile' | 'bird' | 'game';

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
}

const I = Taxon.Insect;
const A = Taxon.Amphibian;
const R = Taxon.Reptile;
const F = Taxon.Fish;
const G = Taxon.Game;
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
  anaconda: { mass: 50, eats: F | A | R | G, min: 1e-4, max: 0.4, live: true },
  python: { mass: 40, eats: R | G | A | B, min: 1e-4, max: 0.5 },
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
  komodo: { mass: 70, eats: R | A | G | F | B, min: 1e-4, max: 0.5, eggEater: true },
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
  alligator: { mass: 200, eats: F | A | R | G | I | B, min: 1e-5, max: 0.3 },
  nilecroc: { mass: 400, eats: F | A | R | G | B, min: 1e-4, max: 0.3 },
  saltcroc: { mass: 500, eats: F | A | R | G | B, min: 1e-4, max: 0.3 },
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
  eagle: { mass: 4.5, eats: F | A | R | B | G, min: 1e-3, max: 1.6, appetite: 0.35 },
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
  vulture: { mass: 7, eats: R | A | B | G, min: 1e-4, max: 1.2, appetite: 0.35 },
  snowyowl: { mass: 2, eats: I | A | R | B | G, min: 1e-5, max: 0.8, appetite: 0.3 },
  toucan: { mass: 0.6, eats: I, min: 1e-5, max: 0.05, plant: 0.9 },
  crane: { mass: 5, eats: I | A | R, min: 1e-6, max: 0.1, plant: 0.5 },
};

const GAME: Bio = { mass: 15, plant: 1, live: true, lifespan: 8, mature: 1.2 };

const INSECT_DEFAULT = { lifespan: 0.2, mature: 0.07, incubation: 0.02, harvest: [8, 8, 8, 6] as const, roam: 1.2 };

const SURVIVAL = {
  insect: { egg: 0.3, young: 0.15, replacement: 8 },
  amphibian: { egg: 0.2, young: 0.05, replacement: 6 },
  reptile: { egg: 0.5, young: 0.25, replacement: 4 },
  bird: { egg: 0.5, young: 0.3, replacement: 4 },
  game: { egg: 1, young: 0.5, replacement: 3 },
} as const;

const FEMALE_SHARE = 0.5;

const survivalOf = (group: Group, lifespan: number, mature: number, incubation: number, stages: number): { eggLoss: number; youngLoss: number; clutch: number } => {
  const target = SURVIVAL[group];
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
  const push = (life: Omit<Life, 'index'>): void => void lives.push({ ...life, index: lives.length });

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
      ...survivalOf('insect', lifespan, mature, incubation, 3),
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
      ...survivalOf('amphibian', lifespan, mature, incubation, 4),
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
      ...survivalOf('reptile', lifespan, mature, incubation, 4),
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
      ...survivalOf('bird', lifespan, mature, incubation, 4),
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

  push({
    key: 'game',
    name: 'game',
    group: 'game',
    member: 0,
    taxon: G,
    mass: [0, 1.2, 6, GAME.mass],
    realm: [Medium.Land, Medium.Land, Medium.Land, Medium.Land],
    temperature: [-30, -15, 36, 46],
    breed: [-5, 5, 30, 40],
    eats: 0,
    preyMin: 0,
    preyMax: 0,
    eggEater: false,
    plant: [1, 1, 1],
    lifespan: GAME.lifespan ?? 8,
    mature: GAME.mature ?? 1.2,
    incubation: 0.1,
    ...survivalOf('game', GAME.lifespan ?? 8, GAME.mature ?? 1.2, 0.1, 4),
    live: true,
    density: 1 / 800,
    harvest: [0, 0.8, 0.7, 0.55],
    roam: 1,
    appetite: 1,
    migrant: 0,
    aquaticYoung: false,
    stages: 4,
    slots: 0,
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

export const GROUP_BASE: Record<Group, number> = { insect: firstOf('insect'), amphibian: firstOf('amphibian'), reptile: firstOf('reptile'), bird: firstOf('bird'), game: firstOf('game') };

export const NEED_EXPONENT = 0.67;

export const needOf = (mass: number, group: Group): number => (group === 'amphibian' ? 9 : group === 'insect' ? 4 : group === 'game' ? 4 : group === 'bird' ? 8 : 5) * mass ** NEED_EXPONENT;

export const INSECT_LIFE: readonly number[] = INSECTS.map((species) => {
  const own = LIVES.findIndex((life) => life.group === 'insect' && life.key === species.key);
  if (own >= 0) return own;
  return LIVES.findIndex((life) => life.key === (species.key === 'anthill' ? 'ant' : 'termite'));
});
