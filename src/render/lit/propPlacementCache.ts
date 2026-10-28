import { seasonalKindIndexForSprite } from '../../sim/seasons/seasonalRegistry.ts';
import type { World } from '../../sim/world.ts';
import type { DecalSprite, Grain, Placement } from '../groundSprites.ts';
import { aquaticIn, marksIn, setPropsLit, standsIn } from '../groundSprites.ts';
import { TEXEL } from '../terrainPixels.ts';
import { loadSpriteSheetTexture, loadSpriteSheetTextureWithPixels } from './glHelpers.ts';
import type { PointLight } from './lighting.ts';
import type { GrownEntry, GrownTrees } from './grownTrees.ts';
import { grownKeyOf } from './grownTrees.ts';
import type { SceneryProp } from './scenery.ts';
import { FLOATS_PER_INSTANCE, flagsOf, LAYERED_FLAG, LOW_MARK_HEIGHT, PLACEMENT_BLOCK_CACHE_SIZE, PLACEMENT_BLOCK_TILES, SUBMERGED_FLAG, TORCH_FLAME_LIFT_TILES } from './litLayerConstants.ts';

export interface SpriteSheetEntry {
  name: string;
  x: number;
  y: number;
  size: number;
  foot: { x: number; y: number };
  density: DecalSprite['density'];
  height: number;
  sway: number;
  canopy: boolean;
  bend: boolean;
  emit: boolean;
  hides?: boolean;
  torchShadow?: boolean;
  season: number;
  grain: readonly Grain[];
}

interface SpriteSheetManifest {
  sheet: { width: number; height: number };
  props: SpriteSheetEntry[];
}

export interface SpriteAtlas {
  albedo: WebGLTexture;
  normal: WebGLTexture;
  crop: WebGLTexture;
  torchShadow: ReadonlySet<number>;
  width: number;
  height: number;
}

interface GrownBlock {
  shadows: Float32Array;
  rest: Float32Array;
  bodies: ReadonlyMap<string, Float32Array>;
}

interface MarkBlock {
  shadows: Float32Array;
  shadowsLow: Float32Array;
  rest: Float32Array;
  restLow: Float32Array;
  bodies: ReadonlyMap<string, Float32Array>;
}

interface PlacementBlock {
  worldStamp: number;
  standing: Placement[];
  grown: GrownBlock | null;
  marks: Placement[] | null;
  markGrown: MarkBlock | null;
}

export interface TorchBodies {
  shadows: Float32Array;
  bodies: ReadonlyMap<string, Float32Array>;
}

export interface FolkBodies {
  shadows: Float32Array;
  bodies: ReadonlyMap<string, Float32Array>;
}

export function grownRow(x: number, y: number, flip: boolean, wind: number, entry: GrownEntry, flags: number): number[] {
  return [x, y, entry.x, entry.y, entry.size, entry.foot.x, entry.foot.y, entry.height, flip ? 1 : 0, wind, entry.sway, flags + (entry.bend ? 0 : BEND_FLAG) + (entry.layered ? LAYERED_FLAG : 0)];
}

export interface InstanceSelection {
  torches: TorchBodies | null;
  withGroundMarks: boolean;
  lowMarksCastShadows: boolean;
  view: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface CollectedInstances {
  data: Float32Array;
  instanceCount: number;
  casterCount: number;
  shadowOnly: number;
  bodies: ReadonlyMap<string, Float32Array>;
}

const STANDING_PROP_NAME = /^(tree|bush|boulder|fallen)\./;
const COMPANION_SPRITE_NAME = /^(trunk|bare)\.|\.(bud|seed)\.v\d+$/;
const FLOWER_SEASONAL_KIND = seasonalKindIndexForSprite('meadow.flowers.yellow.v0');
const INITIAL_SCRATCH_INSTANCES = 4096;
const SHADOW_REACH_PER_HEIGHT = 10;
const TORCH_DRAW_TEXELS = 12;
export const TORCH_SHADOW_KEY_STRIDE = 65536;
const OPAQUE_ALPHA = 128;
const SWAY_PADDING_TEXELS = 3;
const BEND_FLAG = 2;
const SUBMERGED_NAME = /^aqua\.(seagrass|kelp)\./;
const TORCH_SHADOW_HEIGHT = 6;

export class PropPlacementCache {
  atlas: SpriteAtlas | null = null;
  grownTrees: GrownTrees | null = null;
  private readonly bodyScratch = new Map<string, { data: Float32Array; used: number }>();

