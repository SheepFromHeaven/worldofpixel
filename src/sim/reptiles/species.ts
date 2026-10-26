import { trapezoid } from '../plants/niche.ts';
import { CLIFF_SEEN } from '../steep.ts';
import type { Range } from '../plants/species.ts';

export const Form = { Snake: 0, Lizard: 1, Chameleon: 2, Turtle: 3, Crocodilian: 4 } as const;

export type Form = (typeof Form)[keyof typeof Form];

export const Pattern = { Plain: 0, Spots: 1, Stripe: 2, Bands: 3, Diamond: 4, Zigzag: 5, Blotch: 6, Scutes: 7, Ridge: 8 } as const;

export type Pattern = (typeof Pattern)[keyof typeof Pattern];

export const Realm = { Land: 1, Fresh: 2, Sea: 4, Cliff: 8 } as const;

export const Trait = {
  Hood: 1,
  Rattle: 2,
  Tongue: 4,
  BlueTongue: 8,
  Crest: 16,
  Spikes: 32,
  Beard: 64,
  Camo: 128,
  Sidewind: 256,
  Plunge: 512,
  Flippers: 1024,
  Dome: 2048,
} as const;

export type Habitat = readonly [water: number, cover: number, warm: number, bank: number];

export type Colour = readonly [number, number, number];

export interface ReptileSpecies {
  readonly key: string;
  readonly name: string;
  readonly form: Form;
  readonly realm: number;
  readonly pattern: Pattern;
  readonly length: number;
  readonly adults: number;
  readonly common: number;
  readonly likes: Habitat;
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
  readonly canopy: boolean;
  readonly colour: Colour;
  readonly accent: Colour;
  readonly eye: Colour;
  readonly spots: number;
  readonly girth: number;
  readonly tail: number;
  readonly legs: number;
  readonly bulk: number;
  readonly waves: number;
}

interface Draft {
  key: string;
  name: string;
  form: Form;
  realm?: number;
  pattern: Pattern;
  length: number;
  adults?: number;
  common?: number;
  likes: Habitat;
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
  canopy?: boolean;
  colour: Colour;
  accent: Colour;
  eye?: Colour;
  spots?: number;
  girth?: number;
  tail?: number;
  legs?: number;
  bulk?: number;
  waves?: number;
}

const DARK_EYE: Colour = [0.06, 0.05, 0.04];

const ALL_YEAR: Range = [0, 0.02, 0.98, 1];

const CLIMBERS = new Set(['walllizard', 'gecko', 'chameleon', 'pantherchameleon', 'thornydevil', 'basilisk']);

const make = (draft: Draft): ReptileSpecies => ({
  key: draft.key,
  name: draft.name,
  form: draft.form,
  realm: (draft.realm ?? Realm.Land) | (CLIMBERS.has(draft.key) ? Realm.Cliff : 0),
  pattern: draft.pattern,
  length: draft.length,
  adults: draft.adults ?? 2,
  common: draft.common ?? 0.5,
  likes: draft.likes,
  bias: draft.bias ?? 0,
  temperature: draft.temperature,
  season: draft.season ?? ALL_YEAR,
  day: draft.day,
  night: draft.night,
  dusk: draft.dusk ?? 0,
  shy: draft.shy ?? 0.2,
  rest: draft.rest,
  speed: draft.speed,
  reach: draft.reach,
  skit: draft.skit,
  traits: draft.traits ?? 0,
  canopy: draft.canopy ?? false,
  colour: draft.colour,
  accent: draft.accent,
  eye: draft.eye ?? DARK_EYE,
  spots: draft.spots ?? 0.3,
  girth: draft.girth ?? 0.04,
  tail: draft.tail ?? 0.5,
  legs: draft.legs ?? 1,
  bulk: draft.bulk ?? 0.16,
  waves: draft.waves ?? 0,
});

const LF = Realm.Land | Realm.Fresh;

const T = Trait;

