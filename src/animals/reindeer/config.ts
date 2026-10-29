import type { Config } from '../types.ts';
import { Form, Horn } from '../../sim/mammals/vocabulary.ts';

export const config: Config = {
  key: 'reindeer',
  name: 'reindeer',
  form: Form.Quad,
  length: 1.9,
  height: 1.1,
  likes: [0.1, 0.8, 0, 0.1],
  temperature: [-55, -34, 14, 24],
  horn: Horn.Antler,
  hornSize: 1.5,
  hornBoth: true,
  bulk: 0.26,
  neck: 0.2,
  head: 0.24,
  tail: 0.06,
  ears: 0.08,
  legs: 1.1,
  rut: 0.55,
};
