import { station, emits, ground, placedBy } from '../../../../../content/stations/definition.ts';

export const TORCH = station('torch', 'Torch', 'torch.post',
  emits({
    look: 'post',
    heat: { reach: 3.5, output: 0.4 },
    light: { reach: 4.5, strength: 1.1, colour: [1, 0.62, 0.3], flicker: 1, windShare: 1, flame: 'torch', lift: 0.95 },
  }),
  ground({ clears: false, trodden: false }),
  placedBy('plantTorch'),
);

export const order = 6;

export default TORCH;
