import type { Bounds } from '../sim/geometry.ts';
import { PARCEL, parcelId, parcelOf, siteOf } from '../sim/parcels.ts';
import { biomeAt, groundBiomeAt } from '../sim/terrain.ts';
import { Biome } from '../sim/types.ts';
import type { CellId } from '../sim/types.ts';
import type { GameWorld } from '../sim/world.ts';
import { isWater } from '../sim/worldfield.ts';
import { treesOn } from '../sim/trees.ts';
import { TICKS_PER_TREE } from '../sim/clearing.ts';

/**
 * The drawn ground, as the game sees it: what `npm run ground` baked into `public/ground`, read
 * back into arrays. Nothing here draws; `terrainPixels.ts` paints the textures and masks into
 * the ground, and the decals go where `placementsIn` says.
 *
 * Loaded once, in the background. Until it arrives the ground is painted the way it always was,
 * and `groundVersion` goes into the chunk key so every chunk baked before is baked again after.
 * Outside a browser — the CLI previews — it never loads, and they get the old painting.
 */

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

/**
 * How many times a texture is halved for the rungs above the sharpest. Four rungs paint the
 * parcel lattice (`mosaic` in `terrainPixels.ts`), and those are the only ones the drawn ground
 * is for: further out a parcel is a few texels and a texture in it is noise.
 */
export const MIPS = 4;

export interface Variant {
  name: string;
  /** One per rung, sharpest first: ramp steps, `size >> mip` square. */
  mips: Uint8Array[];
}

export interface DecalSprite {
  name: string;
  width: number;
  height: number;
  foot: { x: number; y: number };
  density: Partial<Record<Material, number>>;
  stands: boolean;
  /** As baked: alpha 255 a colour, 1–5 a ground step, 0 clear. */
  cells: Uint32Array;
}

export interface GroundSprites {
  size: number;
  steps: number;
  priority: readonly Material[];
  /** Keyed by material, and for the desert by material and ridge — `desert:ns`. */
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

/** Bumped when the sprites arrive, so the chunk key moves with them. */
export const groundVersion = (): number => version;

/**
 * Hands over sprites built some other way — the CLI previews, which have no browser to load the
 * baked sheets with and build the same data from the authoring code instead (`cli/groundSource.ts`).
 */
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

/** A square of one channel out of a sheet, `size` across, its top-left at `x, y`. */
function square(from: { data: Uint8ClampedArray; width: number }, x: number, y: number, size: number): Uint8Array {
  const out = new Uint8Array(size * size);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      out[row * size + column] = from.data[((y + row) * from.width + x + column) * 4]!;
    }
  }
  return out;
}

/** Each cell of the next mip the mean of the four under it — over steps, rounded to a step. */
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
    // A desert takes its rippled and duned ground from one ridge at a time, so the dunes of a
    // stretch of sand all lie the same way; the plain kinds of desert go with every ridge.
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

/* ---------- where the decals go ---------- */

export interface Placement {
  decal: DecalSprite;
  material: Material;
  /** Where it stands, in world units. */
  x: number;
  y: number;
}

/** A deterministic number in [0, 1) for a lattice point; the same on every run and every load. */
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

/**
 * What grows on one parcel: a pure function of the world and the parcel's place on the lattice,
 * so a tree is in the same place in every chunk that bakes it, every frame that draws it, and
 * every game. The parcel's own biome decides what grows, at the densities the decals carry; a
 * parcel of water grows nothing.
 */
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
    // The trees are the simulation's (`sim/trees.ts`): how many and where. Which tree is drawn at
    // each is the decals' choice, weighted by their densities on this ground.
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
        // Inside the cell: within a little under half a parcel of its site, which every cell
        // reaches in every direction.
        const angle = hash(column, row, index * 31 + n * 7 + 2) * Math.PI * 2;
        const reach = Math.sqrt(hash(column, row, index * 31 + n * 7 + 3)) * PARCEL * 0.42;
        const x = site.x + Math.cos(angle) * reach;
        const y = site.y + Math.sin(angle) * reach;
        // Not with its foot in the water: a river crosses dry parcels, and a tree stood in it
        // reads as one growing out of the stream.
        if (isWater(biomeAt(world.seed, { x, y }))) continue;
        out.push({ decal, material, x, y });
      }
    });
  }

  if (placed.size >= PLACEMENT_BUDGET) placed.clear();
  placed.set(key, out);
  return out;
}

