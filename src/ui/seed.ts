import { hashString } from '../sim/rng.ts';
import { landFraction } from '../sim/terrain.ts';

/** How much of a rolled map has to be land before it is worth opening on. */
const MIN_LAND = 0.15;

/**
 * Kept apart from `game.ts` because the seed has to be known *before* the world exists.
 *
 * `game.ts` builds its world the moment it is imported, so anything that reads the seed from
 * there drags a world into being with it — and the point of the worker is to have the world
 * already waiting by then.
 */
export function seedFrom(text: string): number {
  const trimmed = text.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) >>> 0;
  return trimmed === '' ? randomSeed() : hashString(trimmed);
}

/**
 * A rolled seed is also a *playable* one: the noise comes up almost all sea about one time in
 * ten, and a world with a scrap of beach in it is not one to open on. A seed the player asked
 * for by name is never re-rolled — that map is theirs, ocean or not.
 *
 * `landFraction` samples the height field rather than building it, so this stays cheap even on
 * a large world; it is the one thing about a seed that can be known without the whole pass.
 */
export function randomSeed(): number {
  let best = Math.floor(Math.random() * 0x7fffffff);
  let bestLand = landFraction(best);

  for (let attempt = 0; attempt < 8 && bestLand < MIN_LAND; attempt += 1) {
    const candidate = Math.floor(Math.random() * 0x7fffffff);
    const land = landFraction(candidate);
    if (land > bestLand) {
      best = candidate;
      bestLand = land;
    }
  }

  return best;
}

export function rememberSeed(seed: number): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('seed', String(seed));
  window.history.replaceState(null, '', url);
}

/**
 * The seed this page is playing, written back into the address bar so the map is shareable —
 * and so that reading it a second time, once the world is ready, gives the same answer.
 */
export function startingSeed(): number {
  if (typeof window === 'undefined') return randomSeed();
  const asked = new URLSearchParams(window.location.search).get('seed');
  const seed = asked === null ? randomSeed() : seedFrom(asked);
  rememberSeed(seed);
  return seed;
}
