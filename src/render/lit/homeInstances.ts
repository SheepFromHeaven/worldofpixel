import { MAMMALS } from '../../sim/mammals/species.ts';
import type { Homes } from '../../sim/homes/homes.ts';
import type { LitView } from './litLayer.ts';

export const PACKED_HOME_FLOATS = 8;

const VIEW_MARGIN_TILES = 6;

const TEXELS_PER_METRE = 16;

const BASE_METRES = 0.55;

const METRES_PER_LENGTH = 3.4;

const entranceMetres = (owner: number): number => BASE_METRES + METRES_PER_LENGTH * (MAMMALS[owner]?.length ?? 0.4);

const SPREAD_TILES = 12;

export function homeInstances(homes: Homes, view: LitView, now: number): { data: Float32Array; count: number } {
  const halfWidth = view.width / (2 * view.zoom) + VIEW_MARGIN_TILES;
  const halfHeight = view.height / (2 * view.zoom) + VIEW_MARGIN_TILES;
  const out: number[] = [];
  for (let id = 0; id < homes.used; id += 1) {
    if (!homes.exists(id)) continue;
    if (Math.abs(homes.x[id]! - view.centre.x) > halfWidth + SPREAD_TILES || Math.abs(homes.y[id]! - view.centre.y) > halfHeight + SPREAD_TILES) continue;
    for (let index = 0; index < homes.entrances[id]!; index += 1) {
      const [x, y] = homes.entranceAt(id, index);
      if (Math.abs(x - view.centre.x) > halfWidth || Math.abs(y - view.centre.y) > halfHeight) continue;
      const seed = (homes.owner[id]! * 0.137 + id * 0.61803 + index * 0.37) % 1;
      out.push(x, y, homes.entranceProgress(id, index, now), 1, 1, TEXELS_PER_METRE * entranceMetres(homes.owner[id]!), seed * 6.283, 0);
    }
  }
  return { data: new Float32Array(out), count: out.length / PACKED_HOME_FLOATS };
}
