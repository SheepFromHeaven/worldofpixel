import type { Range } from '../flora/api.ts';
import type { World } from '../../sim/world.ts';

export const Taxon = { Insect: 1, Amphibian: 2, Reptile: 4, Fish: 8, Bird: 32, Mammal: 64 } as const;

export const Stage = { Egg: 0, Hatchling: 1, Juvenile: 2, Adult: 3 } as const;

export type Stage = (typeof Stage)[keyof typeof Stage];

export const STAGES = 4;

export const STAGE_NAMES: readonly string[] = ['egg', 'hatchling', 'juvenile', 'adult'];

export const Medium = { Land: 1, Fresh: 2, Sea: 4 } as const;

export const Realm = { Land: 1, Fresh: 2, Sea: 4, Cliff: 8 } as const;

export const MediumBit = { Land: 1, Fresh: 2, Sea: 4, Cliff: 8 } as const;

export const SEA_WATER = 0.05;

export const FRESH_WATER_FROM = 0.1;

export const WET_FROM = 0.03;

export const WET_TO = 0.35;

export const SNOW_FROM = 0.1;

export const SNOW_TO = 0.4;

export const WATER_PRESENT = 0.004;

export const WATER_FLAG = 0.004;

export const CLICK_MEMORY = 16;

export type Group = 'insect' | 'amphibian' | 'reptile' | 'bird' | 'mammal';

export type Weights = readonly [number, number, number, number];

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

export interface Bio {
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
  water?: boolean;
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

export type LifeRow = Omit<Life, 'index' | 'gestates'> & { gestates?: boolean };

export const Kind = { Land: 0, Fresh: 1, Sea: 2 } as const;

export interface TileBase {
  readonly kind: number;
  readonly silt: number;
  readonly bloom: number;
}

export interface Habitat<S> {
  sampler(world: World): (column: number, row: number) => S;
  suitability(life: Life, stage: number, sample: S, tile: TileBase): number;
}

export interface Biology {
  readonly group: Group;
  readonly order: number;
  readonly habitat: Habitat<never>;
  rows(): readonly LifeRow[];
}

export const habitatOf = <S>(habitat: Habitat<S>): Habitat<never> => habitat as unknown as Habitat<never>;

export const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

export const dot = (weights: Weights, habitat: readonly [number, number, number, number]): number => weights[0] * habitat[0] + weights[1] * habitat[1] + weights[2] * habitat[2] + weights[3] * habitat[3];

export const mediumBit = (kind: number): number => (kind === Kind.Land ? Medium.Land : kind === Kind.Fresh ? Medium.Fresh : Medium.Sea);

export interface Target {
  readonly egg: number;
  readonly young: number;
  readonly replacement: number;
}

const FEMALE_SHARE = 0.5;

export const survivalOf = (target: Target, lifespan: number, mature: number, incubation: number, stages: number): { eggLoss: number; youngLoss: number; clutch: number } => {
  const adultYears = Math.max(0.1, lifespan - mature);
  return {
    eggLoss: -Math.log(target.egg) / incubation,
    youngLoss: -Math.log(target.young) / (stages === 4 ? 0.675 * mature : mature),
    clutch: target.replacement / (FEMALE_SHARE * target.egg * target.young * adultYears),
  };
};

export const smallFirst = (mass: number): readonly [number, number, number, number] => [6, 4, 2.5, mass < 0.02 ? 3.2 : mass < 1 ? 2 : mass < 20 ? 1.2 : 0.6];

export const eggMassOf = (mass: number, group: Group): number =>
  group === 'insect' ? mass * 0.04 : group === 'bird' ? 0.045 * mass ** 0.77 : group === 'amphibian' ? 0.0004 + 0.02 * mass : Math.max(0.0003, 0.0016 * mass ** 0.6);

export const hatchMassOf = (mass: number, group: Group): number =>
  group === 'insect' ? mass * 0.3 : group === 'bird' ? 0.4 * mass : group === 'amphibian' ? 0.002 + 0.03 * mass : Math.max(0.0004, 0.012 * mass ** 0.7);

export const mediumsOf = (mask: number): number => (mask & Realm.Land ? Medium.Land : 0) | (mask & Realm.Fresh ? Medium.Fresh : 0) | (mask & Realm.Sea ? Medium.Sea : 0);
