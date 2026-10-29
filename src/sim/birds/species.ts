import { trapezoid } from '../plants/niche.ts';
import type { Range } from '../plants/species.ts';
import { CLIFF_SEEN } from '../steep.ts';
import { FRESH_WATER_FROM, MediumBit, Realm, SEA_WATER, SNOW_FROM, SNOW_TO, WATER_PRESENT, WET_FROM, WET_TO } from '../reptiles/species.ts';

export { Realm, SEA_WATER, FRESH_WATER_FROM, SNOW_FROM, SNOW_TO, WET_FROM, WET_TO };

export const Gait = { Perch: 0, Swoop: 1, Soar: 2, Float: 3, Walk: 4 } as const;

export type Gait = (typeof Gait)[keyof typeof Gait];

export const Pattern = { Plain: 0, Cap: 1, Tips: 2, Speckle: 3, Stripe: 4, Spots: 5 } as const;

export type Pattern = (typeof Pattern)[keyof typeof Pattern];

export const Trait = {
  Crest: 1,
  Bill: 2,
  Neck: 4,
  Fork: 8,
  Hover: 16,
  Dive: 32,
  Flock: 64,
  Hook: 128,
  Plume: 256,
  Flightless: 512,
  Fan: 1024,
} as const;

export type Habitat = readonly [tree: number, open: number, water: number, edge: number];

export type Colour = readonly [number, number, number];

export interface BirdSpecies {
  readonly key: string;
  readonly name: string;
  readonly gait: Gait;
  readonly realm: number;
  readonly pattern: Pattern;
  readonly length: number;
  readonly span: number;
  readonly adults: number;
  readonly common: number;
  readonly likes: Habitat;
  readonly nest: Habitat;
  readonly bias: number;
  readonly temperature: Range;
  readonly season: Range;
  readonly day: number;
  readonly night: number;
  readonly dusk: number;
  readonly shy: number;
  readonly rest: number;
  readonly speed: number;
  readonly reach: number;
  readonly skit: number;
  readonly traits: number;
  readonly beat: number;
  readonly altitude: number;
  readonly migrant: number;
  readonly sing: number;
  readonly look: number;
  readonly glide: number;
  readonly colour: Colour;
  readonly accent: Colour;
  readonly bill: Colour;
  readonly eye: Colour;
  readonly spots: number;
  readonly bulk: number;
  readonly tail: number;
}

export interface BirdDraft {
  key: string;
  name: string;
  gait: Gait;
  realm?: number;
  pattern: Pattern;
  length: number;
  span: number;
  adults?: number;
  common?: number;
  likes: Habitat;
  nest: Habitat;
  bias?: number;
  temperature: Range;
  season?: Range;
  day: number;
  night: number;
  dusk?: number;
  shy?: number;
  rest: number;
  speed: number;
  reach: number;
  skit: number;
  traits?: number;
  beat: number;
  altitude: number;
  migrant?: number;
  sing?: number;
  look?: number;
  glide?: number;
  colour: Colour;
  accent: Colour;
  bill?: Colour;
  eye?: Colour;
  spots?: number;
  bulk?: number;
  tail?: number;
}

const DARK_EYE: Colour = [0.05, 0.04, 0.04];

const HORN_BILL: Colour = [0.62, 0.5, 0.3];

const ALL_YEAR: Range = [0, 0.02, 0.98, 1];

const make = (draft: BirdDraft): BirdSpecies => ({
  key: draft.key,
  name: draft.name,
  gait: draft.gait,
  realm: (draft.realm ?? Realm.Land) | (draft.gait !== Gait.Walk && ((draft.traits ?? 0) & Trait.Flightless) === 0 ? Realm.Cliff : 0),
  pattern: draft.pattern,
  length: draft.length,
  span: draft.span,
  adults: draft.adults ?? 3,
  common: draft.common ?? 0.5,
  likes: draft.likes,
  nest: draft.nest,
  bias: draft.bias ?? 0,
  temperature: draft.temperature,
  season: draft.season ?? ALL_YEAR,
  day: draft.day,
  night: draft.night,
  dusk: draft.dusk ?? 0,
  shy: draft.shy ?? 0.3,
  rest: draft.rest,
  speed: draft.speed,
  reach: draft.reach,
  skit: draft.skit,
  traits: draft.traits ?? 0,
  beat: draft.beat,
  altitude: draft.altitude,
  migrant: draft.migrant ?? 0,
  sing: draft.sing ?? 0,
  look: draft.look ?? 0,
  glide: draft.glide ?? 0,
  colour: draft.colour,
  accent: draft.accent,
  bill: draft.bill ?? HORN_BILL,
  eye: draft.eye ?? DARK_EYE,
  spots: draft.spots ?? 0.3,
  bulk: draft.bulk ?? 0.22,
  tail: draft.tail ?? 0.4,
});

