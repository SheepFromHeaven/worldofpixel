import { YEAR_LENGTH_IN_GAME_DAYS } from '../calendar.ts';
import type { Species } from './species.ts';

export const DAYS_PER_YEAR = YEAR_LENGTH_IN_GAME_DAYS;

export const HEIGHT_RANGE_METRES = 64;

export const STAGES = ['sapling', 'young', 'low', 'mid', 'high'] as const;

export type Stage = (typeof STAGES)[number];

const SAPLING_BELOW = 0.1;
const YOUNG_BELOW = 0.35;
const LOW_BELOW = 0.65;
const MID_BELOW = 0.9;

export const encodeHeight = (metres: number): number =>
  Math.sqrt(Math.max(0, metres) / HEIGHT_RANGE_METRES) * 255;

export const decodeHeight = (byte: number): number => (byte / 255) ** 2 * HEIGHT_RANGE_METRES;

export function growthRate(species: Species): number {
  const ratio = Math.max(1.05, species.height / species.seedling);
  return (Math.log(9) + Math.log(ratio - 1)) / species.yearsTo90;
}

export function heightAfter(species: Species, years: number, vigor = 1): number {
  const ratio = Math.max(1.05, species.height / species.seedling);
  return species.height / (1 + (ratio - 1) * Math.exp(-growthRate(species) * vigor * years));
}

export function grown(species: Species, metres: number, vigor: number, years: number): number {
  const rate = growthRate(species) * vigor;
  const base = Math.max(metres, species.seedling * 0.5);
  const next = species.height / (1 + (species.height / base - 1) * Math.exp(-rate * years));
  return Math.min(species.height, Math.max(base, next));
}

export const stageFor = (fraction: number): number =>
  fraction < SAPLING_BELOW ? 0 : fraction < YOUNG_BELOW ? 1 : fraction < LOW_BELOW ? 2 : fraction < MID_BELOW ? 3 : 4;

export const stageOfPlant = (species: Species, metres: number): number => stageFor(metres / species.height);

export const stageName = (stage: number): Stage => STAGES[stage] ?? 'high';

export const sizeShare = (species: Species, metres: number): number => Math.min(1, metres / species.height);

export const ageYears = (days: number): number => days / DAYS_PER_YEAR;

export function backgroundHazard(species: Species, ageInYears: number): number {
  const life = species.lifespan;
  const share = ageInYears / life;
  return (3 * share * share) / life;
}

export function lightNeed(species: Species): number {
  return (1 - species.shade) * 0.35;
}

export function lightResponse(species: Species, light: number): number {
  const need = lightNeed(species);
  if (light <= need) return 0;
  return Math.min(1, (light - need) / (1 - need));
}
