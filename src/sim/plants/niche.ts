import type { Range, Species } from './species.ts';
import { SPECIES } from './species.ts';

export interface Environment {
  celsius: number;
  rain: number;
  damp: number;
  altitude: number;
  salt: number;
}

const TEMPERATURE_FLOOR = -25;
const TEMPERATURE_CEILING = 45;
const TEMPERATURE_STEPS = 2;
const TEMPERATURE_BINS = (TEMPERATURE_CEILING - TEMPERATURE_FLOOR) * TEMPERATURE_STEPS + 1;

const RAIN_CEILING = 64;
const RAIN_STEPS = 2;
const RAIN_BINS = RAIN_CEILING * RAIN_STEPS + 1;

const UNIT_STEPS = 50;
const UNIT_BINS = UNIT_STEPS + 1;

const ease = (t: number): number => t * t * (3 - 2 * t);

export function trapezoid(range: Range, x: number): number {
  const [low, rise, fall, high] = range;
  if (x < low || x > high) return 0;
  if (x < rise) return ease((x - low) / (rise - low));
  if (x > fall) return ease((high - x) / (high - fall));
  return 1;
}

const table = (bins: number, at: (bin: number) => number): Float32Array => {
  const out = new Float32Array(bins);
  for (let bin = 0; bin < bins; bin += 1) out[bin] = at(bin);
  return out;
};

interface Tables {
  temperature: Float32Array;
  rain: Float32Array;
  altitude: Float32Array;
  salt: Float32Array;
  damp: Float32Array;
}

const TABLES: Tables[] = SPECIES.map((species) => ({
  temperature: table(TEMPERATURE_BINS, (bin) => trapezoid(species.temperature, TEMPERATURE_FLOOR + bin / TEMPERATURE_STEPS)),
  rain: table(RAIN_BINS, (bin) => trapezoid(species.rain, bin / RAIN_STEPS)),
  altitude: table(UNIT_BINS, (bin) => trapezoid(species.altitude, bin / UNIT_STEPS)),
  salt: table(UNIT_BINS, (bin) => trapezoid(species.salt, bin / UNIT_STEPS)),
  damp: table(UNIT_BINS, (bin) => trapezoid(species.damp, bin / UNIT_STEPS)),
}));

const clampIndex = (value: number, last: number): number => (value < 0 ? 0 : value > last ? last : value | 0);

export const temperatureBin = (celsius: number): number =>
  clampIndex((celsius - TEMPERATURE_FLOOR) * TEMPERATURE_STEPS, TEMPERATURE_BINS - 1);

export const rainBin = (rain: number): number => clampIndex(rain * RAIN_STEPS, RAIN_BINS - 1);

export const unitBin = (unit: number): number => clampIndex(unit * UNIT_STEPS, UNIT_BINS - 1);

export function fitness(id: number, celsius: number, rain: number, damp: number, altitude: number, salt: number): number {
  const tables = TABLES[id - 1]!;
  return (
    tables.temperature[temperatureBin(celsius)]! *
    tables.rain[rainBin(rain)]! *
    tables.altitude[unitBin(altitude)]! *
    tables.salt[unitBin(salt)]! *
    tables.damp[unitBin(damp)]!
  );
}

export const fitnessIn = (id: number, env: Environment): number =>
  fitness(id, env.celsius, env.rain, env.damp, env.altitude, env.salt);

export const climateFit = (species: Species, env: Environment): number => fitnessIn(SPECIES.indexOf(species) + 1, env);