export const REPTILES: readonly ReptileSpecies[] = [
  make({ key: 'grasssnake', name: 'grass snake', form: Form.Snake, realm: LF, pattern: Pattern.Bands, length: 1, adults: 3, common: 0.7, likes: [0.3, 0.3, 0.3, 0.6], temperature: [8, 14, 28, 34], season: [0.05, 0.15, 0.7, 0.85], day: 0.9, night: 0.05, dusk: 0.2, shy: 0.1, rest: 25, speed: 0.7, reach: 4, skit: 3, traits: T.Tongue, colour: [0.36, 0.42, 0.2], accent: [0.09, 0.11, 0.07], spots: 0.4, girth: 0.036 }),
  make({ key: 'adder', name: 'adder', form: Form.Snake, pattern: Pattern.Zigzag, length: 0.6, adults: 2, common: 0.5, likes: [0, 0.4, 0.5, 0.1], temperature: [6, 12, 26, 32], season: [0.05, 0.12, 0.7, 0.82], day: 1, night: 0.05, dusk: 0.3, shy: 0.2, rest: 40, speed: 0.5, reach: 3, skit: 2, traits: T.Tongue, colour: [0.56, 0.5, 0.36], accent: [0.1, 0.08, 0.06], girth: 0.042 }),
  make({ key: 'rattlesnake', name: 'western diamondback rattlesnake', form: Form.Snake, pattern: Pattern.Diamond, length: 1.3, adults: 2, common: 0.45, likes: [0, 0.3, 0.7, 0], temperature: [14, 20, 36, 42], day: 0.5, night: 0.8, dusk: 0.5, shy: 0.4, rest: 50, speed: 0.6, reach: 3, skit: 2.5, traits: T.Rattle | T.Tongue, colour: [0.62, 0.52, 0.34], accent: [0.26, 0.19, 0.11], girth: 0.05 }),
  make({ key: 'sidewinder', name: 'sidewinder', form: Form.Snake, pattern: Pattern.Blotch, length: 0.55, adults: 2, common: 0.5, likes: [0, 0.1, 0.9, 0], temperature: [18, 24, 40, 46], day: 0.2, night: 1, dusk: 0.4, shy: 0.5, rest: 30, speed: 0.9, reach: 5, skit: 3, traits: T.Sidewind | T.Tongue, colour: [0.8, 0.7, 0.46], accent: [0.56, 0.43, 0.26], girth: 0.045, waves: 1.3 }),
  make({ key: 'cobra', name: 'spectacled cobra', form: Form.Snake, pattern: Pattern.Plain, length: 1.8, adults: 2, common: 0.4, likes: [0, 0.4, 0.4, 0.4], temperature: [18, 24, 34, 40], day: 0.8, night: 0.4, dusk: 0.5, shy: 0.3, rest: 35, speed: 0.8, reach: 4, skit: 3, traits: T.Hood | T.Tongue, colour: [0.42, 0.32, 0.18], accent: [0.9, 0.84, 0.66], girth: 0.04 }),
  make({ key: 'kingcobra', name: 'king cobra', form: Form.Snake, realm: LF, pattern: Pattern.Bands, length: 4, adults: 1, common: 0.2, likes: [0, 0.8, 0.1, 0.4], temperature: [20, 25, 33, 38], day: 0.9, night: 0.2, dusk: 0.3, shy: 0.2, rest: 60, speed: 0.9, reach: 6, skit: 3.5, traits: T.Hood | T.Tongue, colour: [0.3, 0.28, 0.12], accent: [0.82, 0.76, 0.5], spots: 0.3, girth: 0.034 }),
  make({ key: 'mamba', name: 'black mamba', form: Form.Snake, pattern: Pattern.Plain, length: 2.5, adults: 1, common: 0.3, likes: [0, 0.2, 0.6, 0.1], temperature: [16, 22, 36, 42], day: 1, night: 0.1, shy: 0.3, rest: 30, speed: 2.2, reach: 7, skit: 4, traits: T.Tongue, colour: [0.34, 0.32, 0.27], accent: [0.16, 0.15, 0.12], girth: 0.026 }),
  make({ key: 'anaconda', name: 'green anaconda', form: Form.Snake, realm: LF, pattern: Pattern.Blotch, length: 5, adults: 1, common: 0.25, likes: [0.8, 0.5, 0.2, 0.7], temperature: [22, 26, 34, 40], day: 0.3, night: 0.8, dusk: 0.8, shy: 0, rest: 70, speed: 0.4, reach: 4, skit: 2, traits: T.Tongue, colour: [0.22, 0.3, 0.12], accent: [0.07, 0.09, 0.05], spots: 0.5, girth: 0.062, waves: 2.2 }),
  make({ key: 'python', name: 'reticulated python', form: Form.Snake, pattern: Pattern.Diamond, length: 5.5, adults: 1, common: 0.2, likes: [0, 0.8, 0.1, 0.3], temperature: [20, 25, 34, 40], day: 0.2, night: 1, dusk: 0.5, shy: 0.1, rest: 90, speed: 0.35, reach: 3, skit: 2, traits: T.Tongue, colour: [0.52, 0.43, 0.2], accent: [0.11, 0.09, 0.05], girth: 0.052, waves: 2.4 }),
  make({ key: 'coralsnake', name: 'coral snake', form: Form.Snake, pattern: Pattern.Bands, length: 0.7, adults: 2, common: 0.35, likes: [0, 0.9, 0.2, 0.2], temperature: [20, 24, 34, 40], day: 0.7, night: 0.3, shy: 0.1, rest: 30, speed: 0.5, reach: 3, skit: 2, colour: [0.84, 0.09, 0.07], accent: [0.97, 0.88, 0.18], spots: 1, girth: 0.03 }),
  make({ key: 'treeboa', name: 'emerald tree boa', form: Form.Snake, pattern: Pattern.Zigzag, length: 1.5, adults: 2, common: 0.35, likes: [0, 0.9, 0, 0.1], temperature: [22, 26, 32, 38], day: 0.1, night: 1, dusk: 0.4, shy: 0, rest: 80, speed: 0.25, reach: 2, skit: 1, traits: T.Tongue, canopy: true, colour: [0.1, 0.56, 0.2], accent: [0.93, 0.95, 0.84], girth: 0.04, waves: 1.6 }),
  make({ key: 'seasnake', name: 'banded sea snake', form: Form.Snake, realm: Realm.Sea, pattern: Pattern.Bands, length: 0.9, adults: 3, common: 0.4, likes: [0, 0.5, 0.7, 0], temperature: [20, 24, 32, 36], day: 0.8, night: 0.5, shy: 0, rest: 12, speed: 0.6, reach: 8, skit: 3, colour: [0.12, 0.13, 0.16], accent: [0.9, 0.82, 0.3], spots: 0.4, girth: 0.034 }),
  make({ key: 'slowworm', name: 'slow worm', form: Form.Snake, pattern: Pattern.Plain, length: 0.35, adults: 3, common: 0.5, likes: [0, 0.7, 0.2, 0], temperature: [6, 12, 24, 30], season: [0.05, 0.12, 0.75, 0.88], day: 0.8, night: 0.1, dusk: 0.4, shy: 0, rest: 30, speed: 0.15, reach: 2, skit: 1.5, colour: [0.62, 0.5, 0.31], accent: [0.4, 0.3, 0.19], girth: 0.05, tail: 0.95 }),

  make({ key: 'walllizard', name: 'common wall lizard', form: Form.Lizard, pattern: Pattern.Spots, length: 0.2, adults: 3, common: 1, likes: [0, 0.25, 0.9, 0.1], temperature: [10, 16, 30, 36], season: [0.05, 0.12, 0.8, 0.92], day: 1, night: 0, shy: 0.4, rest: 8, speed: 1.2, reach: 3, skit: 3.5, colour: [0.5, 0.4, 0.25], accent: [0.22, 0.17, 0.1], spots: 0.4, tail: 0.58, bulk: 0.15 }),
  make({ key: 'greenlizard', name: 'European green lizard', form: Form.Lizard, pattern: Pattern.Spots, length: 0.35, adults: 2, common: 0.6, likes: [0, 0.6, 0.5, 0.1], temperature: [14, 20, 32, 38], season: [0.08, 0.15, 0.78, 0.9], day: 1, night: 0, shy: 0.4, rest: 10, speed: 1.3, reach: 3, skit: 3.5, colour: [0.28, 0.66, 0.15], accent: [0.1, 0.36, 0.08], spots: 0.3, tail: 0.62, bulk: 0.15 }),
  make({ key: 'gecko', name: 'house gecko', form: Form.Lizard, pattern: Pattern.Spots, length: 0.13, adults: 3, common: 0.8, likes: [0, 0.8, 0.3, 0.1], temperature: [18, 24, 38, 44], day: 0.2, night: 1, dusk: 0.5, shy: 0.1, rest: 12, speed: 0.8, reach: 2, skit: 2.5, colour: [0.78, 0.7, 0.56], accent: [0.56, 0.46, 0.36], eye: [0.9, 0.8, 0.3], spots: 0.35, tail: 0.5, bulk: 0.2 }),
  make({ key: 'iguana', name: 'green iguana', form: Form.Lizard, realm: Realm.Land, pattern: Pattern.Plain, length: 1.4, adults: 2, common: 0.35, likes: [0.2, 0.6, 0.3, 0.6], temperature: [22, 26, 34, 40], day: 1, night: 0, shy: 0.3, rest: 40, speed: 0.9, reach: 4, skit: 4, traits: T.Crest | T.Plunge, colour: [0.3, 0.56, 0.18], accent: [0.14, 0.3, 0.1], tail: 0.62, bulk: 0.16 }),
  make({ key: 'marineiguana', name: 'marine iguana', form: Form.Lizard, pattern: Pattern.Plain, length: 1, adults: 3, common: 0.35, likes: [0, 0.1, 0.8, 1], temperature: [18, 22, 30, 34], day: 1, night: 0, shy: 0, rest: 40, speed: 0.4, reach: 3, skit: 2, traits: T.Crest | T.Plunge, colour: [0.12, 0.12, 0.12], accent: [0.56, 0.2, 0.18], tail: 0.55, bulk: 0.18 }),
  make({ key: 'beardeddragon', name: 'bearded dragon', form: Form.Lizard, pattern: Pattern.Blotch, length: 0.5, adults: 2, common: 0.5, likes: [0, 0.2, 0.9, 0], temperature: [20, 26, 40, 46], day: 1, night: 0, shy: 0.3, rest: 30, speed: 0.6, reach: 3, skit: 3, traits: T.Beard | T.Spikes, colour: [0.7, 0.55, 0.32], accent: [0.45, 0.32, 0.18], spots: 0.4, tail: 0.5, bulk: 0.27 }),
  make({ key: 'thornydevil', name: 'thorny devil', form: Form.Lizard, pattern: Pattern.Blotch, length: 0.18, adults: 2, common: 0.5, likes: [-0.5, 0, 1, 0], bias: 0.1, temperature: [20, 26, 40, 46], day: 1, night: 0, shy: 0.4, rest: 20, speed: 0.15, reach: 2, skit: 1.5, traits: T.Spikes, colour: [0.74, 0.5, 0.22], accent: [0.42, 0.23, 0.1], spots: 0.5, tail: 0.35, bulk: 0.36 }),
  make({ key: 'skink', name: 'blue-tongued skink', form: Form.Lizard, pattern: Pattern.Bands, length: 0.45, adults: 2, common: 0.5, likes: [0, 0.5, 0.6, 0.1], temperature: [14, 20, 34, 40], day: 0.9, night: 0.1, shy: 0.2, rest: 25, speed: 0.4, reach: 3, skit: 2.5, traits: T.BlueTongue, colour: [0.64, 0.52, 0.36], accent: [0.34, 0.25, 0.17], spots: 0.5, tail: 0.38, legs: 0.5, bulk: 0.22 }),
  make({ key: 'komodo', name: 'Komodo dragon', form: Form.Lizard, pattern: Pattern.Blotch, length: 2.6, adults: 1, common: 0.2, likes: [0, 0.3, 0.7, 0.3], temperature: [22, 27, 36, 42], day: 1, night: 0.1, dusk: 0.3, shy: 0.2, rest: 60, speed: 0.5, reach: 8, skit: 3, traits: T.Tongue, colour: [0.36, 0.3, 0.22], accent: [0.2, 0.17, 0.12], spots: 0.35, tail: 0.5, bulk: 0.19, legs: 0.85 }),
  make({ key: 'monitor', name: 'Nile monitor', form: Form.Lizard, realm: LF, pattern: Pattern.Spots, length: 1.6, adults: 1, common: 0.3, likes: [0.4, 0.4, 0.4, 0.8], temperature: [20, 25, 36, 42], day: 1, night: 0.1, shy: 0.2, rest: 30, speed: 1, reach: 6, skit: 4, traits: T.Tongue | T.Plunge, colour: [0.22, 0.22, 0.15], accent: [0.82, 0.74, 0.36], spots: 0.4, tail: 0.58, bulk: 0.13 }),
  make({ key: 'basilisk', name: 'basilisk', form: Form.Lizard, realm: LF, pattern: Pattern.Stripe, length: 0.6, adults: 2, common: 0.35, likes: [0.2, 0.5, 0.2, 1], temperature: [22, 26, 34, 40], day: 1, night: 0, shy: 0.3, rest: 14, speed: 1.6, reach: 5, skit: 5, traits: T.Crest | T.Plunge, colour: [0.22, 0.5, 0.15], accent: [0.86, 0.86, 0.5], tail: 0.66, bulk: 0.11 }),
  make({ key: 'chameleon', name: 'veiled chameleon', form: Form.Chameleon, pattern: Pattern.Spots, length: 0.3, adults: 2, common: 0.45, likes: [0, 1, 0.1, 0.1], temperature: [18, 24, 34, 40], day: 1, night: 0, shy: 0.4, rest: 40, speed: 0.08, reach: 1.5, skit: 1, traits: T.Camo, canopy: true, colour: [0.3, 0.62, 0.18], accent: [0.86, 0.7, 0.2], eye: [0.5, 0.6, 0.2], spots: 0.35, tail: 0.5, bulk: 0.17 }),
  make({ key: 'pantherchameleon', name: 'panther chameleon', form: Form.Chameleon, pattern: Pattern.Stripe, length: 0.4, adults: 1, common: 0.3, likes: [0, 1, 0.1, 0.1], temperature: [22, 26, 34, 40], day: 1, night: 0, shy: 0.4, rest: 50, speed: 0.07, reach: 1.5, skit: 1, traits: T.Camo, canopy: true, colour: [0.2, 0.6, 0.56], accent: [0.92, 0.38, 0.2], eye: [0.9, 0.5, 0.2], tail: 0.5, bulk: 0.17 }),

  make({ key: 'pondturtle', name: 'pond slider', form: Form.Turtle, realm: LF, pattern: Pattern.Scutes, length: 0.25, adults: 3, common: 0.9, likes: [0.7, 0.3, 0.6, 0.7], temperature: [10, 18, 32, 38], day: 1, night: 0.1, shy: 0.1, rest: 60, speed: 0.12, reach: 3, skit: 3, traits: T.Plunge, colour: [0.2, 0.3, 0.14], accent: [0.86, 0.8, 0.3], tail: 0.1, bulk: 0.8, legs: 0.8 }),
  make({ key: 'snapper', name: 'snapping turtle', form: Form.Turtle, realm: LF, pattern: Pattern.Scutes, length: 0.4, adults: 2, common: 0.4, likes: [0.8, 0.5, 0.3, 0.4], temperature: [8, 15, 30, 36], day: 0.5, night: 0.6, dusk: 0.5, shy: 0, rest: 80, speed: 0.1, reach: 2, skit: 0, colour: [0.28, 0.24, 0.17], accent: [0.14, 0.12, 0.08], tail: 0.4, bulk: 0.75, legs: 0.9 }),
  make({ key: 'boxturtle', name: 'box turtle', form: Form.Turtle, pattern: Pattern.Scutes, length: 0.17, adults: 3, common: 0.6, likes: [0, 0.8, 0.1, 0.2], temperature: [10, 16, 30, 36], season: [0.05, 0.12, 0.8, 0.92], day: 1, night: 0, shy: 0.1, rest: 50, speed: 0.05, reach: 2, skit: 1, traits: T.Dome, colour: [0.3, 0.2, 0.1], accent: [0.92, 0.72, 0.18], tail: 0.05, bulk: 0.85, legs: 0.6 }),
  make({ key: 'tortoise', name: 'giant tortoise', form: Form.Turtle, pattern: Pattern.Scutes, length: 1.2, adults: 1, common: 0.3, likes: [0, 0.2, 0.7, 0.4], temperature: [18, 23, 33, 38], day: 1, night: 0, shy: 0.2, rest: 100, speed: 0.06, reach: 5, skit: 0, traits: T.Dome, colour: [0.44, 0.4, 0.3], accent: [0.26, 0.22, 0.15], tail: 0.04, bulk: 0.8, legs: 0.8 }),
  make({ key: 'deserttortoise', name: 'desert tortoise', form: Form.Turtle, pattern: Pattern.Scutes, length: 0.3, adults: 2, common: 0.35, likes: [0, 0.4, 0.9, 0], temperature: [15, 22, 38, 44], day: 1, night: 0, shy: 0.3, rest: 80, speed: 0.05, reach: 3, skit: 0, traits: T.Dome, colour: [0.52, 0.42, 0.26], accent: [0.3, 0.22, 0.12], tail: 0.04, bulk: 0.82, legs: 0.7 }),
  make({ key: 'seaturtle', name: 'green sea turtle', form: Form.Turtle, realm: Realm.Sea, pattern: Pattern.Scutes, length: 1, adults: 2, common: 0.5, likes: [0, 0.8, 0.7, 0], temperature: [18, 23, 32, 36], day: 1, night: 0.4, shy: 0, rest: 10, speed: 0.5, reach: 10, skit: 4, traits: T.Flippers, colour: [0.32, 0.38, 0.2], accent: [0.56, 0.46, 0.2], tail: 0.08, bulk: 0.8, legs: 1.2 }),

  make({ key: 'alligator', name: 'American alligator', form: Form.Crocodilian, realm: LF, pattern: Pattern.Ridge, length: 3.5, adults: 1, common: 0.25, likes: [0.8, 0.4, 0.5, 0.8], temperature: [12, 20, 34, 40], day: 0.8, night: 0.6, dusk: 0.6, shy: 0, rest: 90, speed: 0.6, reach: 6, skit: 5, traits: T.Plunge, colour: [0.15, 0.2, 0.12], accent: [0.54, 0.52, 0.3], tail: 0.46, bulk: 0.16, legs: 0.5 }),
  make({ key: 'nilecroc', name: 'Nile crocodile', form: Form.Crocodilian, realm: LF, pattern: Pattern.Ridge, length: 4.5, adults: 1, common: 0.22, likes: [0.8, 0.2, 0.8, 0.9], temperature: [20, 25, 36, 42], day: 0.9, night: 0.5, shy: 0, rest: 100, speed: 0.6, reach: 6, skit: 5, traits: T.Plunge, colour: [0.3, 0.3, 0.18], accent: [0.6, 0.55, 0.3], tail: 0.46, bulk: 0.16, legs: 0.5 }),
  make({ key: 'saltcroc', name: 'saltwater crocodile', form: Form.Crocodilian, realm: LF | Realm.Sea, pattern: Pattern.Ridge, length: 5.2, adults: 1, common: 0.12, likes: [0.6, 0.5, 0.4, 1], temperature: [22, 26, 36, 42], day: 0.8, night: 0.6, shy: 0, rest: 100, speed: 0.7, reach: 8, skit: 5, traits: T.Plunge, colour: [0.28, 0.26, 0.14], accent: [0.62, 0.58, 0.3], tail: 0.46, bulk: 0.17, legs: 0.5 }),
  make({ key: 'caiman', name: 'spectacled caiman', form: Form.Crocodilian, realm: LF, pattern: Pattern.Ridge, length: 1.8, adults: 2, common: 0.35, likes: [0.8, 0.6, 0.4, 0.7], temperature: [22, 26, 34, 40], day: 0.5, night: 0.8, dusk: 0.5, shy: 0, rest: 70, speed: 0.6, reach: 5, skit: 4, traits: T.Plunge, colour: [0.25, 0.28, 0.14], accent: [0.6, 0.55, 0.28], tail: 0.46, bulk: 0.15, legs: 0.55 }),
  make({ key: 'gharial', name: 'gharial', form: Form.Crocodilian, realm: LF, pattern: Pattern.Ridge, length: 4.5, adults: 1, common: 0.15, likes: [0.9, 0.2, 0.7, 0.6], temperature: [18, 24, 36, 42], day: 0.8, night: 0.5, shy: 0, rest: 100, speed: 0.6, reach: 6, skit: 5, traits: T.Plunge, colour: [0.35, 0.36, 0.22], accent: [0.62, 0.6, 0.38], tail: 0.46, bulk: 0.12, legs: 0.4 }),
];

