import type { TileGrid } from '../grid.ts';
import { WEATHER_STEP } from '../terrain/weather.ts';
import { smoothstepBetween } from './weatherMath.ts';
import type { WeatherGrid } from './weatherGrid.ts';

export const MAX_PRESSURE_CENTRES = 16;

const CENTRE_SEARCH_RADIUS_CELLS = 8;
const WEAKEST_VISIBLE_ANOMALY = 1.2;
const FULL_STRENGTH_ANOMALY = 2.6;

export interface PressureCentre {
  x: number;
  y: number;
  strength: number;
}

export function findPressureCentres(
  grid: WeatherGrid,
  tileGrid: TileGrid,
  pressureAnomaly: Float32Array,
): PressureCentre[] {
  const found: PressureCentre[] = [];

  for (let row = 1; row < grid.rows - 1; row += 1) {
    for (let column = 1; column < grid.columns - 1; column += 1) {
      const anomalyHere = pressureAnomaly[grid.cellIndex(column, row)]!;
      const strength = smoothstepBetween(WEAKEST_VISIBLE_ANOMALY, FULL_STRENGTH_ANOMALY, Math.abs(anomalyHere));
      if (strength <= 0) continue;
      if (!isLocalExtreme(grid, pressureAnomaly, column, row, anomalyHere)) continue;

      found.push({
        x: tileGrid.x(column * WEATHER_STEP + WEATHER_STEP / 2),
        y: tileGrid.y(row * WEATHER_STEP + WEATHER_STEP / 2),
        strength: anomalyHere > 0 ? strength : -strength,
      });
    }
  }

  return found
    .sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength) || a.y - b.y || a.x - b.x)
    .slice(0, MAX_PRESSURE_CENTRES);
}

function isLocalExtreme(
  grid: WeatherGrid,
  pressureAnomaly: Float32Array,
  column: number,
  row: number,
  anomalyHere: number,
): boolean {
  for (let rowOffset = -CENTRE_SEARCH_RADIUS_CELLS; rowOffset <= CENTRE_SEARCH_RADIUS_CELLS; rowOffset += 1) {
    for (let columnOffset = -CENTRE_SEARCH_RADIUS_CELLS; columnOffset <= CENTRE_SEARCH_RADIUS_CELLS; columnOffset += 1) {
      const neighbourColumn = column + columnOffset;
      const neighbourRow = row + rowOffset;
      const isSelf = columnOffset === 0 && rowOffset === 0;
      const isOffGrid =
        neighbourColumn < 0 || neighbourRow < 0 || neighbourColumn >= grid.columns || neighbourRow >= grid.rows;
      if (isSelf || isOffGrid) continue;

      const neighbourAnomaly = pressureAnomaly[grid.cellIndex(neighbourColumn, neighbourRow)]!;
      const isTieBrokenAgainstUs = rowOffset < 0 || (rowOffset === 0 && columnOffset < 0);
      const isBeaten =
        anomalyHere > 0
          ? neighbourAnomaly > anomalyHere || (neighbourAnomaly === anomalyHere && isTieBrokenAgainstUs)
          : neighbourAnomaly < anomalyHere || (neighbourAnomaly === anomalyHere && isTieBrokenAgainstUs);
      if (isBeaten) return false;
    }
  }
  return true;
}
