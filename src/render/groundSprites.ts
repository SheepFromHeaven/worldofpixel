import type { Bounds } from '../sim/geometry.ts';
import type { Grain } from '../sim/patchiness.ts';
import { patchiness } from '../sim/patchiness.ts';
import { TILE } from '../sim/grid.ts';
import { AQUA_NAMES } from '../sim/aquatic.ts';
import { Cover } from '../sim/covers.ts';
import { stageOfPlant } from '../sim/plants/growth.ts';
import { wetNear } from '../sim/terrain/worldfield.ts';
import type { Biome } from '../sim/types.ts';
import type { World } from '../sim/world.ts';

export type Material = 'meadow' | 'forest' | 'highland' | 'marsh' | 'tundra' | 'desert' | 'rock' | 'karst' | 'volcanic' | 'salt' | 'badlands' | 'path';

export const MATERIALS: readonly (Material | null)[] = [
  'meadow',
  'forest',
  'highland',
  'marsh',
  'tundra',
  'desert',
  'rock',
  'karst',
  'volcanic',
  'salt',
  'badlands',
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

export function hash(x: number, y: number, salt: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export type { Grain };
export { patchiness };

export const isTree = (decal: DecalSprite): boolean => decal.name.startsWith('tree.');

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

const weightOf = (decal: DecalSprite): number => Object.values(decal.density).reduce((sum, weight) => sum + (weight ?? 0), 0);

export function spriteKind(name: string): string {
  return name.split('.')[1] ?? '';
}

function ofKind(decals: readonly DecalSprite[], prefix: string, kind: string): DecalSprite[] {
  let byKey = families.get(decals);
  if (!byKey) {
    byKey = new Map();
    families.set(decals, byKey);
  }
  const key = `${prefix}|kind|${kind}`;
  const known = byKey.get(key);
  if (known) return known;

  const list = decals.filter((decal) => decal.name.startsWith(prefix) && spriteKind(decal.name) === kind && weightOf(decal) > 0);
  byKey.set(key, list);
  return list;
}

function pickKind(list: readonly DecalSprite[], roll: number): DecalSprite | null {
  let total = 0;
  for (const decal of list) total += weightOf(decal);
  if (total <= 0) return null;

  let left = roll * total;
  for (const decal of list) {
    left -= weightOf(decal);
    if (left < 0) return decal;
  }
  return list[list.length - 1] ?? null;
}

const SPREAD: Record<string, number> = { 'tree.': 1, 'bush.': 1, 'boulder.': 0.6, 'fallen.': 1 };

const WORN_BARE = 96;

const STOREY_PREFERENCE: readonly (readonly string[])[] = [
  ['sapling', 'young', 'low', 'mid', 'high'],
  ['young', 'low', 'sapling', 'mid', 'high'],
  ['low', 'young', 'mid', 'high', 'sapling'],
  ['mid', 'low', 'high', 'young', 'sapling'],
  ['high', 'mid', 'low', 'young', 'sapling'],
];

const plantIndexes = new WeakMap<readonly DecalSprite[], Map<string, DecalSprite[]>>();

function plantIndex(decals: readonly DecalSprite[]): Map<string, DecalSprite[]> {
  let index = plantIndexes.get(decals);
  if (index) return index;
  index = new Map();
  for (const decal of decals) {
    if (!decal.stands || !(decal.name.startsWith('tree.') || decal.name.startsWith('bush.'))) continue;
    const parts = decal.name.split('.');
    for (const key of [`${parts[0]}|${spriteKind(decal.name)}|${parts[parts.length - 1]}`, `${parts[0]}|${spriteKind(decal.name)}|*`]) {
      const list = index.get(key);
      if (list) list.push(decal);
      else index.set(key, [decal]);
    }
  }
  plantIndexes.set(decals, index);
  return index;
}

function plantSprite(decals: readonly DecalSprite[], prefix: string, art: string, stage: number, roll: number): DecalSprite | null {
  const index = plantIndex(decals);
  for (const storey of STOREY_PREFERENCE[stage] ?? STOREY_PREFERENCE[2]!) {
    const list = index.get(`${prefix}|${art}|${storey}`);
    if (list && list.length > 0) return list[Math.min(list.length - 1, Math.floor(roll * list.length))]!;
  }
  const any = index.get(`${prefix}|${art}|*`);
  return any && any.length > 0 ? any[Math.min(any.length - 1, Math.floor(roll * any.length))]! : null;
}

const LOW_UNDER_METRES = 0.8;

const SNOW_CLAD_CELSIUS = -2;

function standOn(
  world: World,
  decals: readonly DecalSprite[],
  column: number,
  row: number,
  index: number,
  material: Material,
  out: Placement[],
): void {
  const { grid, plants } = world;
  const cover = world.cover[index]!;
  const wind = world.wind[index]! / 255;
  const place = (decal: DecalSprite, spread: number, salt: number): void => {
    out.push({
      decal,
      material,
      x: grid.x(column) + (hash(column, row, 29 + salt) - 0.5) * TILE * spread,
      y: grid.y(row) + (hash(column, row, 37 + salt) - 0.5) * TILE * spread,
      flip: hash(column, row, 53 + salt) < 0.5,
      wind,
    });
  };

  if (cover === Cover.Boulder) {
    const decal = pickFrom(familyFor(decals, 'boulder.', material), material, hash(column, row, 17));
    if (decal) place(decal, SPREAD['boulder.'] ?? 0.6, 0);
    return;
  }
  if (cover === Cover.Fallen) {
    const decal = pickKind(ofKind(decals, 'fallen.', world.field.temperature[index]! < 9 ? 'pine' : 'oak'), hash(column, row, 17));
    if (decal) place(decal, SPREAD['fallen.'] ?? 1, 0);
    return;
  }

  const tall = plants.speciesAt(index, 'canopy');
  if (tall) {
    const stage = stageOfPlant(tall, plants.heightOf(index, 'canopy'));
    const snowy = tall.snowArt !== null && world.field.temperature[index]! < SNOW_CLAD_CELSIUS;
    const decal = plantSprite(decals, 'tree', snowy ? tall.snowArt! : tall.art, stage, hash(column, row, 17));
    if (decal) place(decal, SPREAD['tree.'] ?? 1, 0);
  }

  const low = plants.speciesAt(index, 'under');
  if (low && plants.heightOf(index, 'under') >= LOW_UNDER_METRES) {
    const stage = stageOfPlant(low, plants.heightOf(index, 'under'));
    const decal = plantSprite(decals, 'bush', low.art, stage, hash(column, row, 18));
    if (decal) place(decal, tall ? 1.1 : (SPREAD['bush.'] ?? 1), 7);
  }
}

const standsHere = (world: World, index: number): boolean =>
  world.plants.canopy[index] !== 0 || world.plants.under[index] !== 0 || world.cover[index]! >= Cover.Boulder;

const HERB_DENSITY: Record<string, number> = {
  savannagrass: 1.4,
  steppegrass: 1,
  tussock: 1.2,
  dunegrass: 1,
  desertgrass: 0.5,
  junglefloor: 1.6,
  woodland: 0.7,
  moss: 0.8,
  sedge: 1.2,
};

function herbMarksOn(
  world: World,
  decals: readonly DecalSprite[],
  column: number,
  row: number,
  index: number,
  out: Placement[],
  material: Material,
): void {
  const herb = world.plants.speciesAt(index, 'herb');
  const base = herb ? HERB_DENSITY[herb.art] : undefined;
  if (!herb || !base || world.river[index] === 1) return;
  const list = ofHerb(decals, herb.art);
  if (list.length === 0) return;
  const grain = list[0]!.grain;
  const density = grain ? base * patchiness(world.seed, grain, column, row) : base;
  const count = Math.floor(density + hash(column, row, 211));
  const { grid } = world;
  for (let n = 0; n < count; n += 1) {
    const angle = hash(column, row, 217 + n * 7) * Math.PI * 2;
    const reach = Math.sqrt(hash(column, row, 223 + n * 7)) * TILE * 0.42;
    out.push({
      decal: list[Math.min(list.length - 1, Math.floor(hash(column, row, 229 + n * 7) * list.length))]!,
      material,
      x: grid.x(column) + Math.cos(angle) * reach,
      y: grid.y(row) + Math.sin(angle) * reach,
      flip: hash(column, row, 233 + n * 7) < 0.5,
      wind: world.wind[index]! / 255,
    });
  }
}

const herbLists = new WeakMap<readonly DecalSprite[], Map<string, DecalSprite[]>>();

function ofHerb(decals: readonly DecalSprite[], art: string): DecalSprite[] {
  let byArt = herbLists.get(decals);
  if (!byArt) {
    byArt = new Map();
    herbLists.set(decals, byArt);
  }
  let list = byArt.get(art);
  if (!list) {
    list = decals.filter((decal) => decal.name.startsWith(`herb.${art}.`));
    byArt.set(art, list);
  }
  return list;
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
  const riverside = world.river[index] === 1;
  const { grid } = world;
  const x = grid.x(column);
  const y = grid.y(row);

  if (!worn) herbMarksOn(world, decals, column, row, index, out, material);

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
      const placedX = x + Math.cos(angle) * reach;
      const placedY = y + Math.sin(angle) * reach;
      if (riverside && wetNear(world.field, placedX, placedY, MARK_SHORE_TILES)) continue;
      out.push({
        decal,
        material,
        x: placedX,
        y: placedY,
        flip: hash(column, row, at * 31 + n * 7 + 9) < 0.5,
        wind: world.wind[index]! / 255,
      });
    }
  });
}

