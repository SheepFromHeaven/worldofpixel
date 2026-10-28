import type { Config } from '../types.ts';
import { Form, Horn } from '../../sim/mammals/vocabulary.ts';

export const config: Config = {
  key: 'fallowdeer',
  name: 'fallow deer',
  form: Form.Quad,
  length: 1.5,
  height: 0.9,
  likes: [0.5, 0.6, 0, 0.1],
  temperature: [-18, -4, 30, 38],
  horn: Horn.Palm,
  hornSize: 0.9,
  bulk: 0.24,
  neck: 0.22,
  head: 0.22,
  tail: 0.1,
  ears: 0.1,
  legs: 1.2,
  rut: 0.58,
};
