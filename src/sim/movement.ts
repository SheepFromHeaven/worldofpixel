import type { TileGrid, TileIndex } from './grid.ts';
import { NOWHERE } from './grid.ts';
import { BUILDABLES } from '../content/buildables.ts';
import { WEAR_FULL } from '../modules/trails/api.ts';
import { CLIFF_PACE, STEEP_ONE } from './steep.ts';
import { SEA_LEVEL } from './terrain/heightmap.ts';

const BIOME_PACE: readonly number[] = [1, 0.8, 0.7, 0.55, 0.75, 0.7, 0.6, 0.65, 0.6, 0.8, 0.65, 0, 0, 0];

const COVER_PACE: readonly number[] = [1, 1, 0.8, 0.6, 0.7, 0, 0.8];

const STEEPEST_STEP = 0.015;
const CLIMB_PENALTY = 0.3;
const DESCENT_PENALTY = 0.1;
const ALTITUDE_PENALTY = 0.35;
const TRODDEN_BONUS = 0.25;
const SLOWEST_PACE = 0.2;
const FASTEST_PACE = 1.15;

const SOLID: Uint8Array = Uint8Array.from([0, ...BUILDABLES.map((def) => (def.solid ? 1 : 0))]);

export interface Confinement {
  column: number;
  row: number;
  reachX: number;
  reachY: number;
}

export interface MovementGround {
  readonly grid: TileGrid;
  readonly biome: Uint8Array;
  readonly cover: Uint8Array;
  readonly river: Uint8Array;
  readonly height: Float32Array;
  readonly steep: Uint8Array;
  readonly wear: Uint8Array;
  readonly fire: Uint8Array;
  readonly built: Uint8Array;
  readonly block: Uint8Array;
}

export class Movement {
  confinement: Confinement | null = null;

  constructor(private readonly ground: MovementGround) {}

  passable(index: TileIndex): boolean {
    const { ground } = this;
    if (index === NOWHERE || ground.river[index] !== 0 || ground.fire[index] !== 0 || SOLID[ground.built[index]!] === 1 || SOLID[ground.block[index]!] === 1) return false;
    if (this.confinement && !this.within(index)) return false;
    return BIOME_PACE[ground.biome[index]!]! > 0 && COVER_PACE[ground.cover[index]!]! > 0;
  }

  pace(from: TileIndex, to: TileIndex): number {
    if (!this.passable(to)) return 0;
    const { ground } = this;
    const open = BIOME_PACE[ground.biome[to]!]! * COVER_PACE[ground.cover[to]!]!;

    const { height } = ground;
    const rise = (height[to]! - height[from]!) / STEEPEST_STEP;
    const slope = 1 - (rise > 0 ? CLIMB_PENALTY * Math.min(1, rise) : DESCENT_PENALTY * Math.min(1, -rise));
    const sheer = 1 - CLIFF_PACE * (ground.steep[to]! / STEEP_ONE);
    const thin = 1 - ALTITUDE_PENALTY * Math.max(0, (height[to]! - SEA_LEVEL) / (1 - SEA_LEVEL));
    const trodden = 1 + (ground.wear[to]! / WEAR_FULL) * TRODDEN_BONUS;

    return Math.min(FASTEST_PACE, Math.max(SLOWEST_PACE, open * slope * sheer * thin * trodden));
  }

  confine(centre: TileIndex, reachX: number, reachY: number = reachX): void {
    this.confinement = { column: this.ground.grid.columnOf(centre), row: this.ground.grid.rowOf(centre), reachX, reachY };
  }

  unconfine(): void {
    this.confinement = null;
  }

  within(index: TileIndex): boolean {
    const { confinement, ground } = this;
    if (!confinement) return true;
    return Math.abs(ground.grid.columnOf(index) - confinement.column) <= confinement.reachX && Math.abs(ground.grid.rowOf(index) - confinement.row) <= confinement.reachY;
  }
}
