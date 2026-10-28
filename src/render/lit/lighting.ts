import type { CalendarMoment } from '../../sim/calendar.ts';
import type { Place } from '../../sim/daylight.ts';
import { daylightAt, smooth } from '../../sim/daylight.ts';

export type Rgb = readonly [number, number, number];

export interface PointLight {
  id: number;
  x: number;
  y: number;
  reach: number;
  strength: number;
  color: Rgb;
  source?: 'fire' | 'hand';
  wind?: number;
}

export interface Lighting {
  toward: Rgb;
  sun: Rgb;
  moonToward: Rgb;
  moon: Rgb;
  ambient: Rgb;
  gloom: number;
  tint: Rgb;
  sunShadow: number;
  moonShadow: number;
  daylight: number;
  fog: number;
  cover: number;
  fogColor: Rgb;
  cloudColor: Rgb;
  drift: readonly [number, number];
  seasonalShaderTable: Float32Array;
  fallingLeaves: readonly [number, number];
  blowingPetals: readonly [number, number];
  leafLitter: readonly [number, number];
  wind: number;
  points: readonly PointLight[];
  moment: CalendarMoment;
}

export const MAX_POINTS = 8;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const NOON: Rgb = [1, 0.97, 0.88];
const HORIZON: Rgb = [1, 0.6, 0.36];
const MOONLIGHT: Rgb = [0.62, 0.72, 1];
const DAY_AMBIENT: Rgb = [0.27, 0.3, 0.41];
const NIGHT_AMBIENT: Rgb = [0.05, 0.07, 0.15];
const NIGHT_TINT: Rgb = [0.04, 0.07, 0.18];

const fract = (value: number): number => value - Math.floor(value);

export const noiseAt = (a: number, b: number): number => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

export function seasonTint(phase: number): readonly [number, number] {
  const autumn = smooth(0.5, 0.6, phase) * (1 - smooth(0.68, 0.78, phase));
  const winter = smooth(0.72, 0.82, phase) * (1 - smooth(0.95, 1, phase));
  return [autumn, winter];
}

const fogTime = (clock: number): number => {
  const burn = smooth(0.3, 0.5, clock);
  const gather = smooth(0.65, 0.85, clock);
  if (clock < 0.5) return 1 - 0.88 * burn;
  return 0.12 + 0.88 * gather;
};

const coverAt = (time: number): number =>
  Math.min(1, Math.max(0, 0.5 + 0.35 * Math.sin(time * 0.9 + 1) + 0.25 * Math.sin(time * 2.3 + 4)));

const FOG_DAY: Rgb = [0.84, 0.87, 0.9];
const FOG_NIGHT: Rgb = [0.1, 0.13, 0.21];
const CLOUD_DAY: Rgb = [1, 0.98, 0.94];
const CLOUD_NIGHT: Rgb = [0.1, 0.13, 0.24];

export type SkyLight = Omit<Lighting, 'points' | 'wind' | 'drift' | 'seasonalShaderTable' | 'fallingLeaves' | 'blowingPetals' | 'leafLitter' | 'moment'>;

const bright = (value: number): number => Math.min(1, Math.max(0, value));

export function skyAt(moment: CalendarMoment, place: Place): SkyLight {
  const { clock, sun, moon, daylight, moonLight, gloom } = daylightAt(moment, place);

  const high = bright(sun.up / 0.9);
  const warmth = (1 - high) ** 1.5;
  const strength = daylight * (1 + 0.25 * high);
  const colour = mix(NOON, HORIZON, warmth);
  const night = mix(NIGHT_AMBIENT, [0.09, 0.12, 0.22], moonLight);

  return {
    toward: [sun.east, sun.south, sun.up],
    sun: [colour[0] * strength, colour[1] * strength, colour[2] * strength],
    moonToward: [moon.east, moon.south, moon.up],
    moon: [MOONLIGHT[0] * moonLight * 0.5, MOONLIGHT[1] * moonLight * 0.5, MOONLIGHT[2] * moonLight * 0.5],
    ambient: mix(night, DAY_AMBIENT, daylight),
    gloom,
    tint: NIGHT_TINT,
    daylight,
    fog: fogTime(clock),
    cover: coverAt(moment.completedDays + moment.timeOfDay),
    fogColor: mix(mix(FOG_NIGHT, [0.2, 0.24, 0.34], moonLight), mix(FOG_DAY, HORIZON, warmth * 0.35), daylight),
    cloudColor: mix(mix(CLOUD_NIGHT, [0.28, 0.33, 0.48], moonLight), mix(CLOUD_DAY, HORIZON, warmth * 0.45), daylight),
    sunShadow: 0.4 * daylight,
    moonShadow: 0.34 * moonLight * (1 - daylight),
  };
}

const wave = (time: number, id: number): number => {
  const base = Math.floor(time);
  const f = time - base;
  const u = f * f * (3 - 2 * f);
  return noiseAt(base, id) * (1 - u) + noiseAt(base + 1, id) * u;
};

const GALE_METRES_PER_SECOND = 12;
const GUST_FROM = 0.45;
const GUST_TO = 0.9;

const smoothBetween = (from: number, to: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

export function flickered(points: readonly PointLight[], seconds: number): PointLight[] {
  return points.map((light) => {
    const gale = Math.min(1.2, (light.wind ?? 0) / GALE_METRES_PER_SECOND);
    const stormy = gale * gale;
    const gust = smoothBetween(GUST_FROM, GUST_TO, wave(seconds * (1.6 + 2.4 * gale) + 13, light.id * 4.1)) * (0.55 + 0.45 * wave(seconds * 9.5, light.id * 2.9));
    const dip = Math.min(0.85, stormy * 1.1 * gust);
    const unsteady = 1 + (wave(seconds * 8.7 + 11, light.id * 5.9) - 0.5) * 0.32 * (1 + 3.5 * gale);
    const reachShake = 1 + (wave(seconds * 6.3 + 3, light.id * 2.3) - 0.5) * 0.12 * (1 + 3 * gale);
    return {
      ...light,
      reach: light.reach * (0.96 + 0.08 * wave(seconds * 1.8, light.id)) * reachShake * (1 - 0.3 * gale) * (1 - 0.4 * dip),
      strength: light.strength * (0.9 + 0.2 * wave(seconds * 2.6 + 7, light.id * 3.1)) * Math.max(0.12, unsteady) * (1 - 0.4 * gale) * (1 - dip),
    };
  });
}
