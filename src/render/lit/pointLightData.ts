import { TILE } from '../../sim/grid.ts';
import type { Lighting } from './lighting.ts';
import { MAX_POINTS } from './lighting.ts';

export interface PointLightData {
  count: number;
  positionsAndReach: Float32Array;
  colours: Float32Array;
}

export function packPointLights(lighting: Lighting): PointLightData {
  const lights = lighting.points.slice(0, MAX_POINTS);
  const positionsAndReach = new Float32Array(MAX_POINTS * 4);
  const colours = new Float32Array(MAX_POINTS * 3);
  lights.forEach((light, index) => {
    positionsAndReach.set([light.x, light.y, light.reach * TILE, light.strength], index * 4);
    colours.set(light.color, index * 3);
  });
  return { count: lights.length, positionsAndReach, colours };
}
