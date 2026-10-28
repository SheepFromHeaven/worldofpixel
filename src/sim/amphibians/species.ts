import { trapezoid } from '../plants/niche.ts';
import type { Range } from '../plants/species.ts';

export const Form = { Frog: 0, Toad: 1, Salamander: 2, Axolotl: 3 } as const;

export type Form = (typeof Form)[keyof typeof Form];

export const Gait = { Hop: 0, Walk: 1 } as const;

export type Gait = (typeof Gait)[keyof typeof Gait];

export const Pattern = { Plain: 0, Spots: 1, Stripe: 2, Blotch: 3 } as const;

export type Pattern = (typeof Pattern)[keyof typeof Pattern];

export const Clutch = { None: 0, Clump: 1, String: 2 } as const;

export type Clutch = (typeof Clutch)[keyof typeof Clutch];

export type Habitat = readonly [pond: number, shelter: number, damp: number, bank: number];

export type Colour = readonly [number, number, number];

export interface AmphibianSpecies {
  readonly key: string;
  readonly name: string;
  readonly form: Form;
  readonly gait: Gait;
  readonly pattern: Pattern;
  readonly length: number;
  readonly adults: number;
  readonly young: number;
  readonly likes: Habitat;
  readonly bias: number;
  readonly temperature: Range;
  readonly season: Range;
  readonly day: number;
  readonly night: number;
  readonly dusk: number;
  readonly wet: number;
  readonly rest: number;
  readonly canopy: boolean;
  readonly clutch: Clutch;
  readonly spawn: Range;
  readonly larva: Range;
  readonly water: Range;
  readonly colour: Colour;
  readonly accent: Colour;
  readonly eye: Colour;
  readonly spots: number;
}

interface Draft {
  key: string;
  name: string;
  form: Form;
  gait: Gait;
  pattern: Pattern;
  length: number;
  adults?: number;
  likes: Habitat;
  bias?: number;
  temperature: Range;
  season: Range;
  day: number;
  night: number;
  dusk?: number;
  wet: number;
  rest?: number;
  canopy?: boolean;
  clutch?: Clutch;
  spawn?: Range;
  larva?: Range;
  water?: Range;
  colour: Colour;
  accent: Colour;
  eye?: Colour;
  spots?: number;
}

const NEVER: Range = [0, 0, 0, 0];

const DARK_EYE: Colour = [0.07, 0.06, 0.05];

export const YOUNG_SLOTS = 8;

export const YOUNG_GROUP = 4;

const make = (draft: Draft): AmphibianSpecies => {
  const breeds = (draft.larva ?? NEVER)[3] > 0;
  return {
    key: draft.key,
    name: draft.name,
    form: draft.form,
    gait: draft.gait,
    pattern: draft.pattern,
    length: draft.length,
    adults: draft.adults ?? 3,
    young: breeds ? YOUNG_SLOTS : 0,
    likes: draft.likes,
    bias: draft.bias ?? 0,
    temperature: draft.temperature,
    season: draft.season,
    day: draft.day,
    night: draft.night,
    dusk: draft.dusk ?? 0,
    wet: draft.wet,
    rest: draft.rest ?? 10,
    canopy: draft.canopy ?? false,
    clutch: draft.clutch ?? Clutch.None,
    spawn: draft.spawn ?? NEVER,
    larva: draft.larva ?? NEVER,
    water: draft.water ?? [2, 8, 24, 30],
    colour: draft.colour,
    accent: draft.accent,
    eye: draft.eye ?? DARK_EYE,
    spots: draft.spots ?? 0,
  };
};

