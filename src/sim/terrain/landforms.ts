import { hash2, noise2 } from '../rng.ts';
import { tectonicsAt } from './plates.ts';

export const CLIFF_HEIGHT = 0.05;
export const CLIFF_RISE = 0.005;
const CLIFF_WAVE = 420;
const CLIFF_SHARE = 0.5;

export const MESA_STEP = 0.075;
export const MESA_FROM = 0.03;
export const MESA_TO = 0.5;
const MESA_WAVE = 760;
const MESA_SHARE = 0.34;
const MESA_SHARPNESS = 0.07;
const MESA_TILT = 0.12;
const MESA_DETAIL_LOSS = 0.7;

export const CANYON_DEPTH = 0.08;
const CANYON_WAVE = 240;
const CANYON_WARP_WAVE = 120;
const CANYON_WARP = 70;
const CANYON_FINE_WAVE = 70;
const CANYON_FINE = 0.25;
const CANYON_WIDTH = 5;
const CANYON_WALL = 6;
const CANYON_FROM = 0.06;

export const VOLCANO_CELL = 150;
const VOLCANO_BASE = 0.025;
const VOLCANO_GAIN = 1.1;

export interface Volcano {
  x: number;
  y: number;
  radius: number;
  height: number;
  crater: number;
}

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const province = (x: number, y: number, wave: number, seed: number, share: number): number =>
  smoothstep(1 - share - 0.06, 1 - share + 0.06, noise2(x / wave, y / wave, seed));

export function cliffMask(x: number, y: number, seed: number): number {
  return province(x, y, CLIFF_WAVE, seed + 101, CLIFF_SHARE);
}

export function mesaMask(x: number, y: number, seed: number): number {
  return province(x, y, MESA_WAVE, seed + 203, MESA_SHARE);
}

export function canyonMask(x: number, y: number, seed: number): number {
  return province(x, y, MESA_WAVE * 1.3, seed + 307, MESA_SHARE);
}

function canyonField(x: number, y: number, seed: number): number {
  const wx = (noise2(x / CANYON_WARP_WAVE, y / CANYON_WARP_WAVE, seed + 411) - 0.5) * 2 * CANYON_WARP;
  const wy = (noise2(x / CANYON_WARP_WAVE, y / CANYON_WARP_WAVE, seed + 523) - 0.5) * 2 * CANYON_WARP;
  const wide = noise2((x + wx) / CANYON_WAVE, (y + wy) / CANYON_WAVE, seed + 619);
  const fine = noise2((x + wx) / CANYON_FINE_WAVE, (y + wy) / CANYON_FINE_WAVE, seed + 631);
  return Math.abs(wide + (fine - 0.5) * CANYON_FINE - 0.5) * 2;
}

export function canyonDistance(x: number, y: number, seed: number): number {
  const here = canyonField(x, y, seed);
  const gx = (canyonField(x + 2, y, seed) - canyonField(x - 2, y, seed)) / 4;
  const gy = (canyonField(x, y + 2, seed) - canyonField(x, y - 2, seed)) / 4;
  return here / Math.max(Math.hypot(gx, gy), 1e-4);
}

export function terraced(altitude: number): number {
  const steps = altitude / MESA_STEP;
  const floor = Math.floor(steps);
  const rest = steps - floor;
  const riser = smoothstep(0.5 - MESA_SHARPNESS, 0.5 + MESA_SHARPNESS, rest);
  return (floor + riser * (1 - MESA_TILT) + rest * MESA_TILT) * MESA_STEP;
}

const sites = new Map<number, Map<number, Volcano | null>>();

function siteOf(c: number, r: number, seed: number): Volcano | null {
  let known = sites.get(seed);
  if (!known) {
    sites.clear();
    known = new Map();
    sites.set(seed, known);
  }
  const key = (c + 4096) * 8192 + (r + 4096);
  const cached = known.get(key);
  if (cached !== undefined) return cached;

  const x = (c + 0.2 + hash2(c, r, seed + 719) * 0.6) * VOLCANO_CELL;
  const y = (r + 0.2 + hash2(c, r, seed + 727) * 0.6) * VOLCANO_CELL;
  const chance = Math.min(0.92, VOLCANO_BASE + VOLCANO_GAIN * tectonicsAt(x, y, seed).volcanism);
  const volcano =
    hash2(c, r, seed + 701) > chance
      ? null
      : {
          x,
          y,
          radius: 30 + hash2(c, r, seed + 709) * 40,
          height: 0.34 + hash2(c, r, seed + 733) * 0.16,
          crater: 0.1 + hash2(c, r, seed + 739) * 0.07,
        };
  known.set(key, volcano);
  return volcano;
}

