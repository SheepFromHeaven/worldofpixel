import { MARKS } from './decals.ts';
import type { Decal } from './decals.ts';
import { OBJECTS } from './objects.ts';

/**
 * Every ground sprite the game ships. `npm run ground` bakes them into `public/ground`.
 *
 * Three kinds, layered in this order on the map:
 *
 *   textures  what each ground is made of, as ramp steps, several kinds per material
 *   masks     how each material spreads into its neighbour where two cells meet
 *   decals    what lies and grows on it, from a flower to an oak
 */
export { MASKS } from './masks.ts';
export { MATERIALS, RIDGES, TEXTURE, TEXTURES } from './textures.ts';
export type { GroundTexture, Material, Ridge } from './textures.ts';
export type { Decal } from './decals.ts';

export const DECALS: readonly Decal[] = [...MARKS, ...OBJECTS];