export const AMPHIBIANS: readonly AmphibianSpecies[] = [
  make({ key: 'frog', name: 'common frog', form: Form.Frog, gait: Gait.Hop, pattern: Pattern.Blotch, length: 0.08, likes: [0, 0.2, 0.3, 0.7], temperature: [2, 7, 22, 28], season: [0, 0.04, 0.62, 0.72], day: 0.5, night: 0.9, dusk: 0.8, wet: 0.5, rest: 8, clutch: Clutch.Clump, spawn: [0, 0.01, 0.1, 0.16], larva: [0.06, 0.12, 0.3, 0.4], water: [2, 6, 18, 24], colour: [0.46, 0.38, 0.2], accent: [0.22, 0.15, 0.08], spots: 0.28 }),
  make({ key: 'toad', name: 'common toad', form: Form.Toad, gait: Gait.Walk, pattern: Pattern.Spots, length: 0.1, likes: [0, 0.4, 0.15, 0.35], temperature: [4, 9, 24, 30], season: [0.02, 0.06, 0.6, 0.7], day: 0.2, night: 1, dusk: 0.7, wet: 0.6, rest: 14, clutch: Clutch.String, spawn: [0.02, 0.05, 0.12, 0.18], larva: [0.1, 0.16, 0.32, 0.4], water: [4, 9, 20, 26], colour: [0.43, 0.33, 0.2], accent: [0.26, 0.19, 0.11], spots: 0.5 }),
  make({ key: 'poolfrog', name: 'pool frog', form: Form.Frog, gait: Gait.Hop, pattern: Pattern.Stripe, length: 0.09, likes: [0.55, 0.1, 0.15, 0.55], temperature: [10, 16, 30, 36], season: [0.1, 0.2, 0.65, 0.8], day: 1, night: 0.3, dusk: 0.3, wet: 0.2, rest: 9, clutch: Clutch.Clump, spawn: [0.2, 0.26, 0.34, 0.4], larva: [0.3, 0.38, 0.58, 0.68], water: [12, 17, 28, 34], colour: [0.3, 0.55, 0.17], accent: [0.78, 0.82, 0.36], spots: 0.18 }),
  make({ key: 'treefrog', name: 'tree frog', form: Form.Frog, gait: Gait.Hop, pattern: Pattern.Plain, length: 0.04, likes: [0, 0.8, 0.25, 0.2], temperature: [8, 14, 30, 36], season: [0.08, 0.15, 0.62, 0.75], day: 0.3, night: 1, dusk: 0.6, wet: 0.5, rest: 30, canopy: true, clutch: Clutch.Clump, spawn: [0.15, 0.2, 0.3, 0.36], larva: [0.25, 0.32, 0.5, 0.6], water: [10, 15, 28, 34], colour: [0.3, 0.76, 0.25], accent: [0.2, 0.5, 0.14], eye: [0.85, 0.62, 0.15] }),
  make({ key: 'firesalamander', name: 'fire salamander', form: Form.Salamander, gait: Gait.Walk, pattern: Pattern.Blotch, length: 0.17, adults: 2, likes: [0, 0.45, 0.5, 0.25], temperature: [3, 9, 19, 25], season: [0.02, 0.1, 0.65, 0.78], day: 0.15, night: 1, dusk: 0.5, wet: 0.8, rest: 18, colour: [0.05, 0.05, 0.05], accent: [0.96, 0.76, 0.08], spots: 0.4 }),
  make({ key: 'newt', name: 'smooth newt', form: Form.Salamander, gait: Gait.Walk, pattern: Pattern.Spots, length: 0.09, likes: [0.7, 0.3, 0.2, 0.5], temperature: [4, 10, 22, 28], season: [0, 0.06, 0.65, 0.75], day: 0.6, night: 0.8, dusk: 0.6, wet: 0.3, rest: 12, larva: [0.12, 0.2, 0.4, 0.5], water: [4, 10, 20, 26], colour: [0.5, 0.42, 0.22], accent: [0.2, 0.14, 0.07], spots: 0.3 }),
  make({ key: 'marinetoad', name: 'marine toad', form: Form.Toad, gait: Gait.Walk, pattern: Pattern.Spots, length: 0.15, adults: 2, likes: [0, 0.3, 0.2, 0.4], temperature: [18, 23, 36, 42], season: [0, 0.05, 0.95, 1], day: 0.3, night: 1, dusk: 0.6, wet: 0.5, rest: 12, clutch: Clutch.String, spawn: [0, 0.1, 0.9, 1], larva: [0, 0.1, 0.9, 1], water: [20, 25, 34, 40], colour: [0.5, 0.4, 0.26], accent: [0.32, 0.24, 0.14], spots: 0.5 }),
  make({ key: 'dartfrog', name: 'poison dart frog', form: Form.Frog, gait: Gait.Hop, pattern: Pattern.Spots, length: 0.025, likes: [0, 0.5, 0.6, 0.15], temperature: [22, 26, 34, 40], season: [0, 0.02, 0.98, 1], day: 1, night: 0, dusk: 0.2, wet: 0.6, rest: 5, colour: [0.1, 0.3, 0.92], accent: [0.04, 0.04, 0.08], spots: 0.45 }),
  make({ key: 'woodfrog', name: 'wood frog', form: Form.Frog, gait: Gait.Hop, pattern: Pattern.Blotch, length: 0.055, likes: [0, 0.3, 0.3, 0.55], temperature: [-3, 0, 16, 22], season: [0, 0.02, 0.65, 0.75], day: 0.7, night: 0.6, dusk: 0.3, wet: 0.4, rest: 8, clutch: Clutch.Clump, spawn: [0, 0.01, 0.06, 0.1], larva: [0.04, 0.08, 0.22, 0.3], water: [-1, 2, 12, 18], colour: [0.55, 0.4, 0.25], accent: [0.18, 0.12, 0.08], spots: 0.2 }),
  make({ key: 'spadefoot', name: 'spadefoot toad', form: Form.Toad, gait: Gait.Hop, pattern: Pattern.Spots, length: 0.06, adults: 2, likes: [-1, 0.2, -0.5, -0.5], bias: 0.5, temperature: [8, 14, 36, 42], season: [0.05, 0.15, 0.75, 0.9], day: 0, night: 1, dusk: 0.3, wet: 1, rest: 10, colour: [0.62, 0.5, 0.28], accent: [0.4, 0.3, 0.15], spots: 0.35 }),
  make({ key: 'axolotl', name: 'axolotl', form: Form.Axolotl, gait: Gait.Walk, pattern: Pattern.Plain, length: 0.2, adults: 2, likes: [1, 0, 0, 0], temperature: [4, 12, 20, 26], season: [0, 0, 1, 1], day: 0.5, night: 0.9, dusk: 0.8, wet: 0, rest: 20, clutch: Clutch.Clump, spawn: [0, 0.05, 0.25, 0.35], larva: [0.05, 0.12, 0.35, 0.45], water: [6, 12, 20, 24], colour: [0.95, 0.72, 0.74], accent: [0.82, 0.22, 0.3] }),
];

