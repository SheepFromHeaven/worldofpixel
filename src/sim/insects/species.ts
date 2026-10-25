import type { Range } from '../plants/species.ts';
import { trapezoid } from '../plants/niche.ts';

export const Motion = {
  HoverHop: 0,
  Flutter: 1,
  Skim: 2,
  Swarm: 3,
  Glow: 4,
  Trail: 5,
  Crawl: 6,
  Hop: 7,
  Web: 8,
  Buzz: 9,
  Mound: 10,
  Colony: 11,
  Skate: 12,
} as const;

export type Motion = (typeof Motion)[keyof typeof Motion];

export type Habitat = readonly [nectar: number, foliage: number, water: number, ground: number];

export interface InsectSpecies {
  readonly key: string;
  readonly name: string;
  readonly motion: Motion;
  readonly airborne: boolean;
  readonly length: number;
  readonly slots: number;
  readonly likes: Habitat;
  readonly temperature: Range;
  readonly season: Range;
  readonly day: number;
  readonly night: number;
  readonly dusk: number;
  readonly wind: number;
  readonly rain: number;
  readonly colour: readonly [number, number, number];
}

interface Draft {
  key: string;
  name: string;
  motion: Motion;
  length: number;
  slots: number;
  likes: Habitat;
  temperature: Range;
  season: Range;
  day: number;
  night: number;
  dusk?: number;
  wind: number;
  rain: number;
  colour: readonly [number, number, number];
}

const AIR: readonly Motion[] = [Motion.HoverHop, Motion.Flutter, Motion.Skim, Motion.Swarm, Motion.Glow, Motion.Buzz, Motion.Skate];

const make = (draft: Draft): InsectSpecies => ({
  ...draft,
  airborne: AIR.includes(draft.motion),
  dusk: draft.dusk ?? 0,
});

