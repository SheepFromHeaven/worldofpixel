import type { Biology, Bio, LifeRow } from '../fauna/vocabulary.ts';
import { Medium, Taxon, eggMassOf, hatchMassOf, survivalOf } from '../fauna/vocabulary.ts';
import { INSECTS, Motion } from './species.ts';
import { clamp01, dot, habitatOf, Kind, Stage } from '../fauna/vocabulary.ts';
import type { Life, TileBase } from '../fauna/vocabulary.ts';
import { murkFactor } from './species.ts';
import { habitatAt } from './habitat.ts';
import type { HabitatSample } from './habitat.ts';

const I = Taxon.Insect;

const INSECT_BIO: Record<string, Bio> = {
  honeybee: { mass: 1e-4, plant: 1, kg: 4e-4 },
  bumblebee: { mass: 3e-4, plant: 1, kg: 3e-4 },
  butterfly: { mass: 4e-4, plant: 1, kg: 3e-4 },
  moth: { mass: 6e-4, plant: 1, kg: 3e-4 },
  dragonfly: { mass: 1e-3, eats: I, min: 0.003, max: 0.5, plant: 0, kg: 8e-5, aquaticYoung: true, lifespan: 0.3 },
  midge: { mass: 2e-6, plant: 1, plantYoung: 1, kg: 2e-3, aquaticYoung: true },
  mosquito: { mass: 3e-6, plant: 1, plantYoung: 1, kg: 2e-3, aquaticYoung: true },
  firefly: { mass: 2e-4, plant: 0.4, kg: 1e-4 },
  ant: { mass: 3e-6, eats: I, min: 0.01, max: 6, eggEater: true, plant: 0.6, kg: 3e-3, roam: 0.3 },
  beetle: { mass: 1e-3, eats: I, min: 0.002, max: 0.3, eggEater: true, plant: 0.6, kg: 1.5e-3 },
  grasshopper: { mass: 1e-3, plant: 1, kg: 1e-3 },
  termite: { mass: 3e-6, plant: 1, kg: 2e-3, roam: 0.3 },
  waterrunner: { mass: 1e-4, eats: I, min: 0.01, max: 1, plant: 0, kg: 1e-4, aquaticYoung: false },
  fly: { mass: 2e-5, plant: 1, kg: 8e-4 },
};

const INSECT_DEFAULT = { lifespan: 0.2, mature: 0.07, incubation: 0.02, harvest: [8, 8, 8, 6] as const, roam: 1.2 };

const SURVIVAL = { egg: 0.3, young: 0.15, replacement: 8 };


const suitability = (life: Life, stage: number, sample: HabitatSample, tile: TileBase): number => {
  const species = INSECTS[life.member]!;
  const { kind } = tile;
  const aquatic = life.aquaticYoung && stage <= Stage.Hatchling;
  const murked = murkFactor(species, tile.silt, tile.bloom);
  const lifts = species.murk[0] !== 0 || species.murk[1] !== 0;
  if (aquatic) return kind === Kind.Fresh ? (lifts ? clamp01(0.6 * murked) : 1) : 0;
  if (kind === Kind.Sea) return 0;
  if (species.motion === Motion.Skate && kind !== Kind.Fresh) return 0;
  return clamp01(dot(species.likes, sample) * murked);
};

export const BIOLOGY: Biology = {
  habitat: habitatOf<HabitatSample>({
    sampler: (world) => {
      const out: HabitatSample = [0, 0, 0, 0];
      return (column, row) => habitatAt(world, column, row, out);
    },
    suitability,
  }),
  group: 'insect',
  order: 0,
  rows: () => {
    const rows: LifeRow[] = [];
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
      rows.push({
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
        ...survivalOf(SURVIVAL, lifespan, mature, incubation, 3),
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
    return rows;
  },
};