export const AMPHIBIAN_COUNT = AMPHIBIANS.length;

export const AMPHIBIAN_SLOT_COUNTS: readonly number[] = AMPHIBIANS.map((species) => species.adults + species.young);

export const AMPHIBIAN_STARTS: readonly number[] = AMPHIBIAN_SLOT_COUNTS.reduce<number[]>((starts, count) => [...starts, (starts[starts.length - 1] ?? 0) + count], [0]);

export const AMPHIBIAN_SLOTS = AMPHIBIAN_STARTS[AMPHIBIAN_COUNT]!;

export const AMPHIBIAN_CELL_TILES = 6;

export const bodyTexels = (species: AmphibianSpecies): number => 3.2 + 30 * species.length;

export interface Weather {
  celsius: number;
  year: number;
  daylight: number;
  wet: number;
  snow: number;
}

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export const WET_FROM = 0.03;

export const WET_TO = 0.35;

export const activity = (species: AmphibianSpecies, daylight: number): number =>
  Math.min(1, Math.max(0, species.night + (species.day - species.night) * daylight + species.dusk * 4 * daylight * (1 - daylight)));

export const dampness = (species: AmphibianSpecies, wet: number): number => 1 - species.wet + species.wet * smooth(WET_FROM, WET_TO, wet);

export const SNOW_FROM = 0.1;

export const SNOW_TO = 0.4;

export const suitability = (species: AmphibianSpecies, habitat: Habitat): number =>
  Math.min(1, Math.max(0, species.bias + species.likes[0] * habitat[0] + species.likes[1] * habitat[1] + species.likes[2] * habitat[2] + species.likes[3] * habitat[3]));

export function abundance(species: AmphibianSpecies, habitat: Habitat, weather: Weather): number {
  return (
    suitability(species, habitat) *
    trapezoid(species.temperature, weather.celsius) *
    trapezoid(species.season, weather.year) *
    activity(species, weather.daylight) *
    dampness(species, weather.wet) *
    (1 - smooth(SNOW_FROM, SNOW_TO, weather.snow))
  );
}

export function breeding(species: AmphibianSpecies, pond: number, celsius: number, year: number): { spawn: number; larva: number } {
  const there = pond * trapezoid(species.water, celsius);
  return { spawn: there * trapezoid(species.spawn, year), larva: there * trapezoid(species.larva, year) };
}

export const calling = (species: AmphibianSpecies, year: number): number =>
  species.young === 0 ? 0 : Math.max(trapezoid(species.spawn, year), 0.6 * trapezoid(species.larva, year));
