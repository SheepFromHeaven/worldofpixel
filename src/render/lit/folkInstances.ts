import type { People } from '../../modules/people/api.ts';
import type { World } from '../../sim/world.ts';
import type { Stamp } from '../../modules/clientSlots.ts';
import { drawablesInOrder } from '../../modules/client.ts';
import { TEXEL } from '../terrainPixels.ts';
import type { LitView } from './litLayer.ts';
import { flagsOf } from './litLayerConstants.ts';
import type { GrownEntry } from './grownTrees.ts';
import type { FolkBodies, SpriteSheetEntry } from './propPlacementCache.ts';
import { grownRow } from './propPlacementCache.ts';

const PIXELS_OFFSCREEN_TILES = 2;

export interface Folk extends FolkBodies {
  instances: Float32Array;
}

export function folkInstances(
  world: World,
  people: People,
  view: LitView,
  entryOf: (name: string) => SpriteSheetEntry | undefined,
  grownOf: (name: string) => GrownEntry | undefined = () => undefined,
): Folk {
  const out: number[] = [];
  const shadowRows: number[] = [];
  const bodyRows = new Map<string, number[]>();

  const push = (entry: SpriteSheetEntry, x: number, y: number, flip: boolean, height = entry.height, rimmed = false, lift = 0): void => {
    const flags = flagsOf({ ...entry, rimmed, focus: true });
    out.push(x, y, entry.x, entry.y, entry.size, entry.foot.x, entry.foot.y + lift, height, flip ? 1 : 0, 0, entry.sway, flags);
  };

  const placeItem = (name: string, entry: SpriteSheetEntry, x: number, y: number, flip: boolean, height: number, rimmed: boolean, raise: number): void => {
    const grown = grownOf(name);
    if (!grown) {
      push(entry, x, y, flip, height, rimmed, raise / TEXEL);
      return;
    }
    shadowRows.push(x, y, entry.x, entry.y, entry.size, entry.foot.x, entry.foot.y, height, flip ? 1 : 0, 0, entry.sway, flagsOf({ ...entry, rimmed, focus: true }));
    const art = name.split('.').slice(0, 2).join('.');
    const rows = bodyRows.get(art) ?? bodyRows.set(art, []).get(art)!;
    const row = grownRow(x, y, flip, 0, grown, flagsOf({ ...grown, emit: false, rimmed, focus: true }));
    row[6] = row[6]! + raise / TEXEL;
    rows.push(...row);
  };

  const halfWide = view.width / (2 * view.zoom) + PIXELS_OFFSCREEN_TILES;
  const halfTall = view.height / (2 * view.zoom) + PIXELS_OFFSCREEN_TILES;

  const stamp: Stamp = {
    time: view.time,
    ghost: view.ghost,
    seen: (x, y) => Math.abs(x - view.centre.x) <= halfWide && Math.abs(y - view.centre.y) <= halfTall,
    has: (name) => entryOf(name) !== undefined,
    grown: (name) => grownOf(name) !== undefined,
    height: (name) => entryOf(name)?.height,
    place: (name, x, y, flip = false, options = {}) => {
      const entry = entryOf(name);
      if (!entry) return false;
      placeItem(name, entry, x, y, flip, options.height ?? entry.height, options.rimmed ?? false, options.raise ?? 0);
      return true;
    },
    flat: (name, x, y, options = {}) => {
      const entry = entryOf(name);
      if (!entry) return false;
      push(entry, x, y, options.flip ?? false, options.height ?? entry.height);
      return true;
    },
    flame: (x, y, headX, headY, height) => {
      const flame = entryOf(`torch.flame.${Math.floor(view.time * 5 + x * 1.7) % 4}`);
      if (flame) push(flame, x + headX * TEXEL, y + headY * TEXEL, false, height);
    },
  };
  for (const drawable of drawablesInOrder()) drawable.draw(world, people, stamp);

  const bodies = new Map<string, Float32Array>();
  for (const [art, rows] of bodyRows) bodies.set(art, new Float32Array(rows));
  return { instances: new Float32Array(out), shadows: new Float32Array(shadowRows), bodies };
}
