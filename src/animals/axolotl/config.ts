import type { Config } from '../types.ts';
import { Form } from '../../sim/mammals/vocabulary.ts';

export const config: Config = {
  key: 'axolotl',
  name: 'axolotl',
  form: Form.Quad,
  length: 0.2,
  height: 0.04,
  likes: [1, 0, 0, 0],
  temperature: [4, 12, 20, 26],
  bulk: 0.3,
  head: 0.35,
  legs: 0.7,
  tail: 1,
  ears: 0.9,
};
