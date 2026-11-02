import type { BirdTexture } from '../../../kit/types.ts';
import { Pattern } from '../../../../../modules/birds/api.ts';

export const texture: BirdTexture = {
  pattern: Pattern.Speckle,
  colour: [0.62, 0.46, 0.3],
  accent: [0.88, 0.82, 0.7],
  bill: [0.7, 0.62, 0.4],
  eye: [0.02, 0.02, 0.02],
  spots: 0.4,
};
