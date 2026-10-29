import type { Config } from '../types.ts';
import { Form, Horn } from '../../sim/mammals/vocabulary.ts';

export const config: Config = {
  key: 'reddeer',
  name: 'red deer',
  form: Form.Quad,
  length: 2.1,
  height: 1.2,
  likes: [0.6, 0.5, 0, 0.2],
  temperature: [-30, -10, 28, 36],
  horn: Horn.Antler,
  hornSize: 1.2,
  bulk: 0.24,
  neck: 0.24,
  head: 0.24,
  tail: 0.06,
  ears: 0.1,
  legs: 1.3,
  rut: 0.55,
};
