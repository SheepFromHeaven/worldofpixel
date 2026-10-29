import type { BirdTexture } from '../types.ts';
import { Pattern } from '../../sim/birds/species.ts';

export const texture: BirdTexture = {
  pattern: Pattern.Speckle,
  colour: [0.14, 0.14, 0.2],
  accent: [0.72, 0.72, 0.5],
  spots: 0.5,
};
