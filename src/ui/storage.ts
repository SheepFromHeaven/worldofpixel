import { restoreWorld, saveWorld } from '../sim/save.ts';
import type { GameWorld } from '../sim/world.ts';

/**
 * Where a world is kept between visits: `localStorage`, one entry per seed.
 *
 * The seed is the key because the seed is the map — `?seed=` already decides which world the
 * page opens, so what has been built on it belongs under the same name. Arriving on a seed that
 * has been played before is arriving back in that town; rolling a fresh seed is a fresh world,
 * and the old one is still there when its seed is asked for again.
 */

const PREFIX = 'scribble-empire/world/';

const keyFor = (seed: number): string => `${PREFIX}${seed}`;

/** Safari in private mode throws on `localStorage` rather than merely refusing to keep anything. */
function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadWorld(seed: number): { world: GameWorld; tick: number } | null {
  const text = store()?.getItem(keyFor(seed));
  if (!text) return null;

  try {
    return restoreWorld(JSON.parse(text), seed);
  } catch {
    return null;
  }
}

export function storeWorld(world: GameWorld, tick: number): void {
  const local = store();
  if (!local) return;

  const text = JSON.stringify(saveWorld(world, tick));
  try {
    local.setItem(keyFor(world.seed), text);
  } catch {
    // Out of room: the worlds nobody is playing go first, and this one is written again. If it
    // still will not fit, the game plays on unsaved rather than stopping to say so.
    forgetOthers(world.seed);
    try {
      local.setItem(keyFor(world.seed), text);
    } catch {
      console.warn('the world could not be saved: no room left in local storage');
    }
  }
}

function forgetOthers(seed: number): void {
  const local = store();
  if (!local) return;

  const keys: string[] = [];
  for (let index = 0; index < local.length; index += 1) {
    const key = local.key(index);
    if (key?.startsWith(PREFIX) && key !== keyFor(seed)) keys.push(key);
  }
  for (const key of keys) local.removeItem(key);
}
