export const Biome = {
  Meadow: 0,
  Forest: 1,
  Highland: 2,
  Marsh: 3,
  Tundra: 4,
  Desert: 5,
  Ocean: 6,
  Lake: 7,
  River: 8,
} as const;

export type Biome = (typeof Biome)[keyof typeof Biome];

export const BIOMES: readonly Biome[] = [
  Biome.Meadow,
  Biome.Forest,
  Biome.Highland,
  Biome.Marsh,
  Biome.Tundra,
  Biome.Desert,
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
  'ocean',
  'lake',
  'river',
];

export interface Environment {
  temperature: number;
  humidity: number;
  elevation: number;
}
