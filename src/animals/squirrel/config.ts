import type { Config } from '../types.ts';
import { Form, Trait } from '../../sim/mammals/vocabulary.ts';

export const config: Config = {
  key: 'squirrel',
  name: 'red squirrel',
  form: Form.Rodent,
  length: 0.22,
  height: 0.09,
  likes: [1, 0, 0, 0.05],
  temperature: [-20, -6, 26, 34],
  traits: Trait.Climb | Trait.Bushy | Trait.Ears,
  bulk: 0.32,
  tail: 1,
  ears: 0.14,
  legs: 1,
  head: 0.2,
};
