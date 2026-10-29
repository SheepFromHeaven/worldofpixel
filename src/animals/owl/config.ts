import type { BirdConfig } from '../types.ts';
import { Trait } from '../../sim/birds/species.ts';

export const config: BirdConfig = {
  key: 'owl',
  name: 'tawny owl',
  length: 0.38,
  span: 0.95,
  adults: 2,
  common: 0.4,
  likes: [0.8, 0.3, 0, 0.05],
  nest: [1, 0, 0, 0],
  temperature: [-14, -4, 30, 38],
  traits: Trait.Hook,
  bulk: 0.3,
  tail: 0.3,
};
