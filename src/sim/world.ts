import type { Bounds, Vec2 } from './geometry.ts';
import type { TileGrid, TileIndex } from './grid.ts';
import { NOWHERE } from './grid.ts';
import { Tile } from './tile.ts';
import { Biome } from './types.ts';
import type { WorldField } from './terrain/worldfield.ts';
import './terrain/windowedInstall.ts';
import { fieldFor, isWater, riverTiles } from './terrain/worldfield.ts';
import { Cover } from './covers.ts';
import type { Aquatic } from './aquatic.ts';
import { aquaticFor } from './aquatic.ts';
import { ecoFor } from './eco.ts';
import { steepFor } from './steep.ts';
import type { PlantColumns, PlantEnvironment } from './plants/generate.ts';
import { emptyColumns, environmentFor, generatePlants } from './plants/generate.ts';
import { Plants } from './plants/plants.ts';
import { HomesLayer, ItemsLayer } from './layers/things.ts';
import type { Column, Layer, LayerHost } from './layers/layer.ts';
import { Blueprint, Building, Structures } from './layers/structures.ts';
import { Trails, WEAR_FULL } from './layers/trails.ts';
import type { Confinement } from './movement.ts';
import { Movement } from './movement.ts';

export { Cover, COVER_NAMES } from './covers.ts';

export { WEAR_FULL };

export const BLOCK_TILES = 64;

export { Blueprint, Building };

export interface Ground {
  eco: Uint8Array;
  damp: Uint8Array;
  river: Uint8Array;
  layers?: Record<string, Record<string, Column>>;
}

export type { Confinement };

export interface WorldDelta {
  tiles: Int32Array;
  layers: Record<string, unknown>;
  confinement: Confinement | null;
}

export interface WorldState {
  layers?: Record<string, unknown>;
}

export class World implements LayerHost {
  readonly seed: number;
  readonly grid: TileGrid;
  readonly field: WorldField;

  readonly biome: Uint8Array;
  readonly cover: Uint8Array;
  readonly plants: Plants;
  readonly wind: Uint8Array;
  readonly river: Uint8Array;
  readonly eco: Uint8Array;
  readonly steep: Uint8Array;
  readonly damp: Uint8Array;
  readonly aqua: Uint8Array;
  readonly flow: Uint8Array;
  readonly depth: Uint8Array;
  readonly shore: Uint8Array;
  readonly silt: Uint8Array;
  readonly bloom: Uint8Array;

  readonly items: ItemsLayer['items'];
  readonly homes: HomesLayer['homes'];

  readonly stamps: Uint32Array;
  readonly blockColumns: number;

  revision = 0;

  readonly layers: readonly Layer[];
  readonly trails: Trails;
  readonly structures: Structures;
  readonly movement: Movement;

  private readonly changed = new Set<TileIndex>();

  private constructor(seed: number, field: WorldField, ground: Ground, environment: PlantEnvironment | null, water: Aquatic | null = null) {
    this.seed = seed;
    this.field = field;
    this.grid = field.grid;
    this.biome = field.biome;
    this.wind = field.wind;
    this.river = ground.river;
    this.eco = ground.eco;
    this.damp = ground.damp;
    this.steep = steepFor(field);
    const waters = water ?? aquaticFor(seed, field, this.river);
    this.aqua = waters.aqua;
    this.flow = waters.flow;
    this.depth = waters.depth;
    this.shore = waters.shore;
    this.silt = waters.silt;
    this.bloom = waters.bloom;
    this.cover = this.layerColumn(ground, 'plants', 'cover');
    const itemsLayer = new ItemsLayer();
    const homesLayer = new HomesLayer();
    this.items = itemsLayer.items;
    this.homes = homesLayer.homes;
    this.plants = new Plants(this, this.plantColumns(ground), environment);
    this.trails = new Trails(this.layerColumn(ground, 'trails', 'wear'), { mark: (tile) => this.mark(tile), touch: (tile) => this.touch(tile), cover: this.cover, trample: (tile) => this.plants.trample(tile), held: (tile) => this.heldFast(tile) });
    this.structures = new Structures(
      {
        plan: this.layerColumn(ground, 'structures', 'plan'),
        built: this.layerColumn(ground, 'structures', 'built'),
      },
      {
        mark: (tile) => this.mark(tile),
        touch: (tile) => this.touch(tile),
        cover: this.cover,
        river: this.river,
        wear: this.trails.wear,
        items: this.items,
        passable: (tile) => this.movement.passable(tile),
        clearPlants: (tile) => this.plants.clearAll(tile),
      },
    );
    this.movement = new Movement({ grid: this.grid, biome: this.biome, cover: this.cover, river: this.river, height: field.height, steep: this.steep, wear: this.trails.wear, fire: this.structures.fire, built: this.structures.built });
    this.layers = [this.plants, this.trails, this.structures, itemsLayer, homesLayer];

    this.blockColumns = Math.ceil(field.grid.columns / BLOCK_TILES);
    this.stamps = new Uint32Array(this.blockColumns * Math.ceil(field.grid.rows / BLOCK_TILES));
  }

  private plantColumns(ground: Ground): PlantColumns {
    const own = ground.layers?.plants;
    return own ? (own as unknown as PlantColumns) : emptyColumns(this.grid.count);
  }