export const INSECTS: readonly InsectSpecies[] = [
  make({ key: 'honeybee', name: 'honey bee', motion: Motion.HoverHop, length: 0.012, slots: 3, likes: [1, 0.15, 0, 0], temperature: [8, 14, 32, 40], season: [0.02, 0.12, 0.7, 0.85], day: 1, night: 0, dusk: 0.15, wind: 14, rain: 1, colour: [0.86, 0.62, 0.12] }),
  make({ key: 'bumblebee', name: 'bumblebee', motion: Motion.HoverHop, length: 0.018, slots: 2, likes: [0.8, 0.2, 0, 0], temperature: [2, 8, 26, 34], season: [0.02, 0.1, 0.72, 0.9], day: 1, night: 0, dusk: 0.1, wind: 16, rain: 0.8, colour: [0.92, 0.78, 0.2] }),
  make({ key: 'butterfly', name: 'butterfly', motion: Motion.Flutter, length: 0.035, slots: 3, likes: [0.9, 0.4, 0.1, 0], temperature: [12, 18, 32, 38], season: [0.05, 0.2, 0.7, 0.85], day: 1, night: 0, wind: 10, rain: 1, colour: [0.95, 0.55, 0.15] }),
  make({ key: 'moth', name: 'moth', motion: Motion.Flutter, length: 0.03, slots: 3, likes: [0.4, 0.5, 0.1, 0], temperature: [8, 14, 30, 36], season: [0.05, 0.2, 0.8, 0.92], day: 0.05, night: 1, dusk: 0.6, wind: 9, rain: 1, colour: [0.66, 0.58, 0.46] }),
  make({ key: 'dragonfly', name: 'dragonfly', motion: Motion.Skim, length: 0.06, slots: 2, likes: [0, 0.1, 1, 0], temperature: [14, 20, 34, 40], season: [0.1, 0.25, 0.7, 0.85], day: 1, night: 0, wind: 11, rain: 1, colour: [0.2, 0.55, 0.78] }),
  make({ key: 'midge', name: 'midge', motion: Motion.Swarm, length: 0.004, slots: 8, likes: [0, 0.2, 1, 0], temperature: [6, 12, 30, 36], season: [0.02, 0.15, 0.8, 0.92], day: 0.3, night: 0.3, dusk: 1, wind: 6, rain: 1, colour: [0.12, 0.12, 0.12] }),
  make({ key: 'firefly', name: 'firefly', motion: Motion.Glow, length: 0.01, slots: 8, likes: [0, 0.6, 0.6, 0], temperature: [14, 18, 28, 34], season: [0.18, 0.3, 0.6, 0.75], day: 0, night: 1, dusk: 0.3, wind: 7, rain: 1, colour: [0.82, 1, 0.3] }),
  make({ key: 'ant', name: 'ant', motion: Motion.Colony, length: 0.006, slots: 400, likes: [0, 0.1, 0, 1], temperature: [5, 12, 34, 42], season: [0, 0.05, 0.8, 0.98], day: 0.8, night: 0.4, wind: 40, rain: 0.9, colour: [0.02, 0.015, 0.012] }),
  make({ key: 'beetle', name: 'beetle', motion: Motion.Crawl, length: 0.015, slots: 3, likes: [0, 0.5, 0.1, 0.6], temperature: [6, 12, 30, 38], season: [0.02, 0.1, 0.85, 0.98], day: 0.4, night: 0.8, dusk: 0.8, wind: 40, rain: 0.4, colour: [0.1, 0.22, 0.16] }),
  make({ key: 'grasshopper', name: 'grasshopper', motion: Motion.Hop, length: 0.03, slots: 4, likes: [0, 1, 0, 0.2], temperature: [16, 22, 36, 42], season: [0.25, 0.4, 0.72, 0.85], day: 1, night: 0, wind: 14, rain: 1, colour: [0.42, 0.62, 0.2] }),
  make({ key: 'anthill', name: 'ant hill', motion: Motion.Mound, length: 0.32, slots: 1, likes: [0, 0.1, 0, 1], temperature: [5, 12, 34, 42], season: [0, 0.05, 0.8, 0.98], day: 1, night: 1, wind: 99, rain: 0, colour: [0.26, 0.19, 0.11] }),
  make({ key: 'termite', name: 'termite', motion: Motion.Colony, length: 0.008, slots: 300, likes: [0, -0.4, -0.8, 1], temperature: [18, 24, 42, 48], season: [0, 0.05, 0.9, 1], day: 0.6, night: 0.5, wind: 40, rain: 0.5, colour: [0.02, 0.018, 0.015] }),
  make({ key: 'termitemound', name: 'termite mound', motion: Motion.Mound, length: 0.36, slots: 1, likes: [0, -0.4, -0.8, 1], temperature: [18, 24, 42, 48], season: [0, 0.05, 0.9, 1], day: 1, night: 1, wind: 99, rain: 0, colour: [0.4, 0.32, 0.22] }),
  make({ key: 'waterrunner', name: 'water strider', motion: Motion.Skate, length: 0.015, slots: 6, likes: [0, 0.05, 1, 0], temperature: [10, 16, 32, 40], season: [0.05, 0.15, 0.8, 0.95], day: 1, night: 0.3, dusk: 0.3, wind: 6, rain: 1, colour: [0.1, 0.12, 0.14] }),
  make({ key: 'fly', name: 'fly', motion: Motion.Buzz, length: 0.007, slots: 5, likes: [0.2, 0.2, 0.2, 0.5], temperature: [10, 16, 34, 40], season: [0.02, 0.15, 0.85, 0.98], day: 1, night: 0.1, wind: 10, rain: 1, colour: [0.1, 0.1, 0.12] }),
];

export const INSECT_COUNT = INSECTS.length;

export const INSECT_SLOTS: readonly number[] = INSECTS.flatMap((species, id) => Array.from({ length: species.slots }, () => id));

export const INSECT_STARTS: readonly number[] = INSECTS.reduce<number[]>((starts, species) => [...starts, (starts[starts.length - 1] ?? 0) + species.slots], [0]);

export const INSECT_CLICKS = 16;

export const INSECT_CELL_TILES = 4;

export const WIND_SHELTER = 0.4;

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export interface Weather {
  celsius: number;
  year: number;
  daylight: number;
  wind: number;
  rain: number;
}

export const activity = (species: InsectSpecies, daylight: number): number =>
  Math.min(1, Math.max(0, species.night + (species.day - species.night) * daylight + species.dusk * 4 * daylight * (1 - daylight)));

export function abundance(species: InsectSpecies, habitat: Habitat, weather: Weather): number {
  const base = Math.min(1, Math.max(0, species.likes[0] * habitat[0] + species.likes[1] * habitat[1] + species.likes[2] * habitat[2] + species.likes[3] * habitat[3]));
  const calm = 1 - smooth(species.wind * 0.6, species.wind, weather.wind * WIND_SHELTER);
  const dry = 1 - species.rain * smooth(0.05, 0.35, weather.rain);
  return base * trapezoid(species.temperature, weather.celsius) * trapezoid(species.season, weather.year) * activity(species, weather.daylight) * calm * dry;
}
