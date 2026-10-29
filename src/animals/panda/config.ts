import type { Config } from '../types.ts';
import { Form } from '../../sim/mammals/vocabulary.ts';

export const config: Config = {
  key: 'panda',
  name: 'giant panda',
  form: Form.Quad,
  length: 1.5,
  height: 0.8,
  likes: [0.7, 0.2, 0, 0.3],
  rough: 0.5,
  temperature: [-10, 2, 22, 30],
  bulk: 0.46,
  neck: 0.08,
  head: 0.22,
  tail: 0.04,
  ears: 0.06,
  legs: 0.7,
};
