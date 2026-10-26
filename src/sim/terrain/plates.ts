import { WORLD_SIZE_FACTOR } from '../grid.ts';
import { hash2, LatticeNoise } from '../rng.ts';

export const PLATE_SCALE = WORLD_SIZE_FACTOR;
const S = PLATE_SCALE;

export const PLATE_CELL = 380 * S;
const WARP_WAVE = 210 * S;
const WARP = 70 * S;
const WIGGLE_WAVE = 55 * Math.sqrt(S);
const WIGGLE = 12 * Math.sqrt(S);

export const CONTINENT_SHARE = 0.62;
export const CONTINENT_LIFT = 0.06;
export const OCEAN_DROP = 0.09;

export const COLLISION_RANGE = 0.4;
export const COAST_RANGE = 0.3;
export const RANGE_WIDTH = 50 * S;
export const TRENCH_DEPTH = 0.1;
export const RIFT_DEPTH = 0.14;
export const RIFT_WIDTH = 9 * S;
export const ARC_DISTANCE = 55 * S;
export const ARC_WIDTH = 22 * S;
export const CRATON_AGE = 0.5;

const SCARP_WIDTH = 7 * S;
const PASSIVE_WIDTH = 46 * S;
const CONVERGENT_FROM = 0.25;

export interface Plate {
  x: number;
  y: number;
  continental: boolean;
  age: number;
  vx: number;
  vy: number;
  rank: number;
}

export interface Boundary {
  distance: number;
  convergence: number;
  own: Plate;
  other: Plate;
}

export interface Tectonics {
  lift: number;
  volcanism: number;
  craton: number;
  distance: number;
  convergence: number;
  continental: boolean;
  age: number;
}

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const known = new Map<number, Plate>();
let knownSeed: number | null = null;

export function plateAt(column: number, row: number, seed: number): Plate {
  if (knownSeed !== seed) {
    known.clear();
    knownSeed = seed;
  }
  const key = (column + 4096) * 8192 + (row + 4096);
  let plate = known.get(key);
  if (!plate) {
    plate = makePlate(column, row, seed);
    known.set(key, plate);
  }
  return plate;
}

function makePlate(column: number, row: number, seed: number): Plate {
  const heading = hash2(column, row, seed + 811) * Math.PI * 2;
  const speed = 0.45 + hash2(column, row, seed + 821) * 0.9;
  return {
    x: (column + 0.15 + hash2(column, row, seed + 801) * 0.7) * PLATE_CELL,
    y: (row + 0.15 + hash2(column, row, seed + 807) * 0.7) * PLATE_CELL,
    continental: hash2(column, row, seed + 829) < CONTINENT_SHARE,
    age: hash2(column, row, seed + 839),
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    rank: hash2(column, row, seed + 849),
  };
}

const WARP_X = new LatticeNoise();
const WARP_Y = new LatticeNoise();
const WIGGLE_X = new LatticeNoise();
const WIGGLE_Y = new LatticeNoise();
const RIDGE = new LatticeNoise();

const around: Plate[] = new Array<Plate>(9);
let aroundColumn = Number.NaN;
let aroundRow = Number.NaN;
let aroundSeed = Number.NaN;

function neighbours(column: number, row: number, seed: number): readonly Plate[] {
  if (column !== aroundColumn || row !== aroundRow || seed !== aroundSeed) {
    let at = 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        around[at] = plateAt(column + dx, row + dy, seed);
        at += 1;
      }
    }
    aroundColumn = column;
    aroundRow = row;
    aroundSeed = seed;
  }
  return around;
}

