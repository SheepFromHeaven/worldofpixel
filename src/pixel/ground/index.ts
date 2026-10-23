import type { Decal } from './decals.ts';
import { MARKS } from './decals.ts';
import { OBJECTS } from './objects.ts';

export type { Decal } from './decals.ts';
export { MASKS } from './masks.ts';
export { MATERIALS,RIDGES,TEXTURE,TEXTURES } from './textures.ts';
export type { GroundTexture,Material,Ridge } from './textures.ts';

export const DECALS: readonly Decal[] = [...MARKS, ...OBJECTS];
export type { LitProp } from './objects.ts';
export { LIT_PROPS } from './plants.ts';