export const REPTILE_COUNT = REPTILES.length;

export const REPTILE_STARTS: readonly number[] = REPTILES.reduce<number[]>((starts, species) => [...starts, (starts[starts.length - 1] ?? 0) + species.adults], [0]);

export const REPTILE_SLOTS = REPTILE_STARTS[REPTILE_COUNT]!;

export const REPTILE_CELL_TILES = 8;

export const REPTILE_TABLE_WIDTH = 12;

export const bodyTexels = (species: ReptileSpecies): number => 3 + 16 * species.length;

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

export const SEA_WATER = 0.05;

export const FRESH_WATER_FROM = 0.1;

export const WET_FROM = 0.03;

export const WET_TO = 0.35;

export const SNOW_FROM = 0.1;

export const SNOW_TO = 0.4;

export const MediumBit = { Land: 1, Fresh: 2, Sea: 4, Cliff: 8 } as const;

export const WATER_PRESENT = 0.004;

export const mediumOf = (habitat: Habitat): number => (habitat[0] <= WATER_PRESENT ? (habitat[0] >= CLIFF_SEEN ? MediumBit.Cliff : MediumBit.Land) : habitat[0] < FRESH_WATER_FROM ? MediumBit.Sea : MediumBit.Fresh);

export const lives = (species: ReptileSpecies, habitat: Habitat): boolean => (species.realm & mediumOf(habitat)) !== 0;

