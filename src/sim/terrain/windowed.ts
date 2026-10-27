import { latitudesOf, prevailing } from './climate.ts';
import { buildCoarse } from './coarse.ts';
import { worldGrid } from './heightmap.ts';
import type { RiverSegment } from './hydrology.ts';
import { weatherOf } from './weather.ts';
import { buildWindow, windowIndex } from './window.ts';
import { winds } from './wind.ts';
import type { FieldProgress, WorldField } from './worldfield.ts';
import { bucketRivers, layRock, markWater } from './worldfield.ts';

const COARSE_TILES = 8;
const SIZE = 256;
const HALO = 32;

export function* windowedSteps(seed: number): Generator<FieldProgress, WorldField, void> {
  const grid = worldGrid();
  const { columns, rows, count } = grid;
  const height = new Float32Array(count);
  const surface = new Float32Array(count);
  const water = new Uint8Array(count);
  const temperature = new Float32Array(count);
  const wet = new Float32Array(count);
  const flux = new Float32Array(count);
  const climate = new Uint8Array(count);
  const of = new Int32Array(count);
  const segments: RiverSegment[] = [];
  let ids = 0;

  yield { label: 'surveying', share: 0.02, grid };
  const coarse = buildCoarse(seed, COARSE_TILES);
  yield { label: 'sketching the continents', share: 0.1, grid };

  const down = Math.ceil(rows / SIZE);
  const across = Math.ceil(columns / SIZE);
  for (let wy = 0; wy < down; wy += 1) {
    for (let wx = 0; wx < across; wx += 1) {
      const column0 = wx * SIZE;
      const row0 = wy * SIZE;
      const width = Math.min(SIZE, columns - column0);
      const span = Math.min(SIZE, rows - row0);
      const win = buildWindow(coarse, null, column0, row0, width, span, { halo: HALO, rock: false });
      for (let row = row0; row < row0 + span; row += 1) {
        for (let column = column0; column < column0 + width; column += 1) {
          const di = row * columns + column;
          const wi = windowIndex(win, column, row);
          height[di] = win.terrain[wi]!;
          surface[di] = win.surface[wi]!;
          water[di] = win.water[wi]!;
          temperature[di] = win.temperature[wi]!;
          wet[di] = win.wet[wi]!;
          flux[di] = win.flux[wi]!;
          climate[di] = win.climate[wi]!;
          if (win.rivers.of[wi] !== 0) of[di] = ids + win.rivers.of[wi]!;
        }
      }
      ids += win.rivers.count;
      const minX = grid.minX + column0;
      const minY = grid.minY + row0;
      for (const segment of win.rivers.segments) {
        if (segment.ax >= minX && segment.ax < minX + width && segment.ay >= minY && segment.ay < minY + span) segments.push(segment);
      }
    }
    yield { label: 'raising the land', share: 0.1 + (0.7 * (wy + 1)) / down, grid, height, water, biome: climate };
  }

  const latitudes = latitudesOf(seed);
  const wind = winds(grid, height, water, latitudes);
  yield { label: 'raising the winds', share: 0.84, grid, height, water };

  const rivers = { of, segments, count: ids };
  const field: WorldField = {
    seed,
    grid,
    height,
    surface,
    water,
    into: new Int32Array(0),
    temperature,
    wet,
    flux,
    biome: climate,
    climate,
    fertility: new Uint8Array(count),
    wind,
    weather: weatherOf(grid, wet, temperature, wind, height, water, latitudes),
    prevailing: prevailing(latitudes),
    rivers,
    reaches: bucketRivers(segments),
    marks: markWater(grid, water, segments),
  };

  layRock(field);
  yield { label: 'laying the rock', share: 0.98, grid, height, water, biome: field.biome };

  return field;
}
