import type { Bounds } from '../sim/geometry.ts';
import { TILE } from '../sim/grid.ts';
import type { Biome } from '../sim/types.ts';
import type { World } from '../sim/world.ts';

export type Material = 'meadow' | 'forest' | 'highland' | 'marsh' | 'tundra' | 'desert' | 'path';

export const MATERIALS: readonly (Material | null)[] = [
  'meadow',
  'forest',
  'highland',
  'marsh',
  'tundra',
  'desert',
  null,
  null,
  null,
];

export const materialOf = (biome: Biome): Material | null => MATERIALS[biome] ?? null;

export const MIPS = 4;

export interface Variant {
  name: string;
  mips: Uint8Array[];
}

export interface Grain {
  salt: number;
  scale: number;
  cover: number;
}

export interface DecalSprite {
  grain?: readonly Grain[];
  name: string;
  width: number;
  height: number;
  foot: { x: number; y: number };
  density: Partial<Record<Material, number>>;
  stands: boolean;
  cells: Uint32Array;
}

export interface GroundSprites {
  size: number;
  steps: number;
  priority: readonly Material[];
  variants: Map<string, Variant[]>;
  masks: Map<Material, Uint8Array[]>;
  decals: DecalSprite[];
}

interface Manifest {
  texture: number;
  steps: number;
  stepGrey: number;
  priority: Material[];
  textures: { name: string; material: Material; ridge?: string; x: number; y: number }[];
  masks: { material: Material; x: number; y: number }[];
  decals: {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    foot: { x: number; y: number };
    density: Partial<Record<Material, number>>;
    stands: boolean;
  }[];
}

export const RIDGES = ['ns', 'ew', 'nesw', 'nwse'] as const;

let loaded: GroundSprites | null = null;
let started = false;
let version = 0;

export const groundVersion = (): number => version;

export function provideGroundSprites(sprites: GroundSprites): void {
  loaded = sprites;
  started = true;
  version += 1;
}

export function groundSprites(): GroundSprites | null {
  if (!started && typeof document !== 'undefined') {
    started = true;
    load().then(
      (sprites) => {
        loaded = sprites;
        version += 1;
      },
      () => undefined,
    );
  }
  return loaded;
}

async function sheet(name: string): Promise<{ data: Uint8ClampedArray; width: number }> {
  const image = new Image();
  image.src = `/ground/${name}.png`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no canvas');
  ctx.drawImage(image, 0, 0);
  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width };
}

function square(from: { data: Uint8ClampedArray; width: number }, x: number, y: number, size: number): Uint8Array {
  const out = new Uint8Array(size * size);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      out[row * size + column] = from.data[((y + row) * from.width + x + column) * 4]!;
    }
  }
  return out;
}

function halve(cells: Uint8Array, size: number): Uint8Array {
  const half = size / 2;
  const out = new Uint8Array(half * half);
  for (let y = 0; y < half; y += 1) {
    for (let x = 0; x < half; x += 1) {
      const at = y * 2 * size + x * 2;
      out[y * half + x] = Math.round((cells[at]! + cells[at + 1]! + cells[at + size]! + cells[at + size + 1]!) / 4);
    }
  }
  return out;
}

export function mipsOf(cells: Uint8Array, size: number): Uint8Array[] {
  const mips = [cells];
  for (let level = 1; level < MIPS; level += 1) mips.push(halve(mips[level - 1]!, size >> (level - 1)));
  return mips;
}

async function load(): Promise<GroundSprites> {
  const manifest = (await (await fetch('/ground/ground.json')).json()) as Manifest;
  const [textures, masks, decals] = await Promise.all([sheet('textures'), sheet('masks'), sheet('decals')]);
  const size = manifest.texture;

  const variants = new Map<string, Variant[]>();
  const add = (key: string, variant: Variant): void => {
    const list = variants.get(key) ?? [];
    list.push(variant);
    variants.set(key, list);
  };
  for (const entry of manifest.textures) {
    const steps = square(textures, entry.x, entry.y, size).map((grey) => Math.round(grey / manifest.stepGrey));
    const variant = { name: entry.name, mips: mipsOf(steps, size) };
    if (entry.material === 'desert') {
      for (const ridge of RIDGES) if (!entry.ridge || entry.ridge === ridge) add(`desert:${ridge}`, variant);
    } else {
      add(entry.material, variant);
    }
  }

  return {
    size,
    steps: manifest.steps,
    priority: manifest.priority,
    variants,
    masks: new Map(manifest.masks.map((entry) => [entry.material, mipsOf(square(masks, entry.x, entry.y, size), size)])),
    decals: manifest.decals.map((entry) => {
      const cells = new Uint32Array(entry.width * entry.height);
      for (let y = 0; y < entry.height; y += 1) {
        for (let x = 0; x < entry.width; x += 1) {
          const at = ((entry.y + y) * decals.width + entry.x + x) * 4;
          cells[y * entry.width + x] =
            ((decals.data[at]! << 24) | (decals.data[at + 1]! << 16) | (decals.data[at + 2]! << 8) | decals.data[at + 3]!) >>> 0;
        }
      }
      return { ...entry, cells };
    }),
  };
}

