import type { Latitudes } from './climate.ts';
import { altitudeOf, latitudeAt } from './climate.ts';
import type { FieldGrid } from './heightmap.ts';
import { cellY } from './heightmap.ts';
import { Water } from './hydrology.ts';

export const WEATHER_STEP = 16;

export interface Weather {
  columns: number;
  rows: number;
  step: number;
  data: Uint8Array;
  warmth: Float32Array;
  humid: Float32Array;
  gale: Float32Array;
  standing: Float32Array;
  latitude: Float32Array;
  altitude: Float32Array;
}

const WET_FULL = 12;
const WARM_END = 24;
const COOL_SPAN = 16;

const clamp = (value: number, low = 0, high = 1): number => Math.min(high, Math.max(low, value));

export function weatherOf(
  grid: FieldGrid,
  wet: Float32Array,
  temperature: Float32Array,
  wind: Uint8Array,
  height: Float32Array,
  water: Uint8Array,
  latitudes: Latitudes,
): Weather {
  const columns = Math.ceil(grid.columns / WEATHER_STEP);
  const rows = Math.ceil(grid.rows / WEATHER_STEP);
  const data = new Uint8Array(columns * rows * 4);
  const warmths = new Float32Array(columns * rows);
  const humids = new Float32Array(columns * rows);
  const gales = new Float32Array(columns * rows);
  const standings = new Float32Array(columns * rows);
  const latitude = new Float32Array(columns * rows);
  const altitudes = new Float32Array(columns * rows);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let moisture = 0;
      let warmth = 0;
      let gale = 0;
      let altitude = 0;
      let standing = 0;
      let count = 0;

      const fromRow = row * WEATHER_STEP;
      const fromColumn = column * WEATHER_STEP;
      for (let y = fromRow; y < Math.min(grid.rows, fromRow + WEATHER_STEP); y += 1) {
        for (let x = fromColumn; x < Math.min(grid.columns, fromColumn + WEATHER_STEP); x += 1) {
          const at = y * grid.columns + x;
          moisture += wet[at]!;
          warmth += temperature[at]!;
          gale += wind[at]!;
          altitude += altitudeOf(height[at]!);
          if (water[at] !== Water.None) standing += 1;
          count += 1;
        }
      }

      const humidity = clamp(moisture / count / WET_FULL);
      const surface = standing / count;
      const humid = clamp(humidity * 0.75 + surface * 0.6);
      const calm = 1 - gale / count / 255;
      const cool = clamp((WARM_END - warmth / count) / COOL_SPAN);
      const high = clamp(altitude / count);

      const fog = clamp(humid ** 1.1 * (0.35 + 0.65 * calm) * (0.3 + 0.7 * cool) * (0.5 + 0.5 * (1 - high * 0.6)) * 1.6);
      const cloud = clamp(0.2 + 0.55 * humid + 0.35 * high);

      const cell = row * columns + column;
      altitudes[cell] = high;
      latitude[cell] = latitudeAt(latitudes, cellY(grid, Math.min(grid.rows - 1, fromRow + WEATHER_STEP / 2)));
      warmths[cell] = warmth / count;
      humids[cell] = humid;
      gales[cell] = gale / count / 255;
      standings[cell] = surface;

      const at = cell * 4;
      data[at] = Math.round(fog * 255);
      data[at + 1] = Math.round(cloud * 255);
      data[at + 2] = Math.round(gale / count);
      data[at + 3] = 255;
    }
  }

  return { columns, rows, step: WEATHER_STEP, data, warmth: warmths, humid: humids, gale: gales, standing: standings, latitude, altitude: altitudes };
}
