import type { Biology, Bio, LifeRow, Target } from '../fauna/vocabulary.ts';
import { Medium, Realm, Taxon, mediumsOf, survivalOf } from '../fauna/vocabulary.ts';
import { MAMMALS } from './species.ts';
import { habitatOf } from '../fauna/vocabulary.ts';
import type { Life } from '../fauna/vocabulary.ts';
import { mediumOf, suitability as speciesSuitability } from './species.ts';
import { mammalExtrasAt, mammalHabitatAt } from './habitat.ts';
import type { MammalExtras, MammalHabitatSample } from './habitat.ts';

const I = Taxon.Insect;
const A = Taxon.Amphibian;
const R = Taxon.Reptile;
const F = Taxon.Fish;
const M = Taxon.Mammal;
const B = Taxon.Bird;

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


interface MammalSample {
  readonly habitat: MammalHabitatSample;
  readonly extras: MammalExtras;
}

const suitability = (life: Life, _stage: number, sample: MammalSample): number => {
  const species = MAMMALS[life.member]!;
  if ((species.realm & mediumOf(sample.habitat)) === 0) return 0;
  return speciesSuitability(species, sample.habitat, sample.extras);
};

export const BIOLOGY: Biology = {
  habitat: habitatOf<MammalSample>({
    sampler: (world) => {
      const sample: MammalSample = { habitat: [0, 0, 0, 0], extras: { rough: 0, soil: 0 } };
      return (column, row) => {
        mammalHabitatAt(world, column, row, sample.habitat);
        mammalExtrasAt(world, column, row, sample.extras);
        return sample;
      };
    },
    suitability,
  }),
  group: 'mammal',
  order: 4,
  rows: () => {
    const rows: LifeRow[] = [];
    MAMMALS.forEach((species, member) => {
      const bio = MAMMAL_BIO[species.key];
      if (!bio) throw new Error(`no biology for mammal ${species.key}`);
      const { mass } = bio;
      const adult = mediumsOf(species.realm);
      const eggs = bio.eggs ?? false;
      const lifespan = bio.lifespan ?? 4.5 * mass ** 0.18;
      const mature = bio.mature ?? 0.15 + 0.35 * mass ** 0.27;
      const gestation = bio.gestation ?? 0.07 + 0.075 * mass ** 0.3;
      const newborn = eggs ? 0.0016 * mass ** 0.6 : neonateOf(mass);
      const plant = bio.plant ?? 0;
      const young = species.realm === Realm.Sea || (species.realm & Realm.Sea) === 0 ? adult : Medium.Land;
      const t = species.temperature;
      rows.push({
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
    return rows;
  },
};