const MARK_SHORE_TILES = 0.3;

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
        if (standsHere(world, index)) standOn(world, sprites.decals, column, row, index, material, out);
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
      if (!standsHere(world, index)) continue;
      const material = MATERIALS[world.biome[index]!];
      if (!material) continue;
      standOn(world, decals, column, row, index, material, out);
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

const AQUA_COUNT = [0, 1.4, 0.7, 1, 1.6, 1.2, 1];

const aquaByName = new WeakMap<readonly DecalSprite[], Map<string, DecalSprite>>();

function aquaSprite(decals: readonly DecalSprite[], name: string): DecalSprite | undefined {
  let byName = aquaByName.get(decals);
  if (!byName) {
    byName = new Map(decals.filter((decal) => decal.name.startsWith('aqua.')).map((decal) => [decal.name, decal]));
    aquaByName.set(decals, byName);
  }
  return byName.get(name);
}

export function aquaticIn(
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
      const kind = world.aqua[index]!;
      if (kind === 0) continue;

      const reach = world.river[index] === 1 ? 0.3 : 0.45;
      const count = Math.floor(AQUA_COUNT[kind]! + hash(column, row, 61));
      for (let n = 0; n < count; n += 1) {
        const variant = Math.floor(hash(column, row, 67 + n) * 3);
        const decal = aquaSprite(decals, `aqua.${AQUA_NAMES[kind]}.v${variant}`);
        if (!decal) continue;
        out.push({
          decal,
          material: 'meadow',
          x: grid.x(column) + (hash(column, row, 71 + n * 5) - 0.5) * 2 * reach * TILE,
          y: grid.y(row) + (hash(column, row, 73 + n * 5) - 0.5) * 2 * reach * TILE,
          flip: hash(column, row, 79 + n) < 0.5,
          wind: world.wind[index]! / 255,
        });
      }
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
