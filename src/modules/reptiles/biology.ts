import type { Biology, Bio, LifeRow } from '../fauna/vocabulary.ts';
import { Medium, Taxon, eggMassOf, hatchMassOf, mediumsOf, smallFirst, survivalOf } from '../fauna/vocabulary.ts';
import { REPTILES } from './species.ts';
import { clamp01, dot, habitatOf, mediumBit, Stage } from '../fauna/vocabulary.ts';
import type { Life, TileBase, Weights } from '../fauna/vocabulary.ts';
import { mediumOf } from './species.ts';
import { reptileHabitatAt } from './habitat.ts';
import type { ReptileHabitatSample } from './habitat.ts';

const I = Taxon.Insect;
const A = Taxon.Amphibian;
const R = Taxon.Reptile;
const F = Taxon.Fish;
const M = Taxon.Mammal;
const B = Taxon.Bird;

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

const SURVIVAL = { egg: 0.5, young: 0.25, replacement: 4 };

const appetiteOf = (form: number, mass: number): number => (form === 0 ? 0.3 : form === 1 ? (mass > 1 ? 0.5 : mass < 0.05 ? 1 : 0.8) : form === 2 ? 0.4 : form === 3 ? 0.45 : 0.35);


const NEST_CROC: Weights = [0, 0.6, 0.5, 0.9];
const NEST_TURTLE: Weights = [0, 0.2, 0.9, 0.6];
const NEST_SEA_TURTLE: Weights = [0, 0.1, 0.9, 1];

const nestWeights = (life: Life, adult: Weights): Weights => {
  if (life.key === 'seaturtle') return NEST_SEA_TURTLE;
  const species = REPTILES[life.member]!;
  if (species.form === 4) return NEST_CROC;
  if (species.form === 3) return NEST_TURTLE;
  return adult;
};

const suitability = (life: Life, stage: number, hab: ReptileHabitatSample, tile: TileBase): number => {
  const species = REPTILES[life.member]!;
  const realm = life.realm[stage]!;
  if ((realm & mediumBit(tile.kind)) === 0) return 0;
  const weights = stage === Stage.Egg ? nestWeights(life, species.likes) : species.likes;
  if ((species.realm & mediumOf(hab)) === 0 && stage !== Stage.Egg) return 0;
  return clamp01(species.bias + dot(weights, hab));
};

export const BIOLOGY: Biology = {
  habitat: habitatOf<ReptileHabitatSample>({
    sampler: (world) => {
      const out: ReptileHabitatSample = [0, 0, 0, 0];
      return (column, row) => reptileHabitatAt(world, column, row, out);
    },
    suitability,
  }),
  group: 'reptile',
  order: 2,
  rows: () => {
    const rows: LifeRow[] = [];
    REPTILES.forEach((species, member) => {
      const bio = REPTILE_BIO[species.key];
      if (!bio) throw new Error(`no biology for reptile ${species.key}`);
      const { mass } = bio;
      const adult = mediumsOf(species.realm);
      const sea = (adult & Medium.Sea) !== 0;
      const live = bio.live ?? false;
      const egg = species.key === 'seaturtle' ? Medium.Land : Medium.Land;
      const young = adult;
      const juvenileMass = mass * 0.18;
      const lifespan = bio.lifespan ?? 10 * mass ** 0.2;
      const mature = bio.mature ?? 1.4 * mass ** 0.25 + 0.3;
      const incubation = bio.incubation ?? 0.12 + 0.05 * mass ** 0.2;
      rows.push({
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
        ...survivalOf(SURVIVAL, lifespan, mature, incubation, 4),
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
    return rows;
  },
};
