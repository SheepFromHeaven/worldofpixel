import { restoreWorld, saveWorld } from '../sim/save.ts';
import type { GameWorld } from '../sim/world.ts';

const PREFIX = 'scribble-empire/world/';

const keyFor = (seed: number): string => `${PREFIX}${seed}`;

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
