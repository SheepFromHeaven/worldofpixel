import type { Biology, Bio, LifeRow } from '../fauna/vocabulary.ts';
import { Medium, Taxon, eggMassOf, hatchMassOf, smallFirst, survivalOf } from '../fauna/vocabulary.ts';
import { AMPHIBIANS } from './species.ts';
import { clamp01, dot, habitatOf, Kind, Stage } from '../fauna/vocabulary.ts';
import type { Life, TileBase } from '../fauna/vocabulary.ts';
import { amphibianHabitatAt, WATER_FLAG } from './habitat.ts';
import type { AmphibianHabitatSample } from './habitat.ts';

const I = Taxon.Insect;
const A = Taxon.Amphibian;
const R = Taxon.Reptile;
const F = Taxon.Fish;

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
  axolotl: { mass: 0.15, eats: I | A | F, min: 1e-4, max: 0.2, eggEater: true, lifespan: 12, mature: 1.2, water: true },
};

const SURVIVAL = { egg: 0.2, young: 0.05, replacement: 6 };

const AMPHIBIAN_TADPOLE_REALM = Medium.Fresh;


const suitability = (life: Life, stage: number, hab: AmphibianHabitatSample, tile: TileBase): number => {
  const species = AMPHIBIANS[life.member]!;
  const { kind } = tile;
  if (stage <= Stage.Hatchling) return kind === Kind.Fresh ? hab[0] : 0;
  if (kind === Kind.Sea) return 0;
  if (hab[0] > WATER_FLAG) return species.likes[0] > 0.3 ? clamp01(species.likes[0] * hab[0]) : 0;
  return clamp01(species.bias + dot(species.likes, hab));
};

export const BIOLOGY: Biology = {
  habitat: habitatOf<AmphibianHabitatSample>({
    sampler: (world) => {
      const out: AmphibianHabitatSample = [0, 0, 0, 0];
      return (column, row) => amphibianHabitatAt(world, column, row, out);
    },
    suitability,
  }),
  group: 'amphibian',
  order: 1,
  rows: () => {
    const rows: LifeRow[] = [];
    AMPHIBIANS.forEach((species, member) => {
      const bio = AMPHIBIAN_BIO[species.key];
      if (!bio) throw new Error(`no biology for amphibian ${species.key}`);
      const { mass } = bio;
      const lifespan = bio.lifespan ?? 5 * mass ** 0.1 + 1;
      const mature = bio.mature ?? 0.5 + 0.8 * mass ** 0.25;
      const incubation = bio.incubation ?? 0.04;
      rows.push({
        key: species.key,
        name: species.name,
        group: 'amphibian',
        member,
        taxon: A,
        mass: [eggMassOf(mass, 'amphibian'), hatchMassOf(mass, 'amphibian'), mass * 0.3, mass],
        realm: [AMPHIBIAN_TADPOLE_REALM, AMPHIBIAN_TADPOLE_REALM, bio.water ? Medium.Fresh : Medium.Land | Medium.Fresh, bio.water ? Medium.Fresh : Medium.Land | Medium.Fresh],
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
        ...survivalOf(SURVIVAL, lifespan, mature, incubation, 4),
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
    return rows;
  },
};
