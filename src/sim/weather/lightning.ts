import type { World } from '../world.ts';
import type { StormDamage } from './stormDamage.ts';
import type { Winds } from './winds.ts';
import { clampBetween, hashThreeIntegers, smoothstepBetween } from './weatherMath.ts';
import type { WeatherGrid } from './weatherGrid.ts';

export interface Bolt {
  id: number;
  ox: number;
  oy: number;
  ex: number;
  ey: number;
  ground: boolean;
}

const CHARGE_GATHERED_PER_DAY = 5;
const CHARGE_LEAKED_PER_DAY = 0.7 * 40;
const CHARGE_NEEDED_TO_DISCHARGE = 1;
const CHARGE_LEFT_AFTER_DISCHARGE = 0.18;
const SHARE_OF_BOLTS_REACHING_GROUND = 0.4;
const NEIGHBOUR_RELIEF_RADIUS_CELLS = 2;
const NEIGHBOUR_CHARGE_RELIEVED = 0.5;
const RECENT_BOLTS_KEPT = 48;
const CHANCE_A_GROUND_BOLT_FELLS_A_TREE = 0.6;
const MINIMUM_THUNDER_TO_GATHER_CHARGE = 0.25;

export class Lightning {
  readonly charge: Float32Array;
  readonly recentBolts: Bolt[] = [];
  dischargeCount = 0;
  groundStrikeCount = 0;
  latestGroundStrike = { x: 0, y: 0 };

  constructor(
    private readonly world: World,
    private readonly grid: WeatherGrid,
    private readonly damage: StormDamage,
  ) {
    this.charge = grid.createCellArray();
  }

  gatherAndRelease(
    tickIndex: number,
    elapsedDays: number,
    thunder: Float32Array,
    surfaceTemperature: Float32Array,
    winds: Winds,
  ): void {
    for (let row = 0; row < this.grid.rows; row += 1) {
      for (let column = 0; column < this.grid.columns; column += 1) {
        const cell = this.grid.cellIndex(column, row);
        const thunderHere = thunder[cell]!;

        if (thunderHere > MINIMUM_THUNDER_TO_GATHER_CHARGE) {
          const warmthLift = thunderHere * thunderHere * (0.4 + 0.6 * clampBetween((surfaceTemperature[cell]! - 8) / 18));
          const activeCore = smoothstepBetween(0.55, 0.85, winds.stormCore[cell]!);
          const pressureDrive = 0.4 + 2.2 * winds.pressureContrast[cell]!;
          this.charge[cell] = this.charge[cell]! + CHARGE_GATHERED_PER_DAY * warmthLift * activeCore * pressureDrive * elapsedDays;
        } else {
          this.charge[cell] = Math.max(0, this.charge[cell]! - CHARGE_LEAKED_PER_DAY * elapsedDays);
        }

        if (this.charge[cell]! >= CHARGE_NEEDED_TO_DISCHARGE) {
          this.discharge(tickIndex, column, row, cell);
        }
      }
    }
  }

  strikeGroundAt(tile: number, chanceOfFellingTree = 1): void {
    const { grid } = this.world;
    const x = grid.x(grid.columnOf(tile));
    const y = grid.y(grid.rowOf(tile));
    this.groundStrikeCount += 1;
    this.latestGroundStrike = { x, y };
    this.recordBolt(x, y, true, this.groundStrikeCount);
    this.damage.fellTreeAt(tile, chanceOfFellingTree, this.groundStrikeCount);
  }

  private discharge(tickIndex: number, column: number, row: number, cell: number): void {
    this.charge[cell] = CHARGE_LEFT_AFTER_DISCHARGE * hashThreeIntegers(tickIndex, cell, 70);
    const tile = this.damage.randomTileInCell(column, row, tickIndex, cell, 91);
    if (tile < 0) return;

    const { grid } = this.world;
    const reachesGround = hashThreeIntegers(tickIndex, cell, 71) < SHARE_OF_BOLTS_REACHING_GROUND;
    if (reachesGround) this.strikeGroundAt(tile, CHANCE_A_GROUND_BOLT_FELLS_A_TREE);
    else this.recordBolt(grid.x(grid.columnOf(tile)), grid.y(grid.rowOf(tile)), false, cell);

    for (let rowOffset = -NEIGHBOUR_RELIEF_RADIUS_CELLS; rowOffset <= NEIGHBOUR_RELIEF_RADIUS_CELLS; rowOffset += 1) {
      for (let columnOffset = -NEIGHBOUR_RELIEF_RADIUS_CELLS; columnOffset <= NEIGHBOUR_RELIEF_RADIUS_CELLS; columnOffset += 1) {
        const neighbourColumn = column + columnOffset;
        const neighbourRow = row + rowOffset;
        const isOffGrid =
          neighbourColumn < 0 || neighbourRow < 0 || neighbourColumn >= this.grid.columns || neighbourRow >= this.grid.rows;
        if (isOffGrid) continue;
        const neighbour = this.grid.cellIndex(neighbourColumn, neighbourRow);
        this.charge[neighbour] = Math.max(0, this.charge[neighbour]! - NEIGHBOUR_CHARGE_RELIEVED);
      }
    }
  }

  private recordBolt(endX: number, endY: number, reachesGround: boolean, salt: number): void {
    this.dischargeCount += 1;
    const angle = hashThreeIntegers(this.dischargeCount, salt, 21) * Math.PI * 2;
    const length =
      (reachesGround ? 14 : 34) + hashThreeIntegers(this.dischargeCount, salt, 22) * (reachesGround ? 26 : 40);
    const offsetX = Math.cos(angle) * length;
    const offsetY = Math.sin(angle) * length;
    const bolt: Bolt = reachesGround
      ? { id: this.dischargeCount, ox: endX - offsetX, oy: endY - offsetY, ex: endX, ey: endY, ground: true }
      : { id: this.dischargeCount, ox: endX, oy: endY, ex: endX + offsetX, ey: endY + offsetY, ground: false };
    this.recentBolts.push(bolt);
    if (this.recentBolts.length > RECENT_BOLTS_KEPT) this.recentBolts.shift();
  }
}