const LF = Realm.Land | Realm.Fresh;

const LFS = Realm.Land | Realm.Fresh | Realm.Sea;

const T = Trait;

export const BIRDS: readonly BirdSpecies[] = [
  make({ key: 'sparrow', sing: 0.5, name: 'house sparrow', gait: Gait.Perch, pattern: Pattern.Cap, length: 0.15, span: 0.22, adults: 4, common: 0.9, likes: [0.3, 0.5, 0, 0.1], nest: [0.6, 0.2, 0, 0.2], bias: 0.1, temperature: [-8, 2, 32, 40], day: 1, night: 0, dusk: 0.2, shy: 0.5, rest: 7, speed: 8, reach: 10, skit: 4, beat: 14, altitude: 1.5, colour: [0.52, 0.4, 0.28], accent: [0.42, 0.42, 0.44], bulk: 0.26 }),
  make({ key: 'robin', name: 'robin', sing: 0.6, gait: Gait.Perch, pattern: Pattern.Cap, length: 0.14, span: 0.21, adults: 3, common: 0.7, likes: [0.6, 0.3, 0, 0.1], nest: [0.5, 0.5, 0, 0], temperature: [-5, 4, 26, 34], day: 1, night: 0, dusk: 0.4, shy: 0.5, rest: 9, speed: 7, reach: 8, skit: 3, beat: 14, altitude: 1.2, colour: [0.45, 0.38, 0.27], accent: [0.88, 0.4, 0.16], bulk: 0.26 }),
  make({ key: 'bluetit', sing: 0.6, name: 'blue tit', gait: Gait.Perch, pattern: Pattern.Cap, length: 0.115, span: 0.18, adults: 3, common: 0.7, likes: [0.9, 0.1, 0, 0], nest: [1, 0, 0, 0], temperature: [-6, 3, 28, 36], day: 1, night: 0, dusk: 0.1, shy: 0.6, rest: 6, speed: 7, reach: 7, skit: 3, beat: 18, altitude: 2, colour: [0.46, 0.56, 0.3], accent: [0.28, 0.5, 0.86], bulk: 0.27 }),
  make({ key: 'swallow', migrant: 1, name: 'barn swallow', gait: Gait.Swoop, pattern: Pattern.Cap, length: 0.17, span: 0.33, adults: 3, common: 0.6, likes: [0.05, 0.45, 0.35, 0.35], nest: [0.3, 0.2, 0.2, 0.3], temperature: [10, 16, 32, 38], season: [0.15, 0.3, 0.75, 0.9], day: 1, night: 0, dusk: 0.6, shy: 0.3, rest: 3, speed: 11, reach: 30, skit: 0, traits: T.Fork, beat: 9, altitude: 3, colour: [0.12, 0.2, 0.4], accent: [0.62, 0.22, 0.15], bulk: 0.18, tail: 0.6 }),
  make({ key: 'starling', sing: 0.7, migrant: 0.5, name: 'starling', gait: Gait.Perch, pattern: Pattern.Speckle, length: 0.21, span: 0.38, adults: 4, common: 0.8, likes: [0.3, 0.6, 0.1, 0.1], nest: [0.8, 0.2, 0, 0], temperature: [-10, 0, 30, 38], day: 1, night: 0, dusk: 0.3, shy: 0.3, rest: 10, speed: 10, reach: 24, skit: 6, traits: T.Flock, beat: 12, altitude: 3, colour: [0.14, 0.14, 0.2], accent: [0.72, 0.72, 0.5], spots: 0.5, bulk: 0.24 }),
  make({ key: 'pigeon', name: 'wood pigeon', gait: Gait.Walk, pattern: Pattern.Cap, length: 0.4, span: 0.7, adults: 3, common: 0.7, likes: [0.3, 0.6, 0, 0.1], nest: [0.6, 0.3, 0, 0.1], temperature: [-8, 2, 30, 38], day: 1, night: 0, dusk: 0.2, shy: 0.3, rest: 14, speed: 0.6, reach: 8, skit: 6, beat: 8, altitude: 3, colour: [0.5, 0.52, 0.58], accent: [0.42, 0.62, 0.55], bulk: 0.3 }),
  make({ key: 'crow', name: 'carrion crow', gait: Gait.Walk, pattern: Pattern.Plain, length: 0.46, span: 0.95, adults: 2, common: 0.6, likes: [0.5, 0.5, 0, 0.1], nest: [1, 0, 0, 0], temperature: [-18, -6, 32, 40], day: 1, night: 0, dusk: 0.1, shy: 0.2, rest: 16, speed: 0.8, reach: 10, skit: 8, traits: T.Bill, beat: 5, altitude: 4, colour: [0.08, 0.08, 0.1], accent: [0.2, 0.2, 0.26], bill: [0.1, 0.1, 0.12], bulk: 0.24 }),
  make({ key: 'woodpecker', name: 'great spotted woodpecker', gait: Gait.Perch, pattern: Pattern.Cap, length: 0.23, span: 0.4, adults: 2, common: 0.45, likes: [1, 0, 0, 0], nest: [1, 0, 0, 0], temperature: [-12, -2, 28, 36], day: 1, night: 0, dusk: 0, shy: 0.4, rest: 14, speed: 9, reach: 14, skit: 5, traits: T.Bill, beat: 11, altitude: 3, colour: [0.1, 0.1, 0.12], accent: [0.82, 0.12, 0.12], bill: [0.2, 0.2, 0.22], bulk: 0.23 }),
  make({ key: 'parrot', name: 'scarlet macaw', gait: Gait.Perch, pattern: Pattern.Tips, length: 0.8, span: 1.0, adults: 2, common: 0.55, likes: [0.9, 0.1, 0, 0.05], nest: [1, 0, 0, 0], temperature: [16, 22, 36, 42], day: 1, night: 0, dusk: 0.3, shy: 0.4, rest: 20, speed: 11, reach: 24, skit: 8, traits: T.Hook | T.Flock | T.Plume, beat: 6, altitude: 6, colour: [0.82, 0.12, 0.1], accent: [0.15, 0.4, 0.85], bill: [0.88, 0.84, 0.78], bulk: 0.2, tail: 0.7 }),
  make({ key: 'hummingbird', migrant: 0.8, name: 'ruby-throated hummingbird', gait: Gait.Perch, pattern: Pattern.Cap, length: 0.09, span: 0.11, adults: 2, common: 0.5, likes: [0.4, 0.4, 0, 0.1], nest: [1, 0, 0, 0], temperature: [14, 20, 34, 40], day: 1, night: 0, dusk: 0.2, shy: 0.7, rest: 5, speed: 9, reach: 8, skit: 3, traits: T.Hover | T.Bill, beat: 28, altitude: 1.2, colour: [0.15, 0.55, 0.38], accent: [0.84, 0.1, 0.2], bill: [0.12, 0.1, 0.1], bulk: 0.2 }),
  make({ key: 'kestrel', migrant: 0.3, name: 'kestrel', gait: Gait.Soar, pattern: Pattern.Cap, length: 0.34, span: 0.72, adults: 2, common: 0.4, likes: [0.1, 0.8, 0, 0.1], nest: [0.5, 0.2, 0, 0.3], temperature: [-12, -2, 32, 40], day: 1, night: 0, dusk: 0.3, shy: 0.1, rest: 20, speed: 5, reach: 14, skit: 8, traits: T.Hook, beat: 7, altitude: 9, colour: [0.6, 0.35, 0.2], accent: [0.56, 0.56, 0.62], bill: [0.3, 0.3, 0.32], bulk: 0.22, tail: 0.5 }),
  make({ key: 'owl', sing: 0.3, look: 0.8, glide: 0.7, name: 'tawny owl', gait: Gait.Perch, pattern: Pattern.Speckle, length: 0.38, span: 0.95, adults: 2, common: 0.4, likes: [0.8, 0.3, 0, 0.05], nest: [1, 0, 0, 0], temperature: [-14, -4, 30, 38], day: 0.05, night: 1, dusk: 0.6, shy: 0.1, rest: 22, speed: 6, reach: 18, skit: 6, traits: T.Hook, beat: 4, altitude: 4, colour: [0.62, 0.46, 0.3], accent: [0.88, 0.82, 0.7], bill: [0.7, 0.62, 0.4], eye: [0.02, 0.02, 0.02], spots: 0.4, bulk: 0.3, tail: 0.3 }),
  make({ key: 'eagle', migrant: 0.3, name: 'golden eagle', gait: Gait.Soar, realm: LF, pattern: Pattern.Cap, length: 0.85, span: 2.1, adults: 1, common: 0.3, likes: [0.4, 0.5, 0.1, 0.1], nest: [0.6, 0.1, 0, 0.1], temperature: [-22, -10, 30, 38], day: 1, night: 0, dusk: 0.1, shy: 0.1, rest: 24, speed: 8, reach: 24, skit: 14, traits: T.Hook, beat: 2.5, altitude: 14, colour: [0.34, 0.24, 0.14], accent: [0.82, 0.62, 0.26], bill: [0.62, 0.55, 0.3], bulk: 0.22, tail: 0.45 }),
  make({ key: 'mallard', migrant: 0.4, name: 'mallard', gait: Gait.Float, realm: LF, pattern: Pattern.Cap, length: 0.58, span: 0.9, adults: 3, common: 0.7, likes: [0, 0.1, 0.6, 0.5], nest: [0.1, 0.3, 0, 0.8], temperature: [-8, 0, 30, 38], day: 0.9, night: 0.2, dusk: 0.4, shy: 0.2, rest: 18, speed: 0.5, reach: 14, skit: 8, traits: T.Bill, beat: 8, altitude: 4, colour: [0.52, 0.48, 0.42], accent: [0.08, 0.4, 0.24], bill: [0.88, 0.76, 0.2], bulk: 0.28 }),
  make({ key: 'heron', name: 'grey heron', gait: Gait.Walk, realm: LF, pattern: Pattern.Cap, length: 0.95, span: 1.7, adults: 2, common: 0.45, likes: [0.1, 0.1, 0.3, 0.9], nest: [0.7, 0, 0, 0.5], temperature: [-6, 2, 30, 38], day: 0.8, night: 0.2, dusk: 0.7, shy: 0.1, rest: 40, speed: 0.4, reach: 8, skit: 12, traits: T.Neck | T.Bill, beat: 3, altitude: 5, colour: [0.52, 0.58, 0.64], accent: [0.92, 0.92, 0.92], bill: [0.85, 0.7, 0.25], bulk: 0.14 }),
  make({ key: 'kingfisher', name: 'kingfisher', gait: Gait.Perch, realm: LF, pattern: Pattern.Stripe, length: 0.17, span: 0.25, adults: 2, common: 0.4, likes: [0.3, 0, 0.2, 0.9], nest: [0, 0, 0, 1], temperature: [-2, 6, 28, 36], day: 1, night: 0, dusk: 0.2, shy: 0.4, rest: 14, speed: 12, reach: 18, skit: 8, traits: T.Dive | T.Bill, beat: 20, altitude: 1, colour: [0.12, 0.5, 0.72], accent: [0.9, 0.5, 0.14], bill: [0.1, 0.1, 0.1], bulk: 0.28 }),
  make({ key: 'gull', migrant: 0.3, name: 'herring gull', gait: Gait.Perch, realm: LFS, pattern: Pattern.Tips, length: 0.6, span: 1.4, adults: 3, common: 0.7, likes: [0, 0.3, 0.3, 0.9], nest: [0, 0.3, 0, 0.9], bias: 0.1, temperature: [-14, -4, 28, 36], day: 1, night: 0.1, dusk: 0.2, shy: 0.1, rest: 24, speed: 8, reach: 30, skit: 9, traits: T.Flock | T.Bill, beat: 4, altitude: 8, colour: [0.74, 0.78, 0.82], accent: [0.12, 0.12, 0.14], bill: [0.92, 0.78, 0.2], bulk: 0.24 }),
  make({ key: 'cormorant', migrant: 0.3, name: 'great cormorant', gait: Gait.Perch, realm: LFS, pattern: Pattern.Plain, length: 0.85, span: 1.3, adults: 2, common: 0.5, likes: [0, 0.05, 0.3, 0.9], nest: [0.4, 0, 0, 0.8], bias: 0.05, temperature: [-8, 0, 28, 36], day: 1, night: 0.1, dusk: 0.2, shy: 0.1, rest: 30, speed: 9, reach: 30, skit: 10, traits: T.Dive | T.Neck | T.Bill | T.Hook, beat: 6, altitude: 2, colour: [0.1, 0.12, 0.14], accent: [0.35, 0.3, 0.2], bill: [0.45, 0.42, 0.35], bulk: 0.2 }),
  make({ key: 'pheasant', name: 'common pheasant', gait: Gait.Walk, pattern: Pattern.Cap, length: 0.75, span: 0.75, adults: 2, common: 0.6, likes: [0.3, 0.6, 0, 0.1], nest: [0.2, 0.8, 0, 0], temperature: [-12, -2, 30, 38], day: 1, night: 0, dusk: 0.3, shy: 0.4, rest: 18, speed: 0.7, reach: 8, skit: 6, traits: T.Plume, beat: 10, altitude: 2, colour: [0.62, 0.32, 0.15], accent: [0.08, 0.34, 0.3], bill: [0.78, 0.74, 0.55], bulk: 0.28, tail: 0.6 }),
  make({ key: 'stork', migrant: 1, name: 'white stork', gait: Gait.Walk, realm: LF, pattern: Pattern.Tips, length: 1, span: 2.0, adults: 2, common: 0.4, likes: [0.2, 0.5, 0.2, 0.6], nest: [0.8, 0, 0, 0.2], temperature: [8, 14, 32, 38], season: [0.1, 0.25, 0.75, 0.9], day: 1, night: 0, dusk: 0.1, shy: 0.1, rest: 40, speed: 0.5, reach: 10, skit: 14, traits: T.Neck | T.Bill, beat: 3, altitude: 12, colour: [0.93, 0.93, 0.9], accent: [0.1, 0.1, 0.12], bill: [0.86, 0.24, 0.14], bulk: 0.16 }),
  make({ key: 'emu', name: 'emu', gait: Gait.Walk, pattern: Pattern.Cap, length: 1.6, span: 0.4, adults: 1, common: 0.4, likes: [0.1, 0.8, 0, 0.1], nest: [0.1, 0.8, 0, 0.1], temperature: [-4, 8, 38, 46], day: 1, night: 0.2, dusk: 0.3, shy: 0.1, rest: 30, speed: 1.2, reach: 22, skit: 12, traits: T.Neck | T.Flightless, beat: 2, altitude: 11, colour: [0.42, 0.36, 0.3], accent: [0.36, 0.46, 0.56], bill: [0.3, 0.28, 0.26], bulk: 0.2 }),
  make({ key: 'ostrich', name: 'ostrich', gait: Gait.Walk, pattern: Pattern.Tips, length: 2, span: 0.8, adults: 1, common: 0.4, likes: [0.05, 0.9, 0, 0.05], nest: [0, 0.9, 0, 0.1], temperature: [6, 18, 40, 48], day: 1, night: 0.1, dusk: 0.3, shy: 0.1, rest: 34, speed: 1.4, reach: 26, skit: 16, traits: T.Neck | T.Flightless, beat: 2, altitude: 14, colour: [0.1, 0.1, 0.12], accent: [0.92, 0.9, 0.84], bill: [0.78, 0.6, 0.5], bulk: 0.2 }),
  make({ key: 'turkey', name: 'wild turkey', gait: Gait.Walk, pattern: Pattern.Cap, length: 1, span: 1.3, adults: 2, common: 0.5, likes: [0.5, 0.5, 0, 0.05], nest: [0.3, 0.7, 0, 0], temperature: [-14, -4, 30, 38], day: 1, night: 0, dusk: 0.3, shy: 0.3, rest: 20, speed: 0.8, reach: 10, skit: 8, traits: T.Fan, beat: 8, altitude: 4, colour: [0.35, 0.26, 0.16], accent: [0.78, 0.2, 0.2], bill: [0.7, 0.6, 0.4], bulk: 0.28, tail: 0.5 }),
  make({ key: 'peacock', name: 'peacock', gait: Gait.Walk, pattern: Pattern.Cap, length: 1.1, span: 1.2, adults: 2, common: 0.4, likes: [0.5, 0.5, 0, 0.1], nest: [0.4, 0.6, 0, 0.1], temperature: [12, 22, 38, 44], day: 1, night: 0, dusk: 0.3, shy: 0.3, rest: 24, speed: 0.7, reach: 10, skit: 8, traits: T.Fan | T.Plume | T.Crest, beat: 7, altitude: 4, colour: [0.1, 0.34, 0.7], accent: [0.14, 0.5, 0.3], bill: [0.7, 0.62, 0.45], bulk: 0.22, tail: 0.9 }),
  make({ key: 'chicken', name: 'red junglefowl', gait: Gait.Walk, pattern: Pattern.Cap, length: 0.5, span: 0.6, adults: 3, common: 0.6, likes: [0.4, 0.5, 0, 0.1], nest: [0.3, 0.6, 0, 0.1], temperature: [8, 16, 36, 42], day: 1, night: 0, dusk: 0.2, shy: 0.4, rest: 12, speed: 0.6, reach: 8, skit: 6, traits: T.Plume | T.Crest, beat: 10, altitude: 2, colour: [0.55, 0.28, 0.12], accent: [0.86, 0.14, 0.12], bill: [0.8, 0.7, 0.3], bulk: 0.28, tail: 0.5 }),
  make({ key: 'hawk', name: 'red-tailed hawk', migrant: 0.4, gait: Gait.Soar, pattern: Pattern.Tips, length: 0.55, span: 1.3, adults: 2, common: 0.4, likes: [0.3, 0.7, 0, 0.1], nest: [0.8, 0.1, 0, 0.1], temperature: [-16, -4, 34, 42], day: 1, night: 0, dusk: 0.2, shy: 0.1, rest: 22, speed: 7, reach: 20, skit: 12, traits: T.Hook, beat: 3.5, altitude: 12, colour: [0.42, 0.3, 0.2], accent: [0.72, 0.32, 0.16], bill: [0.3, 0.3, 0.32], bulk: 0.22, tail: 0.5 }),
  make({ key: 'penguin', name: 'emperor penguin', gait: Gait.Float, realm: Realm.Land | Realm.Sea, pattern: Pattern.Cap, length: 1, span: 0.5, adults: 3, common: 0.6, likes: [0, 0.2, 0.3, 0.9], nest: [0, 0.8, 0, 0.3], bias: 0.05, temperature: [-50, -35, 4, 12], day: 1, night: 0.5, dusk: 0.2, shy: 0, rest: 30, speed: 0.6, reach: 24, skit: 5, traits: T.Dive | T.Flightless | T.Flock | T.Bill, beat: 2, altitude: 3, colour: [0.08, 0.1, 0.14], accent: [0.96, 0.8, 0.26], bill: [0.2, 0.2, 0.22], bulk: 0.3, tail: 0.2 }),
  make({ key: 'flamingo', name: 'greater flamingo', migrant: 0.3, gait: Gait.Walk, realm: LF, pattern: Pattern.Tips, length: 1.2, span: 1.5, adults: 3, common: 0.5, likes: [0, 0.1, 0.3, 0.9], nest: [0, 0.3, 0, 0.9], temperature: [6, 16, 38, 44], day: 1, night: 0.3, dusk: 0.4, shy: 0.1, rest: 40, speed: 0.4, reach: 12, skit: 10, traits: T.Neck | T.Bill | T.Flock, beat: 4, altitude: 8, colour: [0.96, 0.58, 0.62], accent: [0.1, 0.08, 0.1], bill: [0.9, 0.5, 0.5], bulk: 0.14 }),
  make({ key: 'swan', name: 'mute swan', migrant: 0.6, gait: Gait.Float, realm: LF, pattern: Pattern.Plain, length: 1.5, span: 2.3, adults: 2, common: 0.5, likes: [0, 0.1, 0.7, 0.5], nest: [0, 0.3, 0, 0.9], temperature: [-14, -3, 26, 34], day: 1, night: 0.2, dusk: 0.2, shy: 0.1, rest: 30, speed: 0.4, reach: 16, skit: 8, traits: T.Neck | T.Bill, beat: 3, altitude: 6, colour: [0.95, 0.95, 0.94], accent: [0.9, 0.9, 0.9], bill: [0.92, 0.5, 0.15], bulk: 0.2 }),
  make({ key: 'goose', name: 'greylag goose', migrant: 1, gait: Gait.Walk, realm: LF, pattern: Pattern.Tips, length: 0.8, span: 1.6, adults: 3, common: 0.6, likes: [0, 0.7, 0.2, 0.5], nest: [0, 0.4, 0, 0.8], temperature: [-4, 3, 22, 30], day: 1, night: 0.2, dusk: 0.3, shy: 0.2, rest: 20, speed: 0.7, reach: 14, skit: 12, traits: T.Neck | T.Flock, beat: 4.5, altitude: 8, colour: [0.52, 0.47, 0.4], accent: [0.28, 0.25, 0.22], bill: [0.92, 0.55, 0.2], bulk: 0.22 }),
  make({ key: 'pelican', name: 'great white pelican', migrant: 0.5, gait: Gait.Float, realm: LFS, pattern: Pattern.Tips, length: 1.6, span: 2.9, adults: 2, common: 0.4, likes: [0, 0.05, 0.4, 0.9], nest: [0.1, 0.4, 0, 0.9], temperature: [2, 12, 36, 44], day: 1, night: 0.1, dusk: 0.2, shy: 0.1, rest: 34, speed: 0.4, reach: 28, skit: 12, traits: T.Neck | T.Bill | T.Dive | T.Flock, beat: 2.5, altitude: 10, colour: [0.94, 0.93, 0.9], accent: [0.1, 0.1, 0.12], bill: [0.95, 0.75, 0.4], bulk: 0.2 }),
  make({ key: 'vulture', name: 'griffon vulture', migrant: 0.2, gait: Gait.Soar, pattern: Pattern.Cap, length: 1, span: 2.5, adults: 1, common: 0.3, likes: [0.2, 0.7, 0, 0.1], nest: [0.1, 0.8, 0, 0.1], temperature: [6, 16, 42, 50], day: 1, night: 0, dusk: 0.1, shy: 0.05, rest: 30, speed: 7, reach: 30, skit: 14, traits: T.Hook | T.Neck, beat: 1.8, altitude: 18, colour: [0.22, 0.18, 0.14], accent: [0.72, 0.5, 0.42], bill: [0.55, 0.5, 0.4], bulk: 0.2 }),
  make({ key: 'snowyowl', name: 'snowy owl', migrant: 0.5, gait: Gait.Perch, pattern: Pattern.Speckle, length: 0.6, span: 1.5, adults: 2, common: 0.4, likes: [0.1, 0.9, 0, 0.1], nest: [0, 0.9, 0, 0.1], temperature: [-50, -34, 10, 22], day: 0.8, night: 0.9, dusk: 0.5, shy: 0.1, rest: 26, speed: 7, reach: 22, skit: 10, traits: T.Hook, beat: 3, altitude: 6, colour: [0.94, 0.94, 0.92], accent: [0.2, 0.18, 0.18], bill: [0.2, 0.2, 0.2], eye: [0.9, 0.7, 0.1], spots: 0.25, bulk: 0.3, tail: 0.3 }),
  make({ key: 'toucan', name: 'toco toucan', gait: Gait.Perch, pattern: Pattern.Cap, length: 0.6, span: 0.65, adults: 2, common: 0.5, likes: [1, 0, 0, 0], nest: [1, 0, 0, 0], temperature: [18, 24, 36, 42], day: 1, night: 0, dusk: 0.2, shy: 0.4, rest: 16, speed: 8, reach: 18, skit: 8, traits: T.Bill, beat: 7, altitude: 5, colour: [0.08, 0.08, 0.1], accent: [0.96, 0.96, 0.96], bill: [0.98, 0.58, 0.08], bulk: 0.24 }),
  make({ key: 'crane', name: 'common crane', migrant: 1, gait: Gait.Walk, realm: LF, pattern: Pattern.Cap, length: 1.1, span: 2.2, adults: 2, common: 0.5, likes: [0.05, 0.7, 0.1, 0.6], nest: [0, 0.5, 0, 0.8], temperature: [-2, 6, 26, 34], day: 1, night: 0.1, dusk: 0.3, shy: 0.1, rest: 30, speed: 0.6, reach: 14, skit: 14, traits: T.Neck | T.Bill | T.Flock, beat: 3.5, altitude: 12, colour: [0.6, 0.62, 0.66], accent: [0.84, 0.16, 0.14], bill: [0.7, 0.66, 0.5], bulk: 0.14 }),
];

