import type { Homes } from '../../sim/homes/homes.ts';
import type { LitView } from './litLayer.ts';

export const PACKED_HOME_FLOATS = 8;

const VIEW_MARGIN_TILES = 6;

const TEXELS_PER_METRE = 16;

export function homeInstances(homes: Homes, view: LitView, now: number): { data: Float32Array; count: number } {
  const halfWidth = view.width / (2 * view.zoom) + VIEW_MARGIN_TILES;
  const halfHeight = view.height / (2 * view.zoom) + VIEW_MARGIN_TILES;
  const out: number[] = [];
  for (let id = 0; id < homes.used; id += 1) {
    if (!homes.exists(id)) continue;
    const x = homes.x[id]!;
    const y = homes.y[id]!;
    if (Math.abs(x - view.centre.x) > halfWidth || Math.abs(y - view.centre.y) > halfHeight) continue;
    const entrances = homes.entrances[id]!;
    const seed = (homes.owner[id]! * 0.137 + id * 0.61803) % 1;
    out.push(x, y, homes.progress(id, now), entrances, 1, (TEXELS_PER_METRE * (1.1 + 0.18 * entrances)), seed * 6.283, entrances - 1);
  }
  return { data: new Float32Array(out), count: out.length / PACKED_HOME_FLOATS };
}