  private sprites: DecalSprite[] = [];
  private entriesByName = new Map<string, SpriteSheetEntry>();
  private readonly companionSpriteByName = new Map<string, DecalSprite>();
  private readonly blocksByKey = new Map<string, PlacementBlock>();
  private scratch = new Float32Array(FLOATS_PER_INSTANCE * INITIAL_SCRATCH_INSTANCES);
  private disposed = false;

  constructor(private readonly gl: WebGL2RenderingContext) {
    void this.loadSpriteSheet();
  }

  dispose(): void {
    this.disposed = true;
    setPropsLit(false);
  }

  collectInstances(
    world: World,
    firstColumn: number,
    lastColumn: number,
    firstRow: number,
    lastRow: number,
    selection: InstanceSelection,
    extraInstances: Float32Array,
    folk: FolkBodies | null = null,
  ): CollectedInstances {
    let usedFloats = 0;
    const grow = (needed: number): void => {
      if (usedFloats + needed <= this.scratch.length) return;
      const grown = new Float32Array(Math.max(this.scratch.length * 2, usedFloats + needed));
      grown.set(this.scratch.subarray(0, usedFloats));
      this.scratch = grown;
    };
    const append = (data: Float32Array | null): void => {
      if (!data) return;
      grow(data.length);
      this.scratch.set(data, usedFloats);
      usedFloats += data.length;
    };
    const { view } = selection;
    const appendVisible = (data: Float32Array | null): void => {
      if (!data) return;
      grow(data.length);
      const out = this.scratch;
      for (let at = 0; at < data.length; at += FLOATS_PER_INSTANCE) {
        const reach = (data[at + 4]! + SHADOW_REACH_PER_HEIGHT * data[at + 7]!) * TEXEL;
        const x = data[at]!;
        const y = data[at + 1]!;
        if (x < view.minX - reach || x > view.maxX + reach || y < view.minY - reach || y > view.maxY + reach) continue;
        for (let part = 0; part < FLOATS_PER_INSTANCE; part += 1) out[usedFloats + part] = data[at + part]!;
        usedFloats += FLOATS_PER_INSTANCE;
      }
    };

    for (const bodies of this.bodyScratch.values()) bodies.used = 0;
    const appendBody = (art: string, data: Float32Array): void => {
      let scratch = this.bodyScratch.get(art);
      if (!scratch) this.bodyScratch.set(art, (scratch = { data: new Float32Array(Math.max(data.length * 2, FLOATS_PER_INSTANCE * 8)), used: 0 }));
      for (let at = 0; at < data.length; at += FLOATS_PER_INSTANCE) {
        const reach = data[at + 4]! * TEXEL;
        const x = data[at]!;
        const y = data[at + 1]!;
        if (x < view.minX - reach || x > view.maxX + reach || y < view.minY - reach || y > view.maxY + reach) continue;
        if (scratch.used + FLOATS_PER_INSTANCE > scratch.data.length) {
          const bigger = new Float32Array(scratch.data.length * 2);
          bigger.set(scratch.data);
          scratch.data = bigger;
        }
        scratch.data.set(data.subarray(at, at + FLOATS_PER_INSTANCE), scratch.used);
        scratch.used += FLOATS_PER_INSTANCE;
      }
    };

    if (selection.torches) {
      appendVisible(selection.torches.shadows);
      for (const [art, data] of selection.torches.bodies) appendBody(art, data);
    }

    if (folk) {
      appendVisible(folk.shadows);
      for (const [art, data] of folk.bodies) appendBody(art, data);
    }

    const blocks: PlacementBlock[] = [];
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        blocks.push(this.blockAt(world, column, row, selection.withGroundMarks));
      }
    }
    for (const block of blocks) {
      const split = this.grownOf(block);
      appendVisible(split.shadows);
      for (const [art, data] of split.bodies) appendBody(art, data);
      const marks = selection.withGroundMarks ? this.marksOf(block) : null;
      if (!marks) continue;
      appendVisible(marks.shadows);
      if (selection.lowMarksCastShadows) appendVisible(marks.shadowsLow);
      for (const [art, data] of marks.bodies) appendBody(art, data);
    }
    const shadowOnly = usedFloats / FLOATS_PER_INSTANCE;
    for (const block of blocks) {
      appendVisible(this.grownOf(block).rest);
      const marks = selection.withGroundMarks ? this.marksOf(block) : null;
      if (!marks) continue;
      appendVisible(marks.rest);
      if (selection.lowMarksCastShadows) appendVisible(marks.restLow);
    }
    append(extraInstances);
    const casterCount = usedFloats / FLOATS_PER_INSTANCE;
    if (!selection.lowMarksCastShadows && selection.withGroundMarks) for (const block of blocks) appendVisible(this.marksOf(block)?.restLow ?? null);

