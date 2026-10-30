import { building, emits, footprint, placedBy } from '../definition.ts';

export const TORCH = building('torch', 'Torch', 'torch.post',
  emits({
    look: 'post',
    heat: { reach: 3.5, output: 0.4 },
    light: { reach: 4.5, strength: 1.1, colour: [1, 0.62, 0.3], flicker: 1, windShare: 1, flame: 'torch', lift: 0.95 },
  }),
  footprint({ clears: false, trodden: false }),
  placedBy('plantTorch'),
);