/** Whether a decal is a tree: the one kind of standing thing that is felled, and that hides a building. */
export const isTree = (decal: DecalSprite): boolean => decal.name.startsWith('tree.');

/**
 * What may not grow where. Nothing on a road or under a building — the same cells the ground paints
 * as bare earth (`pavedCells`), covered by the same chunk key, so new dirt clears its parcel in the
 * chunks it falls in. And no tree on the ring of parcels round a building: a tree in front of a
 * building is nearer than it, so its crown covers it, and in a forest the whole town went under the
 * canopy. Bushes and boulders may stay on the ring — too small to hide anything.
 *
 * A building whose site is still being cleared (`Building.clearing`) has had its own parcel cleared
 * of everything but trees the moment it was placed — nobody fells a boulder — and its trees come
 * down one at a time as the work is done (`felled`). Its flowers go when the last of them does.
 */
interface Kept {
  /** Parcels where nothing stands. */
  bare: Set<CellId>;
  /** Parcels where no tree stands. */
  treeless: Set<CellId>;
  /** Trees already felled on sites still being cleared. */
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

/** The parcels under buildings still being cleared, which are bare of everything but their trees. */
function sitesClearing(world: GameWorld): Set<CellId> {
  const ids = new Set<CellId>();
  for (const settlement of world.settlements.values()) {
    for (const building of settlement.buildings.values()) if (building.clearing) ids.add(building.cellId);
  }
  return ids;
}

const sites = new Map<string, Placement[]>();

/**
 * The trees on a building's site — its parcel and the ring round it — in the order they are felled:
 * nearest the plot first, so the clearing opens out from where the building will go.
 */
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

/**
 * How many of a site's trees are down: one for every `TICKS_PER_TREE` of felling done, all of them
 * once it is cleared. The simulation counts the same trees (`sim/trees.ts`), so this is exact.
 */
export function felledAt(world: GameWorld, sprites: GroundSprites, building: Site): number {
  const trees = siteTrees(world, sprites, building);
  if (!building.clearing) return trees.length;
  return Math.min(trees.length, Math.floor(Math.min(building.clearing.done, building.clearing.felling) / TICKS_PER_TREE));
}

/** How far the digging of a site has got, 0 to 1 — the felling comes first and counts for nothing here. */
export function dugAt(building: Site): number {
  const work = building.clearing;
  if (!work) return 1;
  const digging = work.needed - work.felling;
  return digging <= 0 ? 0 : Math.max(0, Math.min(1, (work.done - work.felling) / digging));
}

/**
 * The rungs, counted out from the sharpest, on which standing decals are drawn live with the
 * town rather than baked into the ground: the same rungs the town itself is drawn on, where
 * something walking can pass in front of a tree or behind it. Further out they are baked.
 */
export const LIVE_MIPS = 2;

/** How far a decal can reach from the parcel it stands in, in parcels: a big oak's crown. */
const REACH = 2;

/**
 * Every decal of one kind — standing, or lying flat — that could show inside `bounds`, in the
 * order they are to be drawn: furthest first, so the nearer tree overlaps the one behind it.
 */
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

/* ---------- decals as cells of colour, at each halving ---------- */

export interface DecalCells {
  width: number;
  height: number;
  foot: { x: number; y: number };
  /**
   * Packed as baked: alpha 255 a colour of the decal's own, 1–5 a step of whatever ground it ends
   * up on (resolved where it is laid, against what is actually there), 0 clear.
   */
  cells: Uint32Array;
}

const halvings = new Map<string, DecalCells>();

/**
 * A decal halved `mip` times — the same rule the tiles follow, so a tree two rungs out is drawn
 * from a grid a quarter the size, not shrunk. A halved cell is drawn if most of the four under it
 * were: a ground cell if most of those were ground (a shadow stays a shadow), otherwise the mean
 * of the colours among them.
 */
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
