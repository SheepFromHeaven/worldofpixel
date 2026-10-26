import { Biome } from '../types.ts';
import { hash2, hash3, LatticeNoise, noise2, noise3, spread2, spread3 } from '../rng.ts';
import { PEAK_METRES } from '../terrain/climate.ts';
import { SEA_LEVEL } from '../terrain/heightmap.ts';
import { volcanoesNear } from '../terrain/landforms.ts';
import { PLATE_SCALE, tectonicsAt } from '../terrain/plates.ts';
import type { TileGrid } from '../grid.ts';
import { Cave, caveAt, Life } from './caves.ts';
import { Water } from '../terrain/hydrology.ts';
import type { CaveSetting } from './caves.ts';
import type { Feature, MineralKind } from './minerals.ts';
import { FEATURES, featureIndex, Form, MINERAL_COUNT, MINERALS, MINERALS_BY_HOST, Mineral } from './minerals.ts';
import { Rock, rockOf } from './rocks.ts';
import { layerAt, SEQUENCES, Series } from './sequences.ts';

export const COARSE = 4;
export const LEVEL_METRES = 2;
export const LEVELS = 64;
export const STEP_METRES = 2;
export const BOTTOM_METRES = -300;
export const SEA_FLOOR_METRES = 3000;
export const AIR = 255;
export const CAVE_LIMIT = 600;
export const TABLE_SLOPE = 0.03;

export interface Sample {
  rock: number;
  mineral: number;
  cave: number;
  above: number;
  life: number;
}

export interface Column {
  soil: number;
  surface: number;
  series: string;
  basement: number;
  cover: number;
  levels: Sample[];
}

const clamp = (value: number, low = 0, high = 1): number => (value < low ? low : value > high ? high : value);

const F_PLUTONIC = featureIndex('plutonic');
const F_VOLCANIC = featureIndex('volcanic');
const F_METAMORPHIC = featureIndex('metamorphic');
const F_BASIN = featureIndex('basin');
const F_ARID = featureIndex('arid');
const F_WET = featureIndex('wet');
const F_HOT = featureIndex('hot');
const F_KARST = featureIndex('karst');
const F_CRATON = featureIndex('craton');
const F_ARC = featureIndex('arc');

const RICHNESS = MINERALS.filter((mineral) => mineral.id !== Mineral.None).map((mineral) => ({
  id: mineral.id,
  features: Int32Array.from(mineral.likes, ([name]) => featureIndex(name)),
  weights: Float64Array.from(mineral.likes, ([, weight]) => weight),
}));

const WARP_X = new LatticeNoise();
const WARP_Y = new LatticeNoise();

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const metresOf = (height: number): number =>
  height >= SEA_LEVEL ? ((height - SEA_LEVEL) / (1 - SEA_LEVEL)) * PEAK_METRES : ((height - SEA_LEVEL) / SEA_LEVEL) * SEA_FLOOR_METRES;

const CONTACT: Readonly<Record<number, Rock>> = {
  [Rock.Limestone]: Rock.Marble,
  [Rock.Chalk]: Rock.Marble,
  [Rock.Sandstone]: Rock.Quartzite,
  [Rock.Shale]: Rock.Slate,
  [Rock.Slate]: Rock.Schist,
};

export function relaxTable(head: Float32Array, columns: number, rows: number, cellTiles: number): void {
  const slope = TABLE_SLOPE * cellTiles;
  const relax = (at: number, from: number, step: number): void => {
    const reach = head[from]! + slope * step;
    if (reach < head[at]!) head[at] = reach;
  };
  for (let pass = 0; pass < 3; pass += 1) {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const at = row * columns + column;
        if (column > 0) relax(at, at - 1, 1);
        if (row > 0) {
          relax(at, at - columns, 1);
          if (column > 0) relax(at, at - columns - 1, Math.SQRT2);
          if (column < columns - 1) relax(at, at - columns + 1, Math.SQRT2);
        }
      }
    }
    for (let row = rows - 1; row >= 0; row -= 1) {
      for (let column = columns - 1; column >= 0; column -= 1) {
        const at = row * columns + column;
        if (column < columns - 1) relax(at, at + 1, 1);
        if (row < rows - 1) {
          relax(at, at + columns, 1);
          if (column < columns - 1) relax(at, at + columns + 1, Math.SQRT2);
          if (column > 0) relax(at, at + columns - 1, Math.SQRT2);
        }
      }
    }
  }
}