export function volcanoesNear(x: number, y: number, seed: number): Volcano[] {
  const found: Volcano[] = [];
  const column = Math.floor(x / VOLCANO_CELL);
  const row = Math.floor(y / VOLCANO_CELL);

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const volcano = siteOf(column + dx, row + dy, seed);
      if (volcano) found.push(volcano);
    }
  }

  return found;
}

export function coneAt(volcano: Volcano, x: number, y: number, seed: number): number {
  const lobes = noise2(x / 55, y / 55, seed + 743) - 0.5;
  const dx = x - volcano.x;
  const dy = y - volcano.y;
  const reach = Math.hypot(dx, dy) / (volcano.radius * (1 + lobes * 0.7));
  if (reach >= 1) return 0;

  const swirl = noise2(x / 60, y / 60, seed + 747) * 6;
  const gully = 0.5 + 0.5 * Math.cos(Math.atan2(dy, dx) * 11 + swirl);
  const rough = (noise2(x / 14, y / 14, seed + 751) - 0.5) * 0.08 + (noise2(x / 5, y / 5, seed + 757) - 0.5) * 0.03;
  const flank = (1 - reach) ** 1.55 * (1 - 0.12 * gully * smoothstep(0.2, 0.55, reach));

  if (reach > volcano.crater) {
    const rim = smoothstep(volcano.crater, volcano.crater * 1.8, reach);
    return Math.max(0, flank * (0.82 + 0.18 * rim) + rough * Math.min(1, flank * 3));
  }

  const bowl = reach / volcano.crater;
  const floor = (1 - volcano.crater) ** 1.55 * 0.82;
  const wall = 1 - 0.34 * (1 - bowl * bowl);
  return Math.max(0, floor * wall + rough * 0.5);
}

export function volcanic(net: number, sea: number, inland: number, x: number, y: number, seed: number): number {
  let height = net;
  for (const volcano of volcanoesNear(x, y, seed)) {
    const profile = coneAt(volcano, x, y, seed);
    if (profile <= 0) continue;
    const weight = smoothstep(0, 0.3, profile) * inland;
    height += (sea + volcano.height * profile - height) * weight;
  }
  return height;
}

export function shaped(
  net: number,
  broad: number,
  sea: number,
  inland: number,
  craton: number,
  x: number,
  y: number,
  seed: number,
): number {
  let height = volcanic(net, sea, inland, x, y, seed);
  if (height <= sea) return height;

  const mesa = Math.max(mesaMask(x, y, seed), craton * 0.9);
  if (mesa > 0) {
    const altitude = broad - sea;
    if (altitude > MESA_FROM && altitude < MESA_TO) {
      const stepped = terraced(altitude - MESA_FROM) + MESA_FROM;
      const fade = smoothstep(MESA_FROM, MESA_FROM + 0.02, altitude) * (1 - smoothstep(MESA_TO - 0.05, MESA_TO, altitude));
      height += (stepped - altitude - (net - broad) * MESA_DETAIL_LOSS) * mesa * fade;
    }
  }

  const canyons = canyonMask(x, y, seed);
  if (canyons > 0) {
    const altitude = height - sea;
    if (altitude > CANYON_FROM) {
      const line = canyonDistance(x, y, seed);
      const cut = 1 - smoothstep(CANYON_WIDTH, CANYON_WIDTH + CANYON_WALL, line);
      const reach = smoothstep(CANYON_FROM, CANYON_FROM + 0.05, altitude);
      height -= CANYON_DEPTH * cut * reach * canyons;
    }
  }

  const cliffs = cliffMask(x, y, seed);
  if (cliffs > 0) {
    height += CLIFF_HEIGHT * cliffs * smoothstep(0, CLIFF_RISE, height - sea);
  }

  return height;
}