export interface Placement {
  decal: DecalSprite;
  material: Material;
  x: number;
  y: number;
  flip: boolean;
  wind: number;
}

function hash(x: number, y: number, salt: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export const isTree = (decal: DecalSprite): boolean => decal.name.startsWith('tree.');

const FAMILY: readonly string[] = ['', '', '', 'bush.', 'tree.', 'boulder.', 'fallen.'];

const families = new WeakMap<readonly DecalSprite[], Map<string, DecalSprite[]>>();

function familyFor(decals: readonly DecalSprite[], prefix: string, material: Material): DecalSprite[] {
  let byKey = families.get(decals);
  if (!byKey) {
    byKey = new Map();
    families.set(decals, byKey);
  }
  const key = `${prefix}|${material}`;
  const known = byKey.get(key);
  if (known) return known;

  const list = decals.filter(
    (decal) => decal.name.startsWith(prefix) && (decal.density[material] ?? 0) > 0,
  );
  byKey.set(key, list);
  return list;
}

function pickFrom(list: readonly DecalSprite[], material: Material, roll: number): DecalSprite | null {
  let total = 0;
  for (const decal of list) total += decal.density[material] ?? 0;
  if (total <= 0) return null;

  let left = roll * total;
  for (const decal of list) {
    left -= decal.density[material] ?? 0;
    if (left < 0) return decal;
  }
  return list[list.length - 1] ?? null;
}

const SPREAD: Record<string, number> = { 'tree.': 1.7, 'bush.': 1, 'boulder.': 0.6, 'fallen.': 1.7 };

const WORN_BARE = 96;

function standingOn(
  world: World,
  decals: readonly DecalSprite[],
  column: number,
  row: number,
  index: number,
  material: Material,
): Placement | null {
  const prefix = FAMILY[world.cover[index]!];
  if (!prefix) return null;

  const decal = pickFrom(familyFor(decals, prefix, material), material, hash(column, row, 17));
  if (!decal) return null;

  const { grid } = world;
  const spread = SPREAD[prefix] ?? 0.34;
  return {
    decal,
    material,
    x: grid.x(column) + (hash(column, row, 29) - 0.5) * TILE * spread,
    y: grid.y(row) + (hash(column, row, 37) - 0.5) * TILE * spread,
    flip: hash(column, row, 53) < 0.5,
    wind: world.wind[index]! / 255,
  };
}

function valueNoise(x: number, y: number, salt: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, salt);
  const b = hash(ix + 1, iy, salt);
  const c = hash(ix, iy + 1, salt);
  const d = hash(ix + 1, iy + 1, salt);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const MAX_GAIN = 4;

const gains = new WeakMap<readonly Grain[], number>();

function patchiness(seed: number, grain: readonly Grain[], column: number, row: number): number {
  let weight = 1;
  let gain = gains.get(grain);
  if (gain === undefined) {
    gain = Math.min(MAX_GAIN, 1 / grain.reduce((all, layer) => all * layer.cover, 1));
    gains.set(grain, gain);
  }

  for (const layer of grain) {
    const near = valueNoise(column / layer.scale, row / layer.scale, layer.salt * 977 + seed);
    const fine = valueNoise(column / (layer.scale * 0.43), row / (layer.scale * 0.43), layer.salt * 331 + seed + 11);
    const level = near * 0.7 + fine * 0.3;
    const edge = 0.5 + (0.5 - layer.cover) * 0.55;
    const t = Math.min(1, Math.max(0, (level - edge) / 0.1));
    weight *= t * t * (3 - 2 * t);
    if (weight === 0) return 0;
  }
  return weight * gain;
}

function marksOn(
  world: World,
  decals: readonly DecalSprite[],
  column: number,
  row: number,
  index: number,
  material: Material,
  out: Placement[],
): void {
  const worn = world.wear[index]! >= WORN_BARE;
  const { grid } = world;
  const x = grid.x(column);
  const y = grid.y(row);

  decals.forEach((decal, at) => {
    if (decal.stands) return;
    const base = decal.density[worn ? 'path' : material] ?? 0;
    if (base <= 0) return;
    const density = decal.grain ? base * patchiness(world.seed, decal.grain, column, row) : base;
    if (density <= 0) return;

    const count = Math.floor(density + hash(column, row, at * 7 + 1));
    for (let n = 0; n < count; n += 1) {
      const angle = hash(column, row, at * 31 + n * 7 + 2) * Math.PI * 2;
      const reach = Math.sqrt(hash(column, row, at * 31 + n * 7 + 3)) * TILE * 0.42;
      out.push({
        decal,
        material,
        x: x + Math.cos(angle) * reach,
        y: y + Math.sin(angle) * reach,
        flip: hash(column, row, at * 31 + n * 7 + 9) < 0.5,
        wind: world.wind[index]! / 255,
      });
    }
  });
}

const REACH = 3;

export function placementsIn(
  world: World,
  sprites: GroundSprites,
  bounds: Bounds,
  stands: boolean,
): Placement[] {
  const { grid } = world;
  const out: Placement[] = [];

  const firstColumn = Math.max(0, grid.column(bounds.minX) - REACH);
  const lastColumn = Math.min(grid.columns - 1, grid.column(bounds.maxX) + REACH);
  const firstRow = Math.max(0, grid.row(bounds.minY) - 1);
  const lastRow = Math.min(grid.rows - 1, grid.row(bounds.maxY) + REACH);

  for (let row = firstRow; row <= lastRow; row += 1) {
    const at = row * grid.columns;
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const index = at + column;
      const material = MATERIALS[world.biome[index]!];
      if (!material) continue;

      if (stands) {
        const placement = standingOn(world, sprites.decals, column, row, index, material);
        if (placement) out.push(placement);
      } else {
        marksOn(world, sprites.decals, column, row, index, material, out);
      }
    }
  }

  return out.sort((a, b) => a.y - b.y || a.x - b.x);
}

