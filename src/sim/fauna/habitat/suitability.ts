import { AMPHIBIANS } from '../../amphibians/species.ts';
import { BIRDS, mediumOf as birdMediumOf } from '../../birds/species.ts';
import { INSECTS, Motion } from '../../insects/species.ts';
import { mediumOf, REPTILES } from '../../reptiles/species.ts';
import type { Life, Weights } from '../life.ts';
import { Medium, Stage } from '../life.ts';
import { WATER_FLAG } from './amphibianHabitat.ts';

export type Habitat4 = readonly [number, number, number, number];

export interface TileHabitat {
  readonly insect: Habitat4;
  readonly amphibian: Habitat4;
  readonly reptile: Habitat4;
  readonly bird: Habitat4;
  readonly kind: number;
}

export const Kind = { Land: 0, Fresh: 1, Sea: 2 } as const;

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

const dot = (weights: Weights, habitat: Habitat4): number => weights[0] * habitat[0] + weights[1] * habitat[1] + weights[2] * habitat[2] + weights[3] * habitat[3];

const mediumBit = (kind: number): number => (kind === Kind.Land ? Medium.Land : kind === Kind.Fresh ? Medium.Fresh : Medium.Sea);

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

export function stageSuitability(life: Life, stage: number, tile: TileHabitat): number {
  const { kind } = tile;
  if (life.group === 'insect') {
    const species = INSECTS[life.member]!;
    const aquatic = life.aquaticYoung && stage <= Stage.Hatchling;
    if (aquatic) return kind === Kind.Fresh ? 1 : 0;
    if (kind === Kind.Sea) return 0;
    if (species.motion === Motion.Skate && kind !== Kind.Fresh) return 0;
    return clamp01(dot(species.likes, tile.insect));
  }

  if (life.group === 'amphibian') {
    const species = AMPHIBIANS[life.member]!;
    const hab = tile.amphibian;
    if (stage <= Stage.Hatchling) return kind === Kind.Fresh ? hab[0] : 0;
    if (kind === Kind.Sea) return 0;
    if (hab[0] > WATER_FLAG) return species.likes[0] > 0.3 ? clamp01(species.likes[0] * hab[0]) : 0;
    return clamp01(species.bias + dot(species.likes, hab));
  }

  if (life.group === 'reptile') {
    const species = REPTILES[life.member]!;
    const hab = tile.reptile;
    const realm = life.realm[stage]!;
    if ((realm & mediumBit(kind)) === 0) return 0;
    const weights = stage === Stage.Egg ? nestWeights(life, species.likes) : species.likes;
    if ((species.realm & mediumOf(hab)) === 0 && stage !== Stage.Egg) return 0;
    return clamp01(species.bias + dot(weights, hab));
  }

  if (life.group === 'bird') {
    const species = BIRDS[life.member]!;
    const hab = tile.bird;
    if ((life.realm[stage]! & mediumBit(kind)) === 0) return 0;
    if (stage <= Stage.Hatchling) return clamp01(dot(species.nest, hab));
    if ((species.realm & birdMediumOf(hab)) === 0) return 0;
    return clamp01(species.bias + dot(species.likes, hab));
  }

  if (kind !== Kind.Land) return 0;
  return clamp01(tile.reptile[1] * 0.4 + tile.reptile[2] * 0.4 + 0.2);
}
