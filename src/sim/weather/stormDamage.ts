import type { World } from '../world.ts';
import { WEATHER_STEP } from '../terrain/weather.ts';
import { hashThreeIntegers } from './weatherMath.ts';
import type { WeatherGrid } from './weatherGrid.ts';

const TICK_DAYS = 1 / 240;
const SNOW_WEIGHT_THRESHOLD = 0.55;
const MINIMUM_HAZARD = 0.05;

export class StormDamage {
  treesFelled = 0;

  constructor(
    private readonly world: World,
    private readonly grid: WeatherGrid,
  ) {}

  fellTreesInStorms(
    tickIndex: number,
    elapsedDays: number,
    galeStrength: Float32Array,
    thunder: Float32Array,
    snowfall: Float32Array,
    snowCover: Float32Array,
    wetness: Float32Array,
  ): void {
    const ticksElapsed = elapsedDays / TICK_DAYS;
    for (let row = 0; row < this.grid.rows; row += 1) {
      for (let column = 0; column < this.grid.columns; column += 1) {
        const cell = this.grid.cellIndex(column, row);
        const snowLoad = snowCover[cell]! > SNOW_WEIGHT_THRESHOLD ? snowfall[cell]! * 0.25 : 0;
        const hazard =
          (galeStrength[cell]! ** 2 * 0.8 + thunder[cell]! * 0.15 + snowLoad) * (0.6 + 0.4 * wetness[cell]!);
        if (hazard <= MINIMUM_HAZARD) continue;

        const attempts = Math.floor(hazard * 8 * ticksElapsed + hashThreeIntegers(tickIndex, cell, 1));
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          const tile = this.randomTileInCell(column, row, tickIndex, cell, 10 + attempt);
          const fellsThisOne = hashThreeIntegers(tickIndex, cell, 40 + attempt) < 0.4;
          if (tile >= 0 && fellsThisOne && this.world.fell(tile)) this.treesFelled += 1;
        }
      }
    }
  }

  fellTreeAt(tile: number, chanceOfFelling: number, salt: number): void {
    if (chanceOfFelling >= 1 || hashThreeIntegers(salt, tile, 7) < chanceOfFelling) {
      if (this.world.fell(tile)) this.treesFelled += 1;
    }
  }

  randomTileInCell(column: number, row: number, tickIndex: number, cell: number, salt: number): number {
    const { grid } = this.world;
    const tileColumn = column * WEATHER_STEP + Math.floor(hashThreeIntegers(tickIndex, cell, salt) * WEATHER_STEP);
    const tileRow = row * WEATHER_STEP + Math.floor(hashThreeIntegers(tickIndex, cell, salt + 500) * WEATHER_STEP);
    if (tileColumn >= grid.columns || tileRow >= grid.rows) return -1;
    return tileRow * grid.columns + tileColumn;
  }
}
