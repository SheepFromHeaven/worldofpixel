import type { BirdConfig } from '../types.ts';

export const config: BirdConfig = {
  key: 'sparrow',
  name: 'house sparrow',
  length: 0.15,
  span: 0.22,
  adults: 4,
  common: 0.9,
  likes: [0.3, 0.5, 0, 0.1],
  nest: [0.6, 0.2, 0, 0.2],
  bias: 0.1,
  temperature: [-8, 2, 32, 40],
  bulk: 0.26,
};