export interface GeologyField {
  readonly height: Float32Array;
  readonly wet: Float32Array;
  readonly temperature: Float32Array;
  readonly climate: Uint8Array;
  readonly water: Uint8Array;
  readonly surface: Float32Array;
}

export interface GeologyOptions {
  top?: number;
  floor?: (x: number, y: number) => number;
}

export interface GeologyHost {
  readonly seed: number;
  readonly grid: TileGrid;
  readonly field: GeologyField;
  readonly river: Uint8Array;
}

export interface CoarseFields {
  columns: number;
  rows: number;
  features: Uint8Array;
  series: Uint8Array;
  soil: Uint8Array;
  soilRock: Uint8Array;
  surfaceRock: Uint8Array;
}

export class Geology {
  readonly columns: number;
  readonly rows: number;
  readonly top: number;
  private readonly world: GeologyHost;
  private surfaceRock: Uint8Array | null = null;
  readonly seed: number;
  private readonly features: Uint8Array;
  private readonly richness: Uint8Array;
  private readonly smooth: Float32Array;
  private readonly offset: Float32Array;
  private readonly series: Uint8Array;
  private readonly basement: Uint8Array;
  private readonly cover: Uint16Array;
  private readonly fold: Uint8Array;
  private readonly soil: Uint8Array;
  private readonly soilRock: Uint8Array;
  private readonly head: Float32Array;

  private readonly floor: ((x: number, y: number) => number) | null;

  constructor(world: GeologyHost, options: GeologyOptions = {}) {
    this.world = world;
    this.seed = world.seed;
    this.floor = options.floor ?? null;
    this.top = options.top ?? peakMetres(world);
    const { grid } = world;
    this.columns = Math.ceil(grid.columns / COARSE);
    this.rows = Math.ceil(grid.rows / COARSE);
    const count = this.columns * this.rows;
    this.features = new Uint8Array(count * FEATURES.length);
    this.richness = new Uint8Array(count * MINERAL_COUNT);
    this.smooth = new Float32Array(count);
    this.offset = new Float32Array(count);
    this.series = new Uint8Array(count);
    this.basement = new Uint8Array(count);
    this.cover = new Uint16Array(count);
    this.fold = new Uint8Array(count);
    this.soil = new Uint8Array(count);
    this.soilRock = new Uint8Array(count);
    this.head = new Float32Array(count);
    this.build();
    this.buildHead();
  }

  private coarse(x: number, y: number): number {
    const { grid } = this.world;
    const wx = x + (WARP_X.at(x / 17, y / 17, this.seed + 941) - 0.5) * 12;
    const wy = y + (WARP_Y.at(x / 17, y / 17, this.seed + 947) - 0.5) * 12;
    const column = Math.min(this.columns - 1, Math.floor(grid.column(wx) / COARSE));
    const row = Math.min(this.rows - 1, Math.floor(grid.row(wy) / COARSE));
    return row * this.columns + column;
  }

  private blend(values: Float32Array, x: number, y: number): number {
    const { grid } = this.world;
    const fx = (x - grid.minX) / (grid.spacing * COARSE) - 0.5;
    const fy = (y - grid.minY) / (grid.spacing * COARSE) - 0.5;
    const c0 = Math.min(this.columns - 1, Math.max(0, Math.floor(fx)));
    const r0 = Math.min(this.rows - 1, Math.max(0, Math.floor(fy)));
    const c1 = Math.min(this.columns - 1, c0 + 1);
    const r1 = Math.min(this.rows - 1, r0 + 1);
    const u = clamp(fx - c0);
    const v = clamp(fy - r0);
    const top = values[r0 * this.columns + c0]! * (1 - u) + values[r0 * this.columns + c1]! * u;
    const bottom = values[r1 * this.columns + c0]! * (1 - u) + values[r1 * this.columns + c1]! * u;
    return top * (1 - v) + bottom * v;
  }