  private layerColumn(ground: Ground, layer: string, name: string): Uint8Array {
    return (ground.layers?.[layer]?.[name] as Uint8Array | undefined) ?? new Uint8Array(this.grid.count);
  }

  static generate(seed: number): World {
    const field = fieldFor(seed);
    const river = riverTiles(field);
    const { eco, damp } = ecoFor(seed, field, river);
    const environment = environmentFor(field);
    const { columns, cover } = generatePlants(seed, field, eco, damp, river, environment);
    return new World(seed, field, {
      layers: { plants: { ...columns, cover } },
      eco,
      damp,
      river,
    }, environment);
  }

  static stage(seed: number, field: WorldField, ground: Ground, water: Aquatic): World {
    return new World(seed, field, ground, null, water);
  }

  static mirror(seed: number, ground: Ground): World {
    return new World(seed, fieldFor(seed), ground, null);
  }

  ground(): Ground {
    return {
      eco: this.eco.slice(),
      damp: this.damp.slice(),
      river: this.river.slice(),
      layers: Object.fromEntries(this.layers.map((layer) => [layer.id, Object.fromEntries(Object.entries(layer.columns()).map(([name, column]) => [name, column.slice()]))])),
    };
  }

  drain(): WorldDelta {
    const tiles = Int32Array.from(this.changed);
    this.changed.clear();
    return {
      tiles,
      layers: Object.fromEntries(this.layers.map((layer) => [layer.id, layer.pack(tiles)])),
      confinement: this.movement.confinement,
    };
  }

  introduce(): WorldDelta {
    for (const layer of this.layers) layer.introduce();
    return this.drain();
  }

  apply(delta: WorldDelta): void {
    const { tiles } = delta;
    for (let at = 0; at < tiles.length; at += 1) {
      const tile = tiles[at]!;
      this.stamp(tile);
    }
    for (const layer of this.layers) for (const tile of layer.unpack(tiles, delta.layers[layer.id]) ?? []) this.stamp(tile);
    this.movement.confinement = delta.confinement;
  }

  get count(): number {
    return this.grid.count;
  }

  tile(index: TileIndex): Tile {
    return new Tile(this, index);
  }

  tileAt(point: Vec2): Tile {
    return new Tile(this, this.grid.atPoint(point));
  }

  biomeOf(index: TileIndex): Biome {
    return this.biome[index] as Biome;
  }

  elevationOf(index: TileIndex): number {
    return this.field.height[index]!;
  }

  coverOf(index: TileIndex): Cover {
    return this.cover[index] as Cover;
  }

  wearOf(index: TileIndex): number {
    return this.trails.wear[index]!;
  }

  walkable(index: TileIndex): boolean {
    if (index === NOWHERE) return false;
    return !isWater(this.biome[index] as Biome);
  }

  drinkable(index: TileIndex): boolean {
    if (index === NOWHERE) return false;
    return this.river[index] !== 0 || this.biome[index] === Biome.Lake;
  }

  snapshot(): WorldState {
    return {
      layers: Object.fromEntries(this.layers.map((layer) => [layer.id, layer.snapshot()])),
    };
  }

  restore(saved: WorldState): void {
    for (const layer of this.layers) if (saved.layers?.[layer.id] !== undefined) layer.restore(saved.layers[layer.id]);
    for (let block = 0; block < this.stamps.length; block += 1) this.stamps[block] = this.stamps[block]! + 1;
    this.revision += 1;
  }

  fell(index: TileIndex): boolean {
    if (this.cover[index] !== Cover.Tree) return false;
    if (!this.plants.fell(index)) this.cover[index] = Cover.Fallen;
    this.touch(index);
    return true;
  }

  grow(days: number, phase: number): void {
    this.plants.advance(days, phase);
  }

  clear(index: TileIndex): void {
    if (this.cover[index] === Cover.Bare) return;
    this.plants.clearAll(index);
    this.touch(index);
  }

  mark(index: TileIndex): void {
    this.changed.add(index);
  }

  touch(index: TileIndex): void {
    this.changed.add(index);
    this.stamp(index);
  }

  private heldFast(i: TileIndex): boolean {
    return this.structures.storage[i] === 1 || this.structures.floor[i] === 1 || this.structures.fire[i] === 1 || this.structures.ember[i] === 1 || this.structures.torch[i] === 1 || this.structures.built[i] !== Building.None;
  }

  private stamp(index: TileIndex): void {
    const block =
      ((this.grid.rowOf(index) / BLOCK_TILES) | 0) * this.blockColumns +
      ((this.grid.columnOf(index) / BLOCK_TILES) | 0);
    this.stamps[block] = this.stamps[block]! + 1;
    this.revision += 1;
  }

  stampOver(bounds: Bounds): number {
    const { grid } = this;
    const first = (grid.column(bounds.minX) / BLOCK_TILES) | 0;
    const last = (grid.column(bounds.maxX) / BLOCK_TILES) | 0;
    const top = (grid.row(bounds.minY) / BLOCK_TILES) | 0;
    const bottom = (grid.row(bounds.maxY) / BLOCK_TILES) | 0;

    let hash = 0;
    for (let row = top; row <= bottom; row += 1) {
      for (let column = first; column <= last; column += 1) {
        hash = Math.imul(hash ^ this.stamps[row * this.blockColumns + column]!, 0x01000193) >>> 0;
      }
    }
    return hash;
  }

}