    const bodies = new Map<string, Float32Array>();
    for (const [art, scratch] of this.bodyScratch) if (scratch.used > 0) bodies.set(art, scratch.data.subarray(0, scratch.used));
    return { data: this.scratch.subarray(0, usedFloats), instanceCount: usedFloats / FLOATS_PER_INSTANCE, casterCount, shadowOnly, bodies };
  }

  private grownOf(block: PlacementBlock): GrownBlock {
    if (block.grown) return block.grown;
    const trees = this.grownTrees;
    const loaded = trees?.ready === true;
    const plan: Placement[] = [];
    const rest: Placement[] = [];
    const bodies = new Map<string, number[][]>();
    for (const placement of block.standing) {
      const name = placement.decal.name;
      const entry = trees && loaded ? trees.entry(name) : undefined;
      if (!name.startsWith('tree.') && !entry) {
        rest.push(placement);
        continue;
      }
      plan.push(placement);
      if (!entry) continue;
      const art = grownKeyOf(name);
      const rows = bodies.get(art) ?? bodies.set(art, []).get(art)!;
      rows.push(this.bodyRow(placement.x, placement.y, placement.flip, placement.wind, entry));
    }
    const packed = new Map<string, Float32Array>();
    for (const [art, rows] of bodies) {
      const data = new Float32Array(rows.length * FLOATS_PER_INSTANCE);
      rows.forEach((row, index) => data.set(row, index * FLOATS_PER_INSTANCE));
      packed.set(art, data);
    }
    const split = { shadows: this.packInstances(plan), rest: this.packInstances(rest), bodies: packed };
    if (loaded) block.grown = split;
    return split;
  }

  private marksOf(block: PlacementBlock): MarkBlock | null {
    if (!block.marks) return null;
    if (block.markGrown) return block.markGrown;
    const trees = this.grownTrees;
    const loaded = trees?.ready === true;
    const isLow = (placement: Placement): boolean => this.entriesByName.get(placement.decal.name)!.height < LOW_MARK_HEIGHT;
    const plan: Placement[][] = [[], []];
    const rest: Placement[][] = [[], []];
    const bodies = new Map<string, number[][]>();
    for (const placement of block.marks) {
      const low = isLow(placement) ? 1 : 0;
      const entry = trees && loaded ? trees.entry(placement.decal.name) : undefined;
      if (!entry) {
        rest[low]!.push(placement);
        continue;
      }
      plan[low]!.push(placement);
      const art = grownKeyOf(placement.decal.name);
      const submerged = SUBMERGED_NAME.test(placement.decal.name) ? SUBMERGED_FLAG : 0;
      (bodies.get(art) ?? bodies.set(art, []).get(art)!).push(this.bodyRow(placement.x, placement.y, placement.flip, placement.wind, entry, submerged));
    }
    const packed = new Map<string, Float32Array>();
    for (const [art, rows] of bodies) {
      const data = new Float32Array(rows.length * FLOATS_PER_INSTANCE);
      rows.forEach((row, index) => data.set(row, index * FLOATS_PER_INSTANCE));
      packed.set(art, data);
    }
    const split = {
      shadows: this.packInstances(plan[0]!),
      shadowsLow: this.packInstances(plan[1]!),
      rest: this.packInstances(rest[0]!),
      restLow: this.packInstances(rest[1]!),
      bodies: packed,
    };
    if (loaded) block.markGrown = split;
    return split;
  }

  private bodyRow(x: number, y: number, flip: boolean, wind: number, entry: GrownEntry, extraFlags = 0): number[] {
    return grownRow(x, y, flip, wind, entry, flagsOf({ ...entry, emit: false }) + extraFlags);
  }

  sceneryInstances(scenery: readonly SceneryProp[], extraInstances: Float32Array, torches: TorchBodies | null = null, folk: FolkBodies | null = null): CollectedInstances {
    const trees = this.grownTrees;
    const plan: number[][] = [];
    const rest: number[][] = [];
    const bodies = new Map<string, number[][]>();
    for (const prop of scenery) {
      const source = this.entriesByName.get(prop.name);
      if (!source) continue;
      const entry = trees?.ready ? trees.entry(prop.name) : undefined;
      if (!entry) {
        rest.push([prop.x, prop.y, source.x, source.y, source.size, source.foot.x, source.foot.y, source.height, prop.flip ? 1 : 0, prop.wind, source.sway, flagsOf(source)]);
        continue;
      }
      plan.push([prop.x, prop.y, source.x, source.y, source.size, source.foot.x, source.foot.y, source.height, prop.flip ? 1 : 0, prop.wind, source.sway, flagsOf(source)]);
      const art = grownKeyOf(prop.name);
      const submerged = SUBMERGED_NAME.test(prop.name) ? SUBMERGED_FLAG : 0;
      (bodies.get(art) ?? bodies.set(art, []).get(art)!).push(this.bodyRow(prop.x, prop.y, prop.flip, prop.wind, entry, submerged));
    }
    const flatten = (rows: readonly number[][]): Float32Array => {
      const data = new Float32Array(rows.length * FLOATS_PER_INSTANCE);
      rows.forEach((row, index) => data.set(row, index * FLOATS_PER_INSTANCE));
      return data;
    };
    const sceneShadows = flatten(plan);
    const shadows = new Float32Array(sceneShadows.length + (torches?.shadows.length ?? 0) + (folk?.shadows.length ?? 0));
    shadows.set(sceneShadows);
    if (torches) shadows.set(torches.shadows, sceneShadows.length);
    if (folk) shadows.set(folk.shadows, sceneShadows.length + (torches?.shadows.length ?? 0));
    const drawn = flatten(rest);
    const data = new Float32Array(shadows.length + drawn.length + extraInstances.length);
    data.set(shadows);
    data.set(drawn, shadows.length);
    data.set(extraInstances, shadows.length + drawn.length);
    const packed = new Map<string, Float32Array>();
    for (const [art, rows] of bodies) packed.set(art, flatten(rows));
    for (const source of [torches, folk]) if (source) for (const [art, data] of source.bodies) packed.set(art, data);
    return { data, instanceCount: data.length / FLOATS_PER_INSTANCE, casterCount: data.length / FLOATS_PER_INSTANCE, shadowOnly: shadows.length / FLOATS_PER_INSTANCE, bodies: packed };
  }

  entry(name: string): SpriteSheetEntry | undefined {
    return this.entriesByName.get(name);
  }

  torchBodies(everyLight: readonly PointLight[]): TorchBodies | null {
    const trees = this.grownTrees;
    if (!trees?.ready) return null;
    const post = this.entriesByName.get('torch.post');
    const postBody = trees.entry('torch.post');
    if (!post || !postBody) return null;
    const lights = everyLight.filter((light) => light.source === undefined);
    const shadows = new Float32Array(lights.length * FLOATS_PER_INSTANCE);
    const posts = new Float32Array(lights.length * FLOATS_PER_INSTANCE);
    lights.forEach((light, index) => {
      const flip = light.id % 2;
      const footY = light.y + TORCH_FLAME_LIFT_TILES;
      shadows.set([light.x, footY, post.x, post.y, post.size, post.foot.x, post.foot.y, TORCH_SHADOW_HEIGHT, flip, 0, 0, flagsOf(post)], index * FLOATS_PER_INSTANCE);
      posts.set(this.bodyRow(light.x, footY, flip === 1, 0, postBody), index * FLOATS_PER_INSTANCE);
    });
    return { shadows, bodies: new Map([['torch.post', posts]]) };
  }

  torchInstances(everyLight: readonly PointLight[], seconds: number): Float32Array {
    const lights = everyLight.filter((light) => light.source === undefined);
    const post = this.entriesByName.get('torch.post');
    const flames = [0, 1, 2, 3].map((frame) => this.entriesByName.get(`torch.flame.${frame}`));
    if (!post || flames.some((flame) => !flame)) return new Float32Array(0);

    const data = new Float32Array(lights.length * 2 * FLOATS_PER_INSTANCE);
    lights.forEach((light, lightIndex) => {
      const flame = flames[Math.floor(seconds * 5 + light.id * 1.7) % 4]!;
      for (const [part, entry] of [post, flame].entries()) {
        const flags = flagsOf(entry);
        data.set(
          [light.x, light.y + TORCH_FLAME_LIFT_TILES, entry.x, entry.y, entry.size, entry.foot.x, entry.foot.y, entry.height, light.id % 2, -(TORCH_DRAW_TEXELS + part), 0, flags],
          (lightIndex * 2 + part) * FLOATS_PER_INSTANCE,
        );
      }
    });
    return data;
  }

  get spriteSheet(): readonly DecalSprite[] {
    return this.sprites;
  }

  private async loadSpriteSheet(): Promise<void> {
    try {
      const manifest = (await (await fetch('/props/props.json')).json()) as SpriteSheetManifest;
      const [{ texture: albedo, pixels }, normal] = await Promise.all([
        loadSpriteSheetTextureWithPixels(this.gl, '/props/albedo.png'),
        loadSpriteSheetTexture(this.gl, '/props/normals.png'),
      ]);
      if (this.disposed) return;

      this.entriesByName = new Map(manifest.props.map((entry) => [entry.name, entry]));
      this.sprites = manifest.props.map((entry) => ({
        name: entry.name,
        width: entry.size,
        height: entry.size,
        foot: entry.foot,
        density: entry.density,
        grain: entry.grain,
        stands: STANDING_PROP_NAME.test(entry.name),
        cells: new Uint32Array(0),
      }));
      for (const sprite of this.sprites) {
        if (COMPANION_SPRITE_NAME.test(sprite.name)) this.companionSpriteByName.set(sprite.name, sprite);
      }
      const crop = this.cropTexture(manifest, pixels);
      const torchShadow = new Set(manifest.props.filter((entry) => entry.torchShadow).map((entry) => entry.y * TORCH_SHADOW_KEY_STRIDE + entry.x));
      this.atlas = { albedo, normal, crop, torchShadow, width: manifest.sheet.width, height: manifest.sheet.height };
      setPropsLit(true);
    } catch (error) {
      console.warn('lit props unavailable:', error);
    }
  }

  private cropTexture(manifest: SpriteSheetManifest, pixels: ImageData): WebGLTexture {
    const { gl } = this;
    const { width, height } = manifest.sheet;
    const bounds = new Uint8Array(width * height * 4);
    for (const entry of manifest.props) {
      const { size } = entry;
      let left = size;
      let top = size;
      let right = 0;
      let bottom = 0;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          if (pixels.data[((entry.y + y) * pixels.width + entry.x + x) * 4 + 3]! < OPAQUE_ALPHA) continue;
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
      const empty = right < left || bottom < top;
      const at = (entry.y * width + entry.x) * 4;
      bounds[at] = empty ? 0 : Math.max(0, left - SWAY_PADDING_TEXELS);
      bounds[at + 1] = empty ? 0 : Math.max(0, top - SWAY_PADDING_TEXELS);
      bounds[at + 2] = empty ? size : Math.min(size, right + 1 + SWAY_PADDING_TEXELS);
      bounds[at + 3] = empty ? size : Math.min(size, bottom + 1 + SWAY_PADDING_TEXELS);
    }
    const texture = gl.createTexture();
    if (!texture) throw new Error('could not create a texture');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, bounds);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  private flowerStagesFor(placed: readonly Placement[]): Placement[] {
    const stages: Placement[] = [];
    for (const mark of placed) {
      if (seasonalKindIndexForSprite(mark.decal.name) !== FLOWER_SEASONAL_KIND) continue;
      for (const stage of ['bud', 'seed']) {
        const twin = this.companionSpriteByName.get(mark.decal.name.replace(/\.v(\d+)$/, `.${stage}.v$1`));
        if (twin) stages.push({ ...mark, decal: twin });
      }
    }
    return stages;
  }

  private packInstances(placed: readonly Placement[]): Float32Array {
    const data = new Float32Array(placed.length * FLOATS_PER_INSTANCE);
    placed.forEach((placement, index) => {
      const entry = this.entriesByName.get(placement.decal.name)!;
      const flags = flagsOf(entry);
      data.set(
        [
          placement.x,
          placement.y,
          entry.x,
          entry.y,
          entry.size,
          entry.foot.x,
          entry.foot.y,
          entry.height,
          placement.flip ? 1 : 0,
          placement.wind,
          entry.sway,
          flags,
        ],
        index * FLOATS_PER_INSTANCE,
      );
    });
    return data;
  }

  private blockAt(world: World, column: number, row: number, withGroundMarks: boolean): PlacementBlock {
    const key = `${world.seed}:${column}:${row}`;
    const { grid } = world;
    const worldStamp = world.stampOver({
      minX: grid.x(column * PLACEMENT_BLOCK_TILES),
      minY: grid.y(row * PLACEMENT_BLOCK_TILES),
      maxX: grid.x((column + 1) * PLACEMENT_BLOCK_TILES),
      maxY: grid.y((row + 1) * PLACEMENT_BLOCK_TILES),
    });

    const tileRange = [
      column * PLACEMENT_BLOCK_TILES,
      (column + 1) * PLACEMENT_BLOCK_TILES - 1,
      row * PLACEMENT_BLOCK_TILES,
      (row + 1) * PLACEMENT_BLOCK_TILES - 1,
    ] as const;

    let block = this.blocksByKey.get(key);
    if (!block || block.worldStamp !== worldStamp) {
      const placedStanding = standsIn(world, this.sprites, ...tileRange);
      block = {
        worldStamp,
        standing: placedStanding,
        grown: null,
        marks: null,
        markGrown: null,
      };
    }
    if (withGroundMarks && !block.marks) {
      const placedMarks = marksIn(world, this.sprites, ...tileRange);
      const placedAquatic = aquaticIn(world, this.sprites, ...tileRange);
      block.marks = [...placedMarks, ...placedAquatic, ...this.flowerStagesFor(placedMarks)];
    }

    this.blocksByKey.delete(key);
    this.blocksByKey.set(key, block);
    while (this.blocksByKey.size > PLACEMENT_BLOCK_CACHE_SIZE) {
      this.blocksByKey.delete(this.blocksByKey.keys().next().value!);
    }
    return block;
  }
}