export const BIRD_COUNT = BIRDS.length;

export const BIRD_STARTS: readonly number[] = BIRDS.reduce<number[]>((starts, species) => [...starts, (starts[starts.length - 1] ?? 0) + species.adults], [0]);

export const BIRD_SLOTS = BIRD_STARTS[BIRD_COUNT]!;

export const BIRD_CELL_TILES = 10;

export const BIRD_TABLE_WIDTH = 12;

export const FLEDGLING_SIZE = 0.62;

export const bodyTexels = (species: BirdSpecies): number => 3 + 16 * species.length;

export const spanTexels = (species: BirdSpecies): number => 2 + 16 * species.span;

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

export const mediumOf = (habitat: Habitat): number => (habitat[2] <= WATER_PRESENT ? (habitat[2] >= CLIFF_SEEN ? MediumBit.Cliff : MediumBit.Land) : habitat[2] < FRESH_WATER_FROM ? MediumBit.Sea : MediumBit.Fresh);

export const lives = (species: BirdSpecies, habitat: Habitat): boolean => (species.realm & mediumOf(habitat)) !== 0;

export const activity = (species: BirdSpecies, daylight: number): number =>
  Math.min(1, Math.max(0, species.night + (species.day - species.night) * daylight + species.dusk * 4 * daylight * (1 - daylight)));

