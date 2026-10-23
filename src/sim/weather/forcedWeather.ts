export type ForcedWeather = 'clear' | 'rain' | 'thunder' | 'snow' | 'storm' | 'sand';

export const FORCED_WEATHER_CHOICES: readonly (ForcedWeather | null)[] = [
  null,
  'clear',
  'rain',
  'thunder',
  'snow',
  'storm',
  'sand',
];

export function forcedAirTemperature(forced: ForcedWeather | null, celsius: number): number {
  switch (forced) {
    case 'sand':
      return Math.max(celsius, 18);
    case 'rain':
      return Math.max(celsius, 8);
    case 'thunder':
      return Math.max(celsius, 16);
    case 'snow':
      return Math.min(celsius, -6);
    case 'storm':
      return Math.max(celsius, 6);
    default:
      return celsius;
  }
}

export function forcedOvercast(forced: ForcedWeather | null, overcast: number): number {
  if (forced === 'clear') return 0;
  if (forced === 'sand') return Math.min(overcast, 0.2);
  return overcast;
}

export function forcedDust(forced: ForcedWeather | null, dust: number, gustNoise: number): number {
  if (forced === 'clear') return 0;
  if (forced === 'sand') return 0.85 + 0.15 * gustNoise;
  return dust;
}

export function forcedCloudWater(forced: ForcedWeather | null, cloudWater: number): number {
  switch (forced) {
    case 'clear':
      return cloudWater * 0.8;
    case 'sand':
      return Math.min(cloudWater, 0.15);
    case 'rain':
      return Math.max(cloudWater, 0.72);
    case 'thunder':
      return Math.max(cloudWater, 1.2);
    case 'snow':
      return Math.max(cloudWater, 0.85);
    case 'storm':
      return Math.max(cloudWater, 1.35);
    default:
      return cloudWater;
  }
}
