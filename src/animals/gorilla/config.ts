import type { Config } from '../types.ts';
import { Form } from '../../sim/mammals/vocabulary.ts';

export const config: Config = {
  key: 'gorilla',
  name: 'western gorilla',
  form: Form.Primate,
  length: 1.3,
  height: 0.9,
  likes: [0.8, 0.2, 0, 0.1],
  temperature: [8, 15, 30, 36],
  bulk: 0.46,
  tail: 0,
  head: 0.22,
  ears: 0.06,
  legs: 0.9,
};