export const sheltering = (species: BirdSpecies, wet: number): number => 1 - species.shy * smooth(WET_FROM, WET_TO, wet);

export const suitability = (species: BirdSpecies, habitat: Habitat): number =>
  Math.min(1, Math.max(0, species.bias + species.likes[0] * habitat[0] + species.likes[1] * habitat[1] + species.likes[2] * habitat[2] + species.likes[3] * habitat[3]));

export const warmth = (species: BirdSpecies, celsius: number): number => trapezoid(species.temperature, celsius);

export function abundance(species: BirdSpecies, habitat: Habitat, weather: Weather): number {
  if (!lives(species, habitat)) return 0;
  return (
    suitability(species, habitat) *
    species.common *
    warmth(species, weather.celsius) *
    trapezoid(species.season, weather.year) *
    activity(species, weather.daylight) *
    sheltering(species, weather.wet) *
    (1 - smooth(SNOW_FROM, SNOW_TO, weather.snow))
  );
}

export function tableRow(species: BirdSpecies): number[] {
  return [
    ...species.likes,
    ...species.temperature,
    ...species.season,
    species.day, species.night, species.dusk, species.shy,
    species.length, species.span, species.gait, species.pattern,
    ...species.colour, species.spots,
    ...species.accent, species.bulk,
    ...species.eye, species.bias,
    species.realm, species.rest, species.speed, species.reach,
    species.skit, species.traits, species.beat, species.altitude,
    ...species.bill, species.tail,
    species.migrant, species.sing, species.look, species.glide,
  ];
}
