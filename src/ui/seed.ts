import { hashString } from '../sim/rng.ts';
import { landFraction } from '../sim/terrain/terrain.ts';

const MIN_LAND = 0.15;

export function seedFrom(text: string): number {
  const trimmed = text.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) >>> 0;
  return trimmed === '' ? randomSeed() : hashString(trimmed);
}

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
