import type { Config } from '../types.ts';
import { Form, Trait } from '../../sim/mammals/vocabulary.ts';

export const config: Config = {
  key: 'brownbear',
  name: 'brown bear',
  form: Form.Quad,
  length: 1.9,
  height: 1.1,
  likes: [0.5, 0.4, 0, 0.6],
  temperature: [-40, -18, 28, 36],
  season: [0.1, 0.22, 0.72, 0.84],
  traits: Trait.Hump,
  bulk: 0.42,
  neck: 0.12,
  head: 0.2,
  tail: 0.04,
  ears: 0.05,
  legs: 0.7,
};
