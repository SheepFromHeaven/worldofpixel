import type { Biology, Bio, LifeRow } from '../fauna/vocabulary.ts';
import { Medium, Taxon, eggMassOf, hatchMassOf, mediumsOf, survivalOf } from '../fauna/vocabulary.ts';
import { BIRDS } from './species.ts';
import { clamp01, dot, habitatOf, mediumBit, Stage } from '../fauna/vocabulary.ts';
import type { Life, TileBase } from '../fauna/vocabulary.ts';
import { mediumOf } from './species.ts';
import { birdHabitatAt } from './habitat.ts';
import type { BirdHabitatSample } from './habitat.ts';

const I = Taxon.Insect;
const A = Taxon.Amphibian;
const R = Taxon.Reptile;
const F = Taxon.Fish;
const M = Taxon.Mammal;
const B = Taxon.Bird;

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

const SURVIVAL = { egg: 0.5, young: 0.3, replacement: 4 };

const birdHarvest = (mass: number): readonly [number, number, number, number] => [5, 3, 1.8, mass < 0.05 ? 1.4 : mass < 1 ? 0.9 : 0.5];


const suitability = (life: Life, stage: number, hab: BirdHabitatSample, tile: TileBase): number => {
  const species = BIRDS[life.member]!;
  if ((life.realm[stage]! & mediumBit(tile.kind)) === 0) return 0;
  if (stage <= Stage.Hatchling) return clamp01(dot(species.nest, hab));
  if ((species.realm & mediumOf(hab)) === 0) return 0;
  return clamp01(species.bias + dot(species.likes, hab));
};

export const BIOLOGY: Biology = {
  habitat: habitatOf<BirdHabitatSample>({
    sampler: (world) => {
      const out: BirdHabitatSample = [0, 0, 0, 0];
      return (column, row) => birdHabitatAt(world, column, row, out);
    },
    suitability,
  }),
  group: 'bird',
  order: 3,
  rows: () => {
    const rows: LifeRow[] = [];
    BIRDS.forEach((species, member) => {
      const bio = BIRD_BIO[species.key];
      if (!bio) throw new Error(`no biology for bird ${species.key}`);
      const { mass } = bio;
      const adult = mediumsOf(species.realm);
      const lifespan = bio.lifespan ?? 5 * mass ** 0.2 + 2;
      const mature = bio.mature ?? 0.4 + 0.5 * mass ** 0.3;
      const incubation = bio.incubation ?? 0.03 + 0.05 * mass ** 0.35;
      rows.push({
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
        ...survivalOf(SURVIVAL, lifespan, mature, incubation, 4),
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
    return rows;
  },
};