export interface DecalCells {
  width: number;
  height: number;
  foot: { x: number; y: number };
  cells: Uint32Array;
}

const halvings = new Map<string, DecalCells>();

export function decalCells(decal: DecalSprite, mip: number): DecalCells {
  if (mip === 0) return { width: decal.width, height: decal.height, foot: decal.foot, cells: decal.cells };
  const key = `${decal.name}|${mip}`;
  const known = halvings.get(key);
  if (known) return known;

  const above = decalCells(decal, mip - 1);
  const width = Math.ceil(above.width / 2);
  const height = Math.ceil(above.height / 2);
  const cells = new Uint32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let colours = 0;
      let grounds = 0;
      let deepest = 0xff;
      let r = 0;
      let g = 0;
      let b = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        const sx = x * 2 + dx;
        const sy = y * 2 + dy;
        if (sx >= above.width || sy >= above.height) continue;
        const cell = above.cells[sy * above.width + sx]!;
        const alpha = cell & 0xff;
        if (alpha === 0) continue;
        if (alpha === 0xff) {
          colours += 1;
          r += (cell >>> 24) & 0xff;
          g += (cell >>> 16) & 0xff;
          b += (cell >>> 8) & 0xff;
        } else {
          grounds += 1;
          deepest = Math.min(deepest, alpha);
        }
      }
      if (colours + grounds < 2) continue;
      cells[y * width + x] =
        grounds > colours
          ? deepest
          : ((Math.round(r / colours) << 24) | (Math.round(g / colours) << 16) | (Math.round(b / colours) << 8) | 0xff) >>> 0;
    }
  }

  const halved = { width, height, foot: { x: Math.floor(above.foot.x / 2), y: Math.floor(above.foot.y / 2) }, cells };
  halvings.set(key, halved);
  return halved;
}

export function standsIn(
  world: World,
  decals: readonly DecalSprite[],
  firstColumn: number,
  lastColumn: number,
  firstRow: number,
  lastRow: number,
): Placement[] {
  const { grid } = world;
  const out: Placement[] = [];

  for (let row = Math.max(0, firstRow); row <= Math.min(grid.rows - 1, lastRow); row += 1) {
    for (let column = Math.max(0, firstColumn); column <= Math.min(grid.columns - 1, lastColumn); column += 1) {
      const index = row * grid.columns + column;
      if (!FAMILY[world.cover[index]!]) continue;
      const material = MATERIALS[world.biome[index]!];
      if (!material) continue;
      const placement = standingOn(world, decals, column, row, index, material);
      if (placement) out.push(placement);
    }
  }

  return out;
}

export function marksIn(
  world: World,
  decals: readonly DecalSprite[],
  firstColumn: number,
  lastColumn: number,
  firstRow: number,
  lastRow: number,
): Placement[] {
  const { grid } = world;
  const out: Placement[] = [];

  for (let row = Math.max(0, firstRow); row <= Math.min(grid.rows - 1, lastRow); row += 1) {
    for (let column = Math.max(0, firstColumn); column <= Math.min(grid.columns - 1, lastColumn); column += 1) {
      const index = row * grid.columns + column;
      const material = MATERIALS[world.biome[index]!];
      if (!material) continue;
      marksOn(world, decals, column, row, index, material, out);
    }
  }

  return out;
}

let lit = false;

export const propsLit = (): boolean => lit;

export function setPropsLit(value: boolean): void {
  if (lit === value) return;
  lit = value;
  version += 1;
}
