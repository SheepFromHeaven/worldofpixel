import { seasonalKindIndexForSprite } from '../../sim/seasons/seasonalRegistry.ts';
import type { World } from '../../sim/world.ts';
import type { DecalSprite, Grain, Placement } from '../groundSprites.ts';
import { aquaticIn, marksIn, setPropsLit, standsIn } from '../groundSprites.ts';
import { TEXEL } from '../terrainPixels.ts';
import { loadSpriteSheetTexture, loadSpriteSheetTextureWithPixels } from './glHelpers.ts';
import type { Lighting, PointLight } from './lighting.ts';
import { FLOATS_PER_INSTANCE, flagsOf, LOW_MARK_HEIGHT, PLACEMENT_BLOCK_CACHE_SIZE, PLACEMENT_BLOCK_TILES } from './litLayerConstants.ts';

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
  width: number;
  height: number;
}

interface PlacementBlock {
  worldStamp: number;
  trees: Float32Array;
  trunks: Float32Array;
  bareBranches: Float32Array;
  groundMarks: Float32Array | null;
  lowMarks: Float32Array | null;
}

export interface InstanceSelection {
  withGroundMarks: boolean;
  withTrunks: boolean;
  withBareBranches: boolean;
  lowMarksCastShadows: boolean;
  view: { minX: number; maxX: number; minY: number; maxY: number };
}

const STANDING_PROP_NAME = /^(tree|bush|boulder|fallen)\./;
const COMPANION_SPRITE_NAME = /^(trunk|bare)\.|\.(bud|seed)\.v\d+$/;
const FLOWER_SEASONAL_KIND = seasonalKindIndexForSprite('meadow.flowers.yellow.v0');
const DECIDUOUS_SEASONAL_KIND = seasonalKindIndexForSprite('tree.oak');
const INITIAL_SCRATCH_INSTANCES = 4096;
const SHADOW_REACH_PER_HEIGHT = 10;
const OPAQUE_ALPHA = 128;
const SWAY_PADDING_TEXELS = 3;

export class PropPlacementCache {
  atlas: SpriteAtlas | null = null;

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
  ): { data: Float32Array; instanceCount: number; casterCount: number } {
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

    const blocks: PlacementBlock[] = [];
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const block = this.blockAt(world, column, row, selection.withGroundMarks);
        blocks.push(block);
        appendVisible(block.trees);
        appendVisible(selection.withTrunks ? block.trunks : null);
        appendVisible(selection.withBareBranches ? block.bareBranches : null);
        appendVisible(block.groundMarks);
        if (selection.lowMarksCastShadows) appendVisible(block.lowMarks);
      }
    }
    append(extraInstances);
    const casterCount = usedFloats / FLOATS_PER_INSTANCE;
    if (!selection.lowMarksCastShadows) for (const block of blocks) appendVisible(block.lowMarks);

    return { data: this.scratch.subarray(0, usedFloats), instanceCount: usedFloats / FLOATS_PER_INSTANCE, casterCount };
  }

  entry(name: string): SpriteSheetEntry | undefined {
    return this.entriesByName.get(name);
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
          [light.x, light.y, entry.x, entry.y, entry.size, entry.foot.x, entry.foot.y, entry.height, light.id % 2, 0, 0, flags],
          (lightIndex * 2 + part) * FLOATS_PER_INSTANCE,
        );
      }
    });
    return data;
  }

  bareBranchesAreShown(lighting: Lighting, seasonalLimit: number): boolean {
    const oakLeafLossIndex = seasonalKindIndexForSprite('tree.oak') * 8 + 1;
    const northernLeafLoss = lighting.seasonalShaderTable[oakLeafLossIndex]!;
    const southernLeafLoss = lighting.seasonalShaderTable[seasonalLimit * 8 + oakLeafLossIndex]!;
    return Math.max(northernLeafLoss, southernLeafLoss) > 0.04;
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
      this.atlas = { albedo, normal, crop, width: manifest.sheet.width, height: manifest.sheet.height };
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

  private stumpsFor(placed: readonly Placement[]): Placement[] {
    const stumps: Placement[] = [];
    for (const tree of placed) {
      const [group, kind, ...rest] = tree.decal.name.split('.');
      if (group !== 'tree') continue;
      const trunk = this.companionSpriteByName.get(`trunk.${kind}.${rest[rest.length - 1]}`);
      if (trunk) stumps.push({ ...tree, decal: trunk, wind: 0 });
    }
    return stumps;
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

  private bareBranchesFor(placed: readonly Placement[]): Placement[] {
    const bareTrees: Placement[] = [];
    for (const tree of placed) {
      if (seasonalKindIndexForSprite(tree.decal.name) !== DECIDUOUS_SEASONAL_KIND) continue;
      const bare = this.companionSpriteByName.get(tree.decal.name.replace('tree.', 'bare.'));
      if (bare) bareTrees.push({ ...tree, decal: bare, wind: 0 });
    }
    return bareTrees;
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
        trees: this.packInstances(placedStanding),
        trunks: this.packInstances(this.stumpsFor(placedStanding)),
        bareBranches: this.packInstances(this.bareBranchesFor(placedStanding)),
        groundMarks: null,
        lowMarks: null,
      };
    }
    if (withGroundMarks && !block.groundMarks) {
      const placedMarks = marksIn(world, this.sprites, ...tileRange);
      const placedAquatic = aquaticIn(world, this.sprites, ...tileRange);
      const everyMark = [...placedMarks, ...placedAquatic, ...this.flowerStagesFor(placedMarks)];
      const isLow = (placement: Placement): boolean => this.entriesByName.get(placement.decal.name)!.height < LOW_MARK_HEIGHT;
      block.groundMarks = this.packInstances(everyMark.filter((placement) => !isLow(placement)));
      block.lowMarks = this.packInstances(everyMark.filter(isLow));
    }

    this.blocksByKey.delete(key);
    this.blocksByKey.set(key, block);
    while (this.blocksByKey.size > PLACEMENT_BLOCK_CACHE_SIZE) {
      this.blocksByKey.delete(this.blocksByKey.keys().next().value!);
    }
    return block;
  }
}