  private build(): void {
    const { grid, field } = this.world;
    const { seed } = this;
    const count = this.columns * this.rows;
    const regional = new Float32Array(count);
    const slope = new Float32Array(count);

    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        let sum = 0;
        let taken = 0;
        for (let dy = 0; dy < COARSE; dy += 1) {
          for (let dx = 0; dx < COARSE; dx += 1) {
            const c = column * COARSE + dx;
            const r = row * COARSE + dy;
            if (c >= grid.columns || r >= grid.rows) continue;
            sum += field.height[r * grid.columns + c]!;
            taken += 1;
          }
        }
        this.smooth[row * this.columns + column] = metresOf(sum / taken);
      }
    }

    this.blur(this.smooth, regional, 6);

    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const at = row * this.columns + column;
        const left = this.smooth[row * this.columns + Math.max(0, column - 1)]!;
        const right = this.smooth[row * this.columns + Math.min(this.columns - 1, column + 1)]!;
        const up = this.smooth[Math.max(0, row - 1) * this.columns + column]!;
        const down = this.smooth[Math.min(this.rows - 1, row + 1) * this.columns + column]!;
        slope[at] = Math.max(Math.abs(right - left), Math.abs(down - up)) / (2 * COARSE);
      }
    }

    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const at = row * this.columns + column;
        const tileColumn = Math.min(grid.columns - 1, column * COARSE + COARSE / 2);
        const tileRow = Math.min(grid.rows - 1, row * COARSE + COARSE / 2);
        const tile = tileRow * grid.columns + tileColumn;
        const x = grid.x(tileColumn);
        const y = grid.y(tileRow);

        const t = tectonicsAt(x, y, seed);
        const closing = Math.max(0, t.convergence);
        const opening = Math.max(0, -t.convergence);
        const orogeny = t.continental ? closing * Math.exp(-((t.distance / (75 * PLATE_SCALE)) ** 2)) : 0;
        const arc = clamp(t.volcanism);
        let volcanic = clamp(arc * 1.3 + opening * Math.exp(-((t.distance / (30 * PLATE_SCALE)) ** 2)) * 0.4);
        for (const cone of volcanoesNear(x, y, seed)) {
          const near = 1 - Math.hypot(x - cone.x, y - cone.y) / (cone.radius * 1.8);
          if (near > volcanic) volcanic = clamp(near);
        }
        const plutonic = t.continental ? clamp(orogeny * 1.1 + arc * 0.6 + (spread2(noise2(x / 220, y / 220, seed + 901)) - 0.7) * 1.4) : 0;
        const metamorphic = t.continental ? clamp(orogeny * 1.5 - 0.1) : 0;
        const smoothM = this.smooth[at]!;
        const basin = t.continental
          ? (1 - Math.exp(-((t.distance / (70 * PLATE_SCALE)) ** 2))) * (1 - clamp(smoothM / 2600)) * (1 - 0.4 * t.craton)
          : 0;
        const wetness = field.wet[tile]!;
        const arid = 1 - clamp(wetness / 22);
        const wet = clamp(wetness / 30);
        const hot = clamp((field.temperature[tile]! - 8) / 18);
        const karst = smoothstep(0.55, 0.8, spread2(noise2(x / 260, y / 260, seed + 907))) * (basin > 0.12 ? 1 : 0.3);
        const craton = t.craton;

        const base = at * FEATURES.length;
        const { features } = this;
        features[base + F_PLUTONIC] = Math.round(clamp(plutonic) * 255);
        features[base + F_VOLCANIC] = Math.round(clamp(volcanic) * 255);
        features[base + F_METAMORPHIC] = Math.round(clamp(metamorphic) * 255);
        features[base + F_BASIN] = Math.round(clamp(basin) * 255);
        features[base + F_ARID] = Math.round(clamp(arid) * 255);
        features[base + F_WET] = Math.round(clamp(wet) * 255);
        features[base + F_HOT] = Math.round(clamp(hot) * 255);
        features[base + F_KARST] = Math.round(clamp(karst) * 255);
        features[base + F_CRATON] = Math.round(clamp(craton) * 255);
        features[base + F_ARC] = Math.round(clamp(arc) * 255);

        const pick = noise2(x / 300, y / 300, seed + 911);
        let series: number;
        if (!t.continental) series = Series.Ocean;
        else if (volcanic > 0.42) series = Series.Volcanic;
        else if (metamorphic > 0.42) series = Series.Belt;
        else if (basin < 0.06) series = Series.Shelf;
        else if (craton > 0.5 && pick < 0.45) series = Series.Iron;
        else if (arid > 0.7) series = basin > 0.25 && pick > 0.6 ? Series.Evaporite : pick > 0.3 ? Series.RedBeds : Series.Platform;
        else if (wet > 0.33 && smoothM < 450) series = Series.Coal;
        else if (karst > 0.25) series = pick > 0.35 ? Series.Karst : Series.Downs;
        else series = pick > 0.82 ? Series.Downs : Series.Platform;
        this.series[at] = series;

        let cover = t.continental ? 14 + 520 * basin ** 1.2 : 45;
        if (series === Series.Volcanic) cover = 220;
        if (series === Series.Belt) cover = 280;
        this.cover[at] = Math.round(cover);

        this.basement[at] = t.continental ? (t.age > 0.5 || craton > 0.3 ? Rock.Gneiss : Rock.Granite) : Rock.Basalt;
        this.fold[at] = Math.round(clamp((12 + 130 * orogeny) / 200) * 255);

        const offset = regional[at]! - smoothM + (noise2(x / 150, y / 150, seed + 913) - 0.5) * 60;
        this.offset[at] = Math.min(cover * 0.9, Math.max(-cover * 0.3, offset));

        const biome = this.world.field.climate[tile]!;
        const steep = clamp((slope[at]! - 8) / 30);
        let soil = (0.3 + 2.2 * wet) * (1 - steep);
        let soilRock: number = Rock.Soil;
        if (biome === Biome.Desert) {
          soilRock = Rock.Sand;
          soil = 1.5 + 2.5 * (1 - steep);
        } else if (biome === Biome.Marsh || this.world.river[tile] !== 0) {
          soilRock = Rock.Clay;
          soil = 1.5 + 1.5 * wet;
        } else if (biome === Biome.Highland || biome === Biome.Tundra) soil *= 0.4;
        this.soil[at] = Math.round(clamp(soil / 6) * 255);
        this.soilRock[at] = soilRock;

        for (const kind of RICHNESS) {
          let rich = 0;
          for (let k = 0; k < kind.features.length; k += 1) rich += kind.weights[k]! * features[base + kind.features[k]!]! / 255;
          this.richness[at * MINERAL_COUNT + kind.id] = Math.round(clamp(rich) * 255);
        }
      }
    }
  }

  private buildHead(): void {
    const { grid, field } = this.world;
    const { columns, rows, head, smooth } = this;
    const wetness = (at: number): number => this.features[at * FEATURES.length + F_ARID]! / 255;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const at = row * columns + column;
        let source = Infinity;
        let standing = false;
        for (let dy = 0; dy < COARSE; dy += 1) {
          for (let dx = 0; dx < COARSE; dx += 1) {
            const c = column * COARSE + dx;
            const r = row * COARSE + dy;
            if (c >= grid.columns || r >= grid.rows) continue;
            const tile = r * grid.columns + c;
            if (field.water[tile] === Water.Ocean) {
              source = Math.min(source, 0);
              standing = true;
            } else if (field.water[tile] !== 0) {
              source = Math.min(source, metresOf(field.surface[tile]!));
              standing = true;
            } else if (this.world.river[tile] !== 0) source = Math.min(source, Math.max(0, metresOf(field.height[tile]!) - 1));
          }
        }
        const dry = Math.max(-20, smooth[at]! - (4 + 70 * wetness(at)));
        head[at] = standing ? source : Math.min(dry, source);
      }
    }

    if (this.floor) {
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const at = row * columns + column;
          const floor = this.floor(grid.x(Math.min(grid.columns - 1, column * COARSE + COARSE / 2)), grid.y(Math.min(grid.rows - 1, row * COARSE + COARSE / 2)));
          if (floor < head[at]!) head[at] = floor;
        }
      }
    }

    relaxTable(head, columns, rows, COARSE);
  }

  tableAt(x: number, y: number): number {
    return this.blend(this.head, x, y);
  }

  private blur(source: Float32Array, out: Float32Array, radius: number): void {
    const { columns, rows } = this;
    const pass = new Float32Array(source.length);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        let sum = 0;
        let taken = 0;
        for (let d = -radius; d <= radius; d += 1) {
          const c = column + d;
          if (c < 0 || c >= columns) continue;
          sum += source[row * columns + c]!;
          taken += 1;
        }
        pass[row * columns + column] = sum / taken;
      }
    }
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        let sum = 0;
        let taken = 0;
        for (let d = -radius; d <= radius; d += 1) {
          const r = row + d;
          if (r < 0 || r >= rows) continue;
          sum += pass[r * columns + column]!;
          taken += 1;
        }
        out[row * columns + column] = sum / taken;
      }
    }
  }

  featureAt(x: number, y: number, feature: Feature): number {
    return this.features[this.coarse(x, y) * FEATURES.length + featureIndex(feature)]! / 255;
  }

  seriesAt(x: number, y: number): number {
    return this.series[this.coarse(x, y)]!;
  }

  soilAt(x: number, y: number): number {
    return (this.soil[this.coarse(x, y)]! / 255) * 6;
  }

  private bedrock(x: number, y: number, depth: number, at: number): number {
    const { seed } = this;
    const cover = this.cover[at]!;
    const amplitude = (this.fold[at]! / 255) * 200;
    const fold = amplitude * ((noise2(x / 70, y / 70, seed + 921) - 0.5) * 2 + 0.4 * (noise2(x / 28, y / 28, seed + 923) - 0.5) * 2);
    const heading = noise2(x / 400, y / 400, seed + 929) * Math.PI * 2;
    const tilt = 0.05 + (amplitude / 200) * 0.25;
    const dip = tilt * (x * Math.cos(heading) + y * Math.sin(heading)) * 0.15;
    const sd = Math.max(0, depth + this.blend(this.offset, x, y) + fold + dip);

    const sequence = SEQUENCES[this.series[at]!]!;
    const scale = Math.min(2.2, Math.max(0.35, cover / sequence.total));
    let rock: number = layerAt(sequence, sd, scale) ?? this.basement[at]!;

    const plutonic = this.features[at * FEATURES.length + F_PLUTONIC]! / 255;
    if (plutonic > 0.05) {
      const g = this.smooth[at]! - depth;
      const blob = spread3(noise3(x / 70, y / 70, g / 50, seed + 931)) * 0.6;
      if (blob < plutonic * 0.55) rock = Rock.Granite;
      else if (blob < plutonic * 0.55 + 0.05) rock = CONTACT[rock] ?? rock;
    }

    const volcanic = this.features[at * FEATURES.length + F_VOLCANIC]! / 255;
    if (volcanic > 0.1 && Math.abs(noise2((x + y * 0.3) / 45, (y - x * 0.2) / 45, seed + 937) - 0.5) < 0.006 * (0.5 + volcanic * 1.5)) rock = Rock.Basalt;

    return rock;
  }

  private mineral(x: number, y: number, depth: number, rock: number, at: number): number {
    const hosted = MINERALS_BY_HOST[rock];
    if (!hosted) return Mineral.None;
    const { seed } = this;
    for (const kind of hosted) {
      if (depth < kind.from || depth > kind.to) continue;
      const rich = this.richness[at * MINERAL_COUNT + kind.id]! / 255;
      if (rich < 0.05) continue;
      if (this.occurs(kind, x, y, depth, rock, rich, at, seed)) return kind.id;
    }
    return Mineral.None;
  }

  private occurs(kind: MineralKind, x: number, y: number, depth: number, rock: number, rich: number, at: number, seed: number): boolean {
    const salt = seed + kind.id * 977;
    const strength = kind.share * rich * (rock === Rock.Ironstone ? 1.8 : 1);
    switch (kind.form) {
      case Form.Vein: {
        const sheet = spread3(noise3(x / kind.scale, y / kind.scale, depth / (kind.scale * 0.55), salt));
        return Math.abs(sheet - 0.5) < strength && spread2(noise2(x / 7, y / 7, salt + 5)) > 0.3;
      }
      case Form.Bed:
        return spread3(noise3(x / (kind.scale * 8), y / (kind.scale * 8), depth / kind.scale, salt)) > 1 - strength;
      case Form.Nodule:
      case Form.Geode:
        return blob(x, y, depth, kind.scale, salt, strength, kind.form === Form.Geode ? 0.42 : 0.36);
      case Form.Crust:
        return spread2(noise2(x / kind.scale, y / kind.scale, salt)) > 1 - strength;
      case Form.Fumarole: {
        const volcanic = this.features[at * FEATURES.length + F_VOLCANIC]! / 255;
        return volcanic > 0.35 && spread2(noise2(x / kind.scale, y / kind.scale, salt)) > 1 - strength * volcanic;
      }
      case Form.Pipe: {
        const cell = kind.scale;
        const column = Math.floor(x / cell);
        const row = Math.floor(y / cell);
        if (hash2(column, row, salt) > 0.6) return false;
        const cx = (column + 0.2 + hash2(column, row, salt + 1) * 0.6) * cell;
        const cy = (row + 0.2 + hash2(column, row, salt + 2) * 0.6) * cell;
        const radius = 5 + hash2(column, row, salt + 3) * 7;
        if (Math.hypot(x - cx, y - cy) > radius) return false;
        return hash3(Math.floor(x), Math.floor(y), Math.floor(depth / LEVEL_METRES), salt) < strength * 12;
      }
      case Form.Guano:
        return false;
    }
  }

  private waterTop(tile: number): number {
    const { field } = this.world;
    return field.water[tile] === Water.Ocean ? 0 : metresOf(field.surface[tile]!);
  }

  sample(x: number, y: number, elevation: number, out: Sample): Sample {
    const { grid, field } = this.world;
    const tile = grid.atPoint({ x, y });
    const ground = metresOf(field.height[tile]!);

    if (elevation > ground) {
      const under = this.coarse(x, y);
      const below = Math.max(0, this.blend(this.smooth, x, y) - (ground - 0.5));
      out.rock = 0.5 < (this.soil[under]! / 255) * 6 ? this.soilRock[under]! : this.bedrock(x, y, below, under);
      out.life = 0;
      out.mineral = Mineral.None;
      out.above = elevation - ground;
      out.cave = field.water[tile] !== 0 && elevation <= this.waterTop(tile) ? Cave.Water : Cave.Air;
      return out;
    }

    out.above = 0;
    out.life = 0;
    const at = this.coarse(x, y);
    const below = ground - elevation;
    const depth = Math.max(0, this.blend(this.smooth, x, y) - elevation);
    const soil = (this.soil[at]! / 255) * 6;
    const rock = below < soil ? this.soilRock[at]! : this.bedrock(x, y, depth, at);
    out.rock = rock;

    const setting = this.settingAt(at);
    out.cave = depth < CAVE_LIMIT ? caveAt(x, y, depth, elevation, rock, setting, this.seed, this.blend(this.head, x, y)) : Cave.Solid;
    out.mineral = Mineral.None;
    if (out.cave === Cave.Open || out.cave === Cave.Dripstone) out.life = this.lifeOf(x, y, depth, rock, setting, out.cave);
    if (out.cave === Cave.Solid) out.mineral = this.mineral(x, y, depth, rock, at);
    else if (out.cave === Cave.Open || out.cave === Cave.Dripstone) {
      const guano = MINERALS[Mineral.Saltpetre]!;
      if (guano.hosts.includes(rock as Rock) && setting.arid > 0.4 && hash3(Math.floor(x), Math.floor(y), Math.floor(elevation / STEP_METRES), this.seed + 1409) < guano.share * setting.arid) {
        out.mineral = Mineral.Saltpetre;
      }
    }
    return out;
  }

  groundAt(x: number, y: number): number {
    const { grid, field } = this.world;
    return metresOf(field.height[grid.atPoint({ x, y })]!);
  }

  sampleBelow(x: number, y: number, metres: number, out: Sample): Sample {
    return this.sample(x, y, this.groundAt(x, y) - metres, out);
  }

  private lifeOf(x: number, y: number, depth: number, rock: number, setting: CaveSetting, cave: number): number {
    const wet = this.featureAt(x, y, 'wet');
    const { seed } = this;
    if (depth < 18 && wet > 0.12 && spread2(noise2(x / 9, y / 9, seed + 1601)) > 0.45) return Life.Moss;
    if (depth >= 8 && wet > 0.22 && spread2(noise2(x / 13, y / 13, seed + 1607)) > 0.68) return Life.Fungus;
    if (setting.arid > 0.35 && depth >= 8 && spread2(noise2(x / 11, y / 11, seed + 1613)) > 0.7 && (rockOf(rock).soluble || rock === Rock.Sandstone)) return Life.Guano;
    if (cave === Cave.Dripstone && spread2(noise2(x / 15, y / 15, seed + 1619)) > 0.55) return Life.Flowstone;
    return Life.Bare;
  }

  private settingAt(at: number): CaveSetting {
    const f = (name: Feature): number => this.features[at * FEATURES.length + featureIndex(name)]! / 255;
    return { karst: f('karst'), volcanic: f('volcanic'), orogeny: f('metamorphic'), arid: f('arid') };
  }

  coarseAt(x: number, y: number): number {
    return this.coarse(x, y);
  }

  bedrockAt(x: number, y: number): number {
    return this.bedrock(x, y, 0, this.coarse(x, y));
  }

  coarseFields(): CoarseFields {
    if (this.surfaceRock === null) {
      const { grid } = this.world;
      const rocks = new Uint8Array(this.columns * this.rows);
      for (let row = 0; row < this.rows; row += 1) {
        for (let column = 0; column < this.columns; column += 1) {
          const x = grid.x(Math.min(grid.columns - 1, column * COARSE + COARSE / 2));
          const y = grid.y(Math.min(grid.rows - 1, row * COARSE + COARSE / 2));
          const at = row * this.columns + column;
          rocks[at] = this.bedrock(x, y, 0, at);
        }
      }
      this.surfaceRock = rocks;
    }
    return {
      columns: this.columns,
      rows: this.rows,
      features: this.features,
      series: this.series,
      soil: this.soil,
      soilRock: this.soilRock,
      surfaceRock: this.surfaceRock,
    };
  }

  surface(x: number, y: number): number {
    const at = this.coarse(x, y);
    return this.soil[at]! > 0 ? this.soilRock[at]! : this.bedrock(x, y, 0, at);
  }

  column(x: number, y: number): Column {
    const at = this.coarse(x, y);
    const levels: Sample[] = [];
    for (let level = 1; level <= LEVELS; level += 1) levels.push(this.sampleBelow(x, y, level * LEVEL_METRES, { rock: 0, mineral: 0, cave: 0, above: 0, life: 0 }));
    return {
      soil: this.soilAt(x, y),
      surface: this.bedrock(x, y, 0, at),
      series: SEQUENCES[this.series[at]!]!.name,
      basement: this.basement[at]!,
      cover: this.cover[at]!,
      levels,
    };
  }

  placer(x: number, y: number): boolean {
    const gold = MINERALS[Mineral.Gold]!;
    const at = this.coarse(x, y);
    const { grid } = this.world;
    const tile = grid.atPoint({ x, y });
    if (tile < 0 || this.world.river[tile] === 0) return false;
    const rich = this.richness[at * MINERAL_COUNT + Mineral.Gold]! / 255;
    return hash2(Math.floor(x / 3), Math.floor(y / 3), this.seed + 1423) < gold.share * rich * 30;
  }
}