export function boundaryAt(x: number, y: number, seed: number): Boundary {
  const px =
    x +
    (WARP_X.at(x / WARP_WAVE, y / WARP_WAVE, seed + 861) - 0.5) * 2 * WARP +
    (WIGGLE_X.at(x / WIGGLE_WAVE, y / WIGGLE_WAVE, seed + 863) - 0.5) * 2 * WIGGLE;
  const py =
    y +
    (WARP_Y.at(x / WARP_WAVE, y / WARP_WAVE, seed + 867) - 0.5) * 2 * WARP +
    (WIGGLE_Y.at(x / WIGGLE_WAVE, y / WIGGLE_WAVE, seed + 869) - 0.5) * 2 * WIGGLE;

  const column = Math.floor(px / PLATE_CELL);
  const row = Math.floor(py / PLATE_CELL);
  let first: Plate | null = null;
  let second: Plate | null = null;
  let nearest = Infinity;
  let next = Infinity;

  const plates = neighbours(column, row, seed);
  for (let i = 0; i < 9; i += 1) {
    const plate = plates[i]!;
    const gap = (plate.x - px) ** 2 + (plate.y - py) ** 2;
    if (gap < nearest) {
      second = first;
      next = nearest;
      first = plate;
      nearest = gap;
    } else if (gap < next) {
      second = plate;
      next = gap;
    }
  }

  const own = first!;
  const other = second!;
  const between = Math.hypot(other.x - own.x, other.y - own.y);
  const nx = (other.x - own.x) / between;
  const ny = (other.y - own.y) / between;
  const closing = (own.vx - other.vx) * nx + (own.vy - other.vy) * ny;

  return {
    distance: Math.max(0, (next - nearest) / (2 * between)),
    convergence: Math.max(-1, Math.min(1, closing / 0.8)),
    own,
    other,
  };
}

const offsetOf = (plate: Plate): number => (plate.continental ? CONTINENT_LIFT : -OCEAN_DROP);

export function tectonicsAt(x: number, y: number, seed: number): Tectonics {
  const edge = boundaryAt(x, y, seed);
  const { distance, convergence, own, other } = edge;
  const closing = Math.max(0, convergence);
  const opening = Math.max(0, -convergence);
  const width = closing > CONVERGENT_FROM ? SCARP_WIDTH : opening > CONVERGENT_FROM ? PASSIVE_WIDTH : SCARP_WIDTH + 3 * S;
  const step = 0.5 * (1 - smoothstep(0, width, distance));

  let lift = offsetOf(own) + (offsetOf(other) - offsetOf(own)) * step;
  let volcanism = 0;

  const ridge = 0.7 + 0.6 * RIDGE.at(x / (38 * S), y / (38 * S), seed + 871);
  const overriding = own.continental !== other.continental ? own.continental : own.rank > other.rank;

  if (closing > 0) {
    if (own.continental && other.continental) {
      lift += COLLISION_RANGE * closing * ridge * Math.exp(-((distance / RANGE_WIDTH) ** 2));
    } else if (own.continental) {
      lift += COAST_RANGE * closing * ridge * Math.exp(-(((distance - 12 * S) / RANGE_WIDTH) ** 2));
      volcanism = closing * Math.exp(-(((distance - ARC_DISTANCE) / ARC_WIDTH) ** 2));
    } else if (other.continental) {
      lift -= TRENCH_DEPTH * closing * Math.exp(-((distance / (14 * S)) ** 2));
    } else if (overriding) {
      lift += 0.2 * closing * ridge * Math.exp(-(((distance - 28 * S) / (16 * S)) ** 2));
      volcanism = closing * Math.exp(-(((distance - 28 * S) / (16 * S)) ** 2));
    } else {
      lift -= TRENCH_DEPTH * closing * Math.exp(-((distance / (14 * S)) ** 2));
    }
  }

  if (opening > 0) {
    if (own.continental && other.continental) {
      lift -= RIFT_DEPTH * opening * Math.exp(-((distance / RIFT_WIDTH) ** 2));
      lift += 0.05 * opening * Math.exp(-(((distance - 24 * S) / (12 * S)) ** 2));
      volcanism = Math.max(volcanism, 0.5 * opening * Math.exp(-((distance / (14 * S)) ** 2)));
    } else {
      lift += 0.07 * opening * Math.exp(-((distance / (30 * S)) ** 2));
      volcanism = Math.max(volcanism, 0.3 * opening * Math.exp(-((distance / (16 * S)) ** 2)));
    }
  }

  const craton = own.continental && own.age > CRATON_AGE ? smoothstep(14 * S, 50 * S, distance) : 0;

  return { lift, volcanism, craton, distance, convergence, continental: own.continental, age: own.age };
}
