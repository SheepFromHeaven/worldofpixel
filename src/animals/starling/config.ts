import type { BirdConfig } from '../types.ts';
import { Trait } from '../../sim/birds/species.ts';

export const config: BirdConfig = {
  key: 'starling',
  name: 'starling',
  length: 0.21,
  span: 0.38,
  adults: 4,
  common: 0.8,
  likes: [0.3, 0.6, 0.1, 0.1],
  nest: [0.8, 0.2, 0, 0],
  traits: Trait.Flock,
  temperature: [-10, 0, 30, 38],
  bulk: 0.24,
};
