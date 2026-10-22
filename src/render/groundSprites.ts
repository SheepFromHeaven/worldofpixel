import { TICKS_PER_TREE } from '../sim/clearing.ts';
import type { Bounds } from '../sim/geometry.ts';
import { PARCEL, parcelId, parcelOf, siteOf } from '../sim/terrain/parcels.ts';
import { biomeAt, groundBiomeAt } from '../sim/terrain/terrain.ts';
import { isWater } from '../sim/terrain/worldfield.ts';
import { treesOn } from '../sim/trees.ts';
import type { CellId } from '../sim/types.ts';
import { Biome } from '../sim/types.ts';
import type { GameWorld } from '../sim/world.ts';

export type Material = 'meadow' | 'forest' | 'highland' | 'marsh' | 'tundra' | 'desert' | 'path';

export const MATERIAL_OF: Record<Biome, Material | null> = {
  [Biome.Meadow]: 'meadow',
  [Biome.Forest]: 'forest',
  [Biome.Highland]: 'highland',
  [Biome.Marsh]: 'marsh',
  [Biome.Tundra]: 'tundra',
  [Biome.Desert]: 'desert',
  [Biome.Ocean]: null,
  [Biome.Lake]: null,
  [Biome.River]: null,
};

export const MIPS = 4;

export interface Variant {
  name: string;
  mips: Uint8Array[];
}

export interface DecalSprite {
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
}

function hash(x: number, y: number, salt: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const placed = new Map<number, Placement[]>();
let placedSeed: number | null = null;
const PLACEMENT_BUDGET = 60_000;

function parcelPlacements(world: GameWorld, sprites: GroundSprites, column: number, row: number): Placement[] {
  if (placedSeed !== world.seed) {
    placed.clear();
    placedSeed = world.seed;
  }
  const key = (column + 0x8000) * 0x10000 + (row + 0x8000);
  const known = placed.get(key);
  if (known) return known;

  const site = siteOf(world.seed, PARCEL, column, row);
  const material = MATERIAL_OF[groundBiomeAt(world.seed, site)];
  const out: Placement[] = [];
  if (material) {
    const kinds = sprites.decals.filter((decal) => isTree(decal) && (decal.density[material] ?? 0) > 0);
    const total = kinds.reduce((sum, decal) => sum + (decal.density[material] ?? 0), 0);
    for (const tree of treesOn(world, parcelId(column, row))) {
      let left = tree.pick * total;
      const decal = kinds.find((kind) => (left -= kind.density[material] ?? 0) < 0) ?? kinds[kinds.length - 1];
      if (decal) out.push({ decal, material, x: tree.x, y: tree.y });
    }

    sprites.decals.forEach((decal, index) => {
      if (isTree(decal)) return;
      const density = decal.density[material] ?? 0;
      if (density <= 0) return;
      const count = Math.floor(density + hash(column, row, index * 7 + 1));
      for (let n = 0; n < count; n += 1) {
        const angle = hash(column, row, index * 31 + n * 7 + 2) * Math.PI * 2;
        const reach = Math.sqrt(hash(column, row, index * 31 + n * 7 + 3)) * PARCEL * 0.42;
        const x = site.x + Math.cos(angle) * reach;
        const y = site.y + Math.sin(angle) * reach;
        if (isWater(biomeAt(world.seed, { x, y }))) continue;
        out.push({ decal, material, x, y });
      }
    });
  }

  if (placed.size >= PLACEMENT_BUDGET) placed.clear();
  placed.set(key, out);
  return out;
}

export const isTree = (decal: DecalSprite): boolean => decal.name.startsWith('tree.');

interface Kept {
  bare: Set<CellId>;
  treeless: Set<CellId>;
  felled: Set<Placement>;
}

function cleared(world: GameWorld, sprites: GroundSprites, stands: boolean): Kept {
  const bare = new Set<CellId>();
  const treeless = new Set<CellId>();
  const felled = new Set<Placement>();
  for (const settlement of world.settlements.values()) {
    for (const building of settlement.buildings.values()) {
      if (building.clearing) {
        if (!stands) continue;
        for (const tree of siteTrees(world, sprites, building).slice(0, felledAt(world, sprites, building))) felled.add(tree);
        continue;
      }
      bare.add(building.cellId);
      if (stands) for (const id of parcelOf(world.seed, building.cellId).neighbors) treeless.add(id);
    }
  }
  return { bare, treeless, felled };
}

function sitesClearing(world: GameWorld): Set<CellId> {
  const ids = new Set<CellId>();
  for (const settlement of world.settlements.values()) {
    for (const building of settlement.buildings.values()) if (building.clearing) ids.add(building.cellId);
  }
  return ids;
}

const sites = new Map<string, Placement[]>();

export function siteTrees(
  world: GameWorld,
  sprites: GroundSprites,
  building: { cellId: CellId; position: { x: number; y: number } },
): Placement[] {
  const key = `${world.seed}:${building.cellId}`;
  const known = sites.get(key);
  if (known) return known;
  const parcel = parcelOf(world.seed, building.cellId);
  const trees: Placement[] = [];
  for (const id of [building.cellId, ...parcel.neighbors]) {
    const [column, row] = id.split(':').map(Number) as [number, number];
    for (const placement of parcelPlacements(world, sprites, column, row)) if (isTree(placement.decal)) trees.push(placement);
  }
  const at = building.position;
  trees.sort(
    (a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y) || a.y - b.y || a.x - b.x,
  );
  if (sites.size > 256) sites.clear();
  sites.set(key, trees);
  return trees;
}

type Site = {
  cellId: CellId;
  position: { x: number; y: number };
  clearing: { done: number; needed: number; felling: number } | null;
};

export function felledAt(world: GameWorld, sprites: GroundSprites, building: Site): number {
  const trees = siteTrees(world, sprites, building);
  if (!building.clearing) return trees.length;
  return Math.min(trees.length, Math.floor(Math.min(building.clearing.done, building.clearing.felling) / TICKS_PER_TREE));
}

export function dugAt(building: Site): number {
  const work = building.clearing;
  if (!work) return 1;
  const digging = work.needed - work.felling;
  return digging <= 0 ? 0 : Math.max(0, Math.min(1, (work.done - work.felling) / digging));
}

export const LIVE_MIPS = 2;

const REACH = 2;

export function placementsIn(world: GameWorld, sprites: GroundSprites, bounds: Bounds, stands: boolean): Placement[] {
  const { bare, treeless, felled } = cleared(world, sprites, stands);
  const clearing = stands ? sitesClearing(world) : new Set<CellId>();
  const out: Placement[] = [];
  const firstColumn = Math.floor(bounds.minX / PARCEL) - REACH;
  const lastColumn = Math.floor(bounds.maxX / PARCEL) + REACH;
  const firstRow = Math.floor(bounds.minY / PARCEL) - 1;
  const lastRow = Math.floor(bounds.maxY / PARCEL) + REACH;
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const id = parcelId(column, row);
      if (bare.has(id)) continue;
      for (const placement of parcelPlacements(world, sprites, column, row)) {
        if (placement.decal.stands !== stands || felled.has(placement)) continue;
        const tree = isTree(placement.decal);
        if (tree && treeless.has(id)) continue;
        if (!tree && clearing.has(id)) continue;
        out.push(placement);
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
