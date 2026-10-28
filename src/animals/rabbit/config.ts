import type { Config } from '../types.ts';
import { Form, Trait } from '../../sim/mammals/vocabulary.ts';

export const config: Config = {
  key: 'rabbit',
  name: 'European rabbit',
  form: Form.Rodent,
  length: 0.4,
  height: 0.18,
  likes: [0.15, 0.8, 0, 0.1],
  soil: 0.5,
  temperature: [-12, 0, 32, 40],
  traits: Trait.Burrow | Trait.Ears | Trait.LongEars,
  bulk: 0.38,
  tail: 0.08,
  ears: 0.28,
  legs: 1.1,
  head: 0.22,
};
