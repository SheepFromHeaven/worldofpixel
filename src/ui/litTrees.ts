import type { SeeThrough } from '../render/lit/litLayer.ts';
import type { Vec2 } from '../sim/geometry.ts';
import type { People } from '../sim/people/people.ts';
import { NOBODY } from '../sim/people/people.ts';

const FOCUS_RADIUS_TILES = 1.8;
const FOCUS_LIFT_TILES = 0.35;
const CURSOR_RADIUS_TILES = 3.2;
const CURSOR_LIFT_TILES = 0.5;
export const CURSOR_SEE_THROUGH_FROM_ZOOM = 30;

export function seeThroughFoci(people: People, selected: number, cursor: Vec2 | null): SeeThrough[] {
  const chosen = selected !== NOBODY ? [selected] : Array.from({ length: people.count }, (_, person) => person);
  const foci = chosen.map((person) => ({ x: people.posX[person]!, y: people.posY[person]!, lift: FOCUS_LIFT_TILES, radius: FOCUS_RADIUS_TILES }));
  return cursor ? [{ x: cursor.x, y: cursor.y, lift: CURSOR_LIFT_TILES, radius: CURSOR_RADIUS_TILES }, ...foci] : foci;
}
