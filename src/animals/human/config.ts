import type { Config } from '../types.ts';
import { Form } from '../../sim/mammals/vocabulary.ts';

export const config: Config = {
  key: 'human',
  name: 'human',
  form: Form.Primate,
  length: 1.7,
  height: 1.7,
  likes: [0.5, 0.3, 0.1, 0.2],
  temperature: [-10, 10, 30, 42],
  bulk: 0.3,
  head: 0.12,
  legs: 1,
  tail: 0,
  ears: 0,
};
