import type { Config } from '../types.ts';
import { Form, Trait } from '../../sim/mammals/vocabulary.ts';

export const config: Config = {
  key: 'aardvark',
  name: 'aardvark',
  form: Form.Quad,
  length: 1.1,
  height: 0.6,
  likes: [0.25, 0.7, 0, 0.1],
  soil: 0.5,
  temperature: [10, 18, 36, 42],
  traits: Trait.Tube | Trait.Ears | Trait.LongEars | Trait.Burrow,
  bulk: 0.34,
  neck: 0.03,
  tail: 0.4,
  ears: 0.2,
  head: 0.4,
};
