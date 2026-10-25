import { seasonalKindIndexForSprite } from '../../sim/seasons/seasonalRegistry.ts';
import type { World } from '../../sim/world.ts';
import type { DecalSprite, Grain, Placement } from '../groundSprites.ts';
import { marksIn, setPropsLit, standsIn } from '../groundSprites.ts';
import { loadSpriteSheetTexture } from './glHelpers.ts';
import type { Lighting, PointLight } from './lighting.ts';
import { FLOATS_PER_INSTANCE, flagsOf, PLACEMENT_BLOCK_CACHE_SIZE, PLACEMENT_BLOCK_TILES } from './litLayerConstants.ts';

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
  width: number;
  height: number;
}

interface PlacementBlock {
  worldStamp: number;
  trees: Float32Array;
  trunks: Float32Array;
  bareBranches: Float32Array;
  groundMarks: Float32Array | null;
}

export interface InstanceSelection {
  withGroundMarks: boolean;
  withTrunks: boolean;
  withBareBranches: boolean;
}

const STANDING_PROP_NAME = /^(tree|bush|boulder|fallen)\./;
const COMPANION_SPRITE_NAME = /^(trunk|bare)\.|\.(bud|seed)\.v\d+$/;
const FLOWER_SEASONAL_KIND = seasonalKindIndexForSprite('meadow.flowers.yellow.v0');
const INITIAL_SCRATCH_INSTANCES = 4096;

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
  ): { data: Float32Array; instanceCount: number } {
    let usedFloats = 0;
    const append = (data: Float32Array | null): void => {
      if (!data) return;
      if (usedFloats + data.length > this.scratch.length) {
        const grown = new Float32Array(Math.max(this.scratch.length * 2, usedFloats + data.length));
        grown.set(this.scratch.subarray(0, usedFloats));
        this.scratch = grown;
      }
      this.scratch.set(data, usedFloats);
      usedFloats += data.length;
    };

    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const block = this.blockAt(world, column, row, selection.withGroundMarks);
        append(block.trees);
        append(selection.withTrunks ? block.trunks : null);
        append(selection.withBareBranches ? block.bareBranches : null);
        append(block.groundMarks);
      }
    }
    append(extraInstances);

    return { data: this.scratch.subarray(0, usedFloats), instanceCount: usedFloats / FLOATS_PER_INSTANCE };
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
      const [albedo, normal] = await Promise.all([
        loadSpriteSheetTexture(this.gl, '/props/albedo.png'),
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
      this.atlas = { albedo, normal, width: manifest.sheet.width, height: manifest.sheet.height };
      setPropsLit(true);
    } catch (error) {
      console.warn('lit props unavailable:', error);
    }
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
      if (!/^tree\.(oak|willow)/.test(tree.decal.name)) continue;
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
      };
    }
    if (withGroundMarks && !block.groundMarks) {
      const placedMarks = marksIn(world, this.sprites, ...tileRange);
      block.groundMarks = this.packInstances([...placedMarks, ...this.flowerStagesFor(placedMarks)]);
    }

    this.blocksByKey.delete(key);
    this.blocksByKey.set(key, block);
    while (this.blocksByKey.size > PLACEMENT_BLOCK_CACHE_SIZE) {
      this.blocksByKey.delete(this.blocksByKey.keys().next().value!);
    }
    return block;
  }
}
