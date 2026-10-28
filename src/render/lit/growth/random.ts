export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export const hash3 = (x: number, y: number, z: number, seed: number): number =>
  (Math.imul((x * 73856093) ^ (y * 19349663) ^ (z * 83492791) ^ (seed * 2654435761), 0x27d4eb2d) >>> 0) / 4294967296;

export const seedOf = (name: string): number => {
  let seed = 5381;
  for (let at = 0; at < name.length; at += 1) seed = (Math.imul(seed, 33) + name.charCodeAt(at)) >>> 0;
  return seed;
};

export const between = (random: () => number, low: number, high: number): number => low + (high - low) * random();
