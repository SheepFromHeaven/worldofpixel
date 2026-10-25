export const Zone = {
  Polar: 0,
  Tundra: 1,
  Alpine: 2,
  Boreal: 3,
  Steppe: 4,
  Temperate: 5,
  TemperateRainforest: 6,
  Mediterranean: 7,
  Desert: 8,
  Savanna: 9,
  Tropical: 10,
  Rainforest: 11,
} as const;

export type Zone = (typeof Zone)[keyof typeof Zone];

export const ZONE_NAMES: readonly string[] = [
  'polar desert',
  'tundra',
  'alpine',
  'boreal forest',
  'steppe',
  'temperate forest',
  'temperate rainforest',
  'mediterranean scrub',
  'hot desert',
  'savanna',
  'tropical seasonal forest',
  'rainforest',
];

export function zoneOf(celsius: number, rain: number, altitude: number): Zone {
  if (celsius < -6) return Zone.Polar;
  if (altitude > 0.62) return Zone.Alpine;
  if (celsius < 1) return Zone.Tundra;
  if (rain < 5) return celsius < 12 ? Zone.Steppe : Zone.Desert;
  if (celsius < 8) return Zone.Boreal;
  if (celsius < 15) return rain >= 20 ? Zone.TemperateRainforest : rain >= 8 ? Zone.Temperate : Zone.Steppe;
  if (celsius < 21) return rain < 10 ? Zone.Mediterranean : Zone.Temperate;
  if (rain < 7) return Zone.Desert;
  if (rain < 16) return Zone.Savanna;
  return rain < 26 ? Zone.Tropical : Zone.Rainforest;
}