function blob(x: number, y: number, depth: number, scale: number, seed: number, strength: number, radius: number): boolean {
  const cx = Math.floor(x / scale);
  const cy = Math.floor(y / scale);
  const cz = Math.floor(depth / scale);
  if (hash3(cx, cy, cz, seed) >= strength) return false;
  const px = (cx + 0.25 + hash3(cx, cy, cz, seed + 1) * 0.5) * scale;
  const py = (cy + 0.25 + hash3(cx, cy, cz, seed + 2) * 0.5) * scale;
  const pz = (cz + 0.25 + hash3(cx, cy, cz, seed + 3) * 0.5) * scale;
  return Math.hypot(x - px, y - py, depth - pz) < radius * scale;
}

const peaks = new Map<number, number>();

export function peakMetres(world: GeologyHost): number {
  const known = peaks.get(world.seed);
  if (known !== undefined) return known;
  let high = 0;
  const { height: heights } = world.field;
  for (let i = 0; i < heights.length; i += 1) if (heights[i]! > high) high = heights[i]!;
  const metres = Math.ceil(metresOf(high) / STEP_METRES) * STEP_METRES;
  peaks.clear();
  peaks.set(world.seed, metres);
  return metres;
}

export const sliceCount = (world: GeologyHost): number => Math.ceil((peakMetres(world) - BOTTOM_METRES) / STEP_METRES);

export const sliceElevation = (world: GeologyHost, slice: number): number => peakMetres(world) - slice * STEP_METRES;

let kept: Geology | null = null;

export function adoptGeology(geology: Geology): void {
  kept = geology;
}

export function geologyOf(world: GeologyHost): Geology {
  if (kept === null || kept.seed !== world.seed) kept = new Geology(world);
  return kept;
}
