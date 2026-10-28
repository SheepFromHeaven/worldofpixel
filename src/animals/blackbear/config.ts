import type { Config } from '../types.ts';
import { Form, Trait } from '../../sim/mammals/vocabulary.ts';

export const config: Config = {
  key: 'blackbear',
  name: 'American black bear',
  form: Form.Quad,
  length: 1.5,
  height: 0.9,
  likes: [0.8, 0.2, 0, 0.4],
  temperature: [-30, -10, 32, 40],
  season: [0.1, 0.22, 0.72, 0.84],
  traits: Trait.Climb,
  bulk: 0.38,
  neck: 0.12,
  head: 0.2,
  tail: 0.04,
  ears: 0.06,
  legs: 0.7,
};
