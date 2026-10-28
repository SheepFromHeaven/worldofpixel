import { FIRE } from '../../pixel/palette.ts';
import { STANDING_TORCH } from '../../sim/sources/emitters.ts';

export const FLAME_RAMP = FIRE.slice(1).flatMap((colour) => [((colour >>> 24) & 0xff) / 255, ((colour >>> 16) & 0xff) / 255, ((colour >>> 8) & 0xff) / 255]);
export const FLAME_RAMP_STEPS = FLAME_RAMP.length / 3;
export const FLAME_FULL_STRENGTH = STANDING_TORCH.light?.strength ?? 1;
