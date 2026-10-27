export const Biome = {
  Meadow: 0,
  Forest: 1,
  Highland: 2,
  Marsh: 3,
  Tundra: 4,
  Desert: 5,
  Rock: 6,
  Karst: 7,
  Volcanic: 8,
  Salt: 9,
  Badlands: 10,
  Ocean: 11,
  Lake: 12,
  River: 13,
} as const;

export type Biome = (typeof Biome)[keyof typeof Biome];

export const BIOMES: readonly Biome[] = [
  Biome.Meadow,
  Biome.Forest,
  Biome.Highland,
  Biome.Marsh,
  Biome.Tundra,
  Biome.Desert,
  Biome.Rock,
  Biome.Karst,
  Biome.Volcanic,
  Biome.Salt,
  Biome.Badlands,
  Biome.Ocean,
  Biome.Lake,
  Biome.River,
];

export const BIOME_NAMES: readonly string[] = [
  'meadow',
  'forest',
  'highland',
  'marsh',
  'tundra',
  'desert',
  'bare rock',
  'karst',
  'volcanic',
  'salt flat',
  'badlands',
  'ocean',
  'lake',
  'river',
];

export interface Environment {
  temperature: number;
  humidity: number;
  elevation: number;
}