export const activity = (species: ReptileSpecies, daylight: number): number =>
  Math.min(1, Math.max(0, species.night + (species.day - species.night) * daylight + species.dusk * 4 * daylight * (1 - daylight)));

export const sheltering = (species: ReptileSpecies, wet: number): number => 1 - species.shy * smooth(WET_FROM, WET_TO, wet);

export const suitability = (species: ReptileSpecies, habitat: Habitat): number =>
  Math.min(1, Math.max(0, species.bias + species.likes[0] * habitat[0] + species.likes[1] * habitat[1] + species.likes[2] * habitat[2] + species.likes[3] * habitat[3]));

export const warmth = (species: ReptileSpecies, celsius: number): number => trapezoid(species.temperature, celsius);

export function abundance(species: ReptileSpecies, habitat: Habitat, weather: Weather): number {
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

export const slowness = (species: ReptileSpecies, celsius: number): number => 1 - 0.65 * (1 - warmth(species, celsius));

export function tableRow(species: ReptileSpecies): number[] {
  return [
    ...species.likes,
    ...species.temperature,
    ...species.season,
    species.day, species.night, species.dusk, species.shy,
    species.length, species.form, species.pattern, species.girth,
    ...species.colour, species.spots,
    ...species.accent, species.canopy ? 1 : 0,
    ...species.eye, species.bias,
    species.realm, species.rest, species.speed, species.reach,
    species.skit, species.traits, species.tail, species.common,
    species.adults, species.legs, species.bulk, species.waves,
    0, 0, 0, 0,
  ];
}
