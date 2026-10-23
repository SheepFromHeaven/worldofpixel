import type { Bounds, Vec2 } from './geometry.ts';
import type { TileIndex } from './grid.ts';
import { AROUND, NOWHERE, SIDES } from './grid.ts';
import type { Cover, World } from './world.ts';
import { COVER_NAMES } from './world.ts';
import type { Biome } from './types.ts';
import { BIOME_NAMES } from './types.ts';
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

  get isWater(): boolean {
    return isWater(this.biome);
  }

  get walkable(): boolean {
    return this.world.walkable(this.index);
  }

  get name(): string {
    return BIOME_NAMES[this.biome] ?? 'nowhere';
  }

  get standing(): string {
    return COVER_NAMES[this.cover] ?? 'nothing';
  }

  get refusal(): string | null {
    return waterCheck(this.biome);
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
