import type { Bounds, Vec2 } from './geometry.ts';
import type { TileIndex } from './grid.ts';
import { AROUND, NOWHERE, SIDES } from './grid.ts';
import type { Aqua } from './aquatic.ts';
import { flowOf } from './aquatic.ts';
import type { Cover, World } from './world.ts';
import { COVER_NAMES } from './world.ts';
import { describePlants } from './plants/describe.ts';
import type { Biome } from './types.ts';
import { BIOME_NAMES } from './types.ts';
import type { ItemType } from './people/items.ts';
import { isWater, waterCheck } from './terrain/worldfield.ts';

export class Tile {
  constructor(
    private readonly world: World,
    readonly index: TileIndex,
  ) {}

  get exists(): boolean {
    return this.index !== NOWHERE;
  }

  get column(): number {
    return this.world.grid.columnOf(this.index);
  }

  get row(): number {
    return this.world.grid.rowOf(this.index);
  }

  get centre(): Vec2 {
    return this.world.grid.centre(this.index);
  }

  get bounds(): Bounds {
    return this.world.grid.bounds(this.index);
  }

  get biome(): Biome {
    return this.world.biomeOf(this.index);
  }

  get elevation(): number {
    return this.world.elevationOf(this.index);
  }

  get cover(): Cover {
    return this.world.coverOf(this.index);
  }

  get wear(): number {
    return this.world.wearOf(this.index);
  }

  get wind(): number {
    return this.world.wind[this.index]!;
  }

  get steep(): number {
    return this.world.steep[this.index]!;
  }

  get eco(): number {
    return this.world.eco[this.index]!;
  }

  get aqua(): Aqua {
    return this.world.aqua[this.index] as Aqua;
  }

  get flow(): number {
    return flowOf(this.world.flow[this.index]!);
  }

  get isWater(): boolean {
    return isWater(this.biome);
  }

  get walkable(): boolean {
    return this.world.walkable(this.index);
  }

  get passable(): boolean {
    return this.world.passable(this.index);
  }

  get stack(): ItemType[] {
    return this.world.items.at(this.index).map((slot) => this.world.items.kind[slot] as ItemType);
  }

  get name(): string {
    return BIOME_NAMES[this.biome] ?? 'nowhere';
  }

  get standing(): string {
    return describePlants(this.world, this.index) ?? COVER_NAMES[this.cover] ?? 'nothing';
  }

  get storage(): boolean {
    return this.world.storage[this.index] === 1;
  }

  get floor(): boolean {
    return this.world.floor[this.index] === 1;
  }

  get fire(): boolean {
    return this.world.fire[this.index] === 1;
  }

  get river(): boolean {
    return this.world.river[this.index] !== 0;
  }

  get refusal(): string | null {
    return waterCheck(this.biome) ?? (this.river ? 'the river runs through here' : null);
  }

  tread(steps = 1): void {
    this.world.tread(this.index, steps);
  }

  clear(): void {
    this.world.clear(this.index);
  }

  step(dx: number, dy: number): Tile {
    const { grid } = this.world;
    return new Tile(this.world, grid.at(this.column + dx, this.row + dy));
  }

  get sides(): Tile[] {
    return SIDES.map(([dx, dy]) => this.step(dx, dy)).filter((tile) => tile.exists);
  }

  get around(): Tile[] {
    return AROUND.map(([dx, dy]) => this.step(dx, dy)).filter((tile) => tile.exists);
  }
}
