import type { Range } from '../plants/species.ts';

export const Form = { Quad: 0, Long: 1, Rodent: 2, Bat: 3, Whale: 4, Dolphin: 5, Seal: 6, Primate: 7, Roo: 8, Sirenian: 9, Beluga: 10 } as const;

export type Form = (typeof Form)[keyof typeof Form];

export const Gait = { Walk: 0, Trot: 1, Hop: 2, Bound: 3, Swim: 4, Cruise: 5, Porpoise: 6, Fly: 7, Burrow: 8 } as const;

export type Gait = (typeof Gait)[keyof typeof Gait];

export const Social = { Solo: 0, Family: 1, Herd: 2, Pack: 3, Colony: 4, Pod: 5, Troop: 6, Harem: 7 } as const;

export type Social = (typeof Social)[keyof typeof Social];

export const Horn = { None: 0, Antler: 1, Curl: 2, Straight: 3, Lyre: 4, Short: 5, Cow: 6, Rhino: 7, Tusk: 8, Knob: 9, Palm: 10 } as const;

export type Horn = (typeof Horn)[keyof typeof Horn];

export const Pattern = { Plain: 0, Spots: 1, Stripes: 2, Patches: 3, Mask: 4, Saddle: 5, Bands: 6, Fleck: 7 } as const;

export type Pattern = (typeof Pattern)[keyof typeof Pattern];

export const Trait = {
  Mane: 1,
  Hump: 2,
  Quills: 4,
  Armour: 8,
  Trunk: 16,
  Tusks: 32,
  Pouch: 64,
  Ears: 128,
  Bushy: 256,
  Snout: 512,
  Flippers: 1024,
  Housed: 2048,
  Dorsal: 4096,
  Spout: 8192,
  Bill: 16384,
  Glide: 32768,
  Climb: 65536,
  Burrow: 131072,
  Sentinel: 262144,
  Back: 524288,
  Breach: 1048576,
  Ruff: 2097152,
  Tube: 4194304,
  LongEars: 8388608,
} as const;

export type Habitat = readonly [number, number, number, number];

export type Colour = readonly [number, number, number];

export interface Draft {
  key: string;
  name: string;
  form: Form;
  gait: Gait;
  social?: Social;
  realm?: number;
  size?: number;
  groups?: number;
  sight?: number;
  length: number;
  height: number;
  likes: Habitat;
  wet?: Habitat;
  bias?: number;
  rough?: number;
  soil?: number;
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
  horn?: Horn;
  hornSize?: number;
  hornBoth?: boolean;
  pattern?: Pattern;
  colour: Colour;
  accent?: Colour;
  eye?: Colour;
  spots?: number;
  bulk?: number;
  neck?: number;
  head?: number;
  legs?: number;
  tail?: number;
  ears?: number;
  rut?: number;
  dive?: number;
}
