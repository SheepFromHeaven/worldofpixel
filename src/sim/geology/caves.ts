import { hash3, hashBits, noise2 } from '../rng.ts';
import { Rock, rockOf } from './rocks.ts';

export const Cave = {
  Solid: 0,
  Open: 1,
  Flooded: 2,
  Dripstone: 3,
  Air: 4,
  Water: 5,
} as const;

export type Cave = (typeof Cave)[keyof typeof Cave];

export const Life = {
  Bare: 0,
  Moss: 1,
  Fungus: 2,
  Guano: 3,
  Flowstone: 5,
} as const;

export const LIFE_NAMES: readonly string[] = ['bare floor', 'moss and lichen', 'fungus garden', 'bat guano', 'crystals', 'flowstone'];

export const CAVE_NAMES: readonly string[] = ['solid', 'cave', 'flooded cave', 'dripstone cave', 'open air', 'open water'];

export const CAVE_FROM = 1;

export interface CaveSetting {
  karst: number;
  volcanic: number;
  orogeny: number;
  arid: number;
}

export interface Network {
  spacing: number;
  scale: number;
  radius: number;
  height: number;
  keep: number;
  shafts: number;
  chamber: number;
}

export function lavaTube(rock: number): boolean {
  return rock === Rock.Basalt || rock === Rock.Andesite || rock === Rock.Tuff || rock === Rock.Obsidian;
}

export function networkFor(rock: number, setting: CaveSetting): Network | null {
  if (rock === Rock.Soil || rock === Rock.Clay || rock === Rock.Sand || rock === Rock.Coal || rock === Rock.Salt) return null;
  if (rockOf(rock).soluble) {
    return { spacing: 22, scale: 58, radius: 1.2 + 2 * setting.karst, height: 3 + 2.5 * setting.karst, keep: 0.45 + 0.4 * setting.karst, shafts: 0.6, chamber: 1.9 };
  }
  if (lavaTube(rock)) {
    return { spacing: 15, scale: 90, radius: 1.3 + 2.2 * setting.volcanic, height: 3 + 2 * setting.volcanic, keep: 0.28 + 0.3 * setting.volcanic, shafts: 0.2, chamber: 1.5 };
  }
  if (rock === Rock.Sandstone) return { spacing: 26, scale: 130, radius: 1.1, height: 2.4, keep: 0.22, shafts: 0.15, chamber: 1.3 };
  return { spacing: 30, scale: 150, radius: 0.9 + 1.4 * setting.orogeny, height: 2, keep: 0.12 + 0.25 * setting.orogeny, shafts: 0.3, chamber: 1.3 };
}

interface Cell {
  edge: number;
  vertex: number;
  pair: number;
  triple: number;
}

const cell: Cell = { edge: 0, vertex: 0, pair: 0, triple: 0 };

const unit = (bits: number): number => {
  let k = bits >>> 0;
  k = Math.imul(k ^ (k >>> 16), 0x45d9f3b) >>> 0;
  k = (k ^ (k >>> 16)) >>> 0;
  return k / 4294967296;
};

const salted = (bits: number, salt: number): number => unit(bits ^ Math.imul(salt + 4001, 0x9e3779b1));

function sites(x: number, y: number, scale: number, seed: number): Cell {
  const px = x / scale;
  const py = y / scale;
  const cx = Math.floor(px);
  const cy = Math.floor(py);
  let d1 = Infinity;
  let d2 = Infinity;
  let d3 = Infinity;
  let i1 = 0;
  let i2 = 0;
  let i3 = 0;

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const bits = hashBits(cx + dx, cy + dy, 0, seed);
      const sx = cx + dx + (bits & 1023) / 1023 - px;
      const sy = cy + dy + ((bits >>> 10) & 1023) / 1023 - py;
      const d = sx * sx + sy * sy;
      if (d < d1) {
        d3 = d2;
        i3 = i2;
        d2 = d1;
        i2 = i1;
        d1 = d;
        i1 = bits;
      } else if (d < d2) {
        d3 = d2;
        i3 = i2;
        d2 = d;
        i2 = bits;
      } else if (d < d3) {
        d3 = d;
        i3 = bits;
      }
    }
  }

  const f1 = Math.sqrt(d1);
  cell.edge = (Math.sqrt(d2) - f1) * scale;
  cell.vertex = (Math.sqrt(d3) - f1) * scale;
  cell.pair = (i1 ^ Math.imul(i2, 0x9e3779b1)) >>> 0;
  cell.triple = (i1 ^ i2 ^ i3) >>> 0;
  return cell;
}

const LEVEL_SEED = 1500;

const shaftAt = (found: Cell, level: number, net: Network): boolean => salted(found.triple, level + 9000) < net.shafts;

const chamberAt = (found: Cell, level: number, net: Network): boolean =>
  salted(found.triple, level) < net.keep || shaftAt(found, level, net) || shaftAt(found, level - 1, net);

export function networkOpen(
  px: number,
  py: number,
  elevation: number,
  net: Network,
  seed: number,
  warp: number,
  galleries: boolean,
): boolean {
  const x = px + (noise2(px / 41, py / 41, seed + 1331) - 0.5) * 34;
  const y = py + (noise2(px / 41, py / 41, seed + 1337) - 0.5) * 34;
  const swell = 0.65 + 0.9 * noise2(px / 17, py / 17, seed + 1341);
  const level = (elevation + warp) / net.spacing;
  const home = Math.round(level);
  const local = (level - home) * net.spacing;
  const found = sites(x, y, net.scale, seed + LEVEL_SEED);

  if (galleries && Math.abs(local) < net.height * 0.5) {
    if (salted(found.pair, home) < net.keep && found.edge < net.radius * 2 * swell) return true;
    if (Math.abs(local) < net.height * 0.7 && found.vertex < net.radius * net.chamber * swell && chamberAt(found, home, net)) return true;
  }

  const below = Math.floor(level);
  const gap = (level - below) * net.spacing;
  if (gap > net.height * 0.4 && net.spacing - gap > net.height * 0.4 && found.vertex < net.radius * 1.5 && shaftAt(found, below, net)) return true;

  return false;
}

export function groundwater(elevation: number, head: number): boolean {
  return elevation < head;
}

export function caveAt(
  x: number,
  y: number,
  depth: number,
  elevation: number,
  rock: number,
  setting: CaveSetting,
  seed: number,
  head: number,
): Cave {
  if (depth < CAVE_FROM) return Cave.Solid;
  const own = networkFor(rock, setting);
  const through = setting.karst > 0.3 ? networkFor(Rock.Limestone, setting) : null;
  if (!own && !through) return Cave.Solid;

  const warp = (noise2(x / 140, y / 140, seed + 1311) - 0.5) * 8 + 0.012 * (x * 0.8 + y * 0.6);
  let open = false;
  if (own) open = networkOpen(x, y, elevation, own, seed, warp, true);
  if (!open && through && !rockOf(rock).soluble) open = networkOpen(x, y, elevation, through, seed, warp, false);
  if (!open) return Cave.Solid;

  if (groundwater(elevation, head)) return Cave.Flooded;

  if (rockOf(rock).soluble && hash3(Math.floor(x / 2), Math.floor(y / 2), Math.floor(elevation / 3), seed + 1327) < 0.55) return Cave.Dripstone;
  return Cave.Open;
}
