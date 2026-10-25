import { World } from '../../src/sim/world.ts';

export const SEED = 20250214;

let built: World | null = null;

export function world(): World {
  built ??= World.generate(SEED);
  return built;
}
