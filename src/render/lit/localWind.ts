import type { SkyView } from '../../sim/weather/skyView.ts';
import { readCell } from '../../sim/weather/skyView.ts';
import type { World } from '../../sim/world.ts';

const SHELTER_FLOOR = 0.35;

export function windOver(world: World, sky: SkyView, x: number, y: number): readonly [number, number] {
  const column = world.grid.column(x);
  const row = world.grid.row(y);
  const air = readCell(sky, sky.cellContainingTile(column, row));
  const exposure = SHELTER_FLOOR + (1 - SHELTER_FLOOR) * ((world.wind[world.grid.at(column, row)] ?? 0) / 255);
  return [air.windEast * exposure, air.windSouth * exposure];
}
