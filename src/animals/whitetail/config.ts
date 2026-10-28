import type { Config } from '../types.ts';
import { Form, Horn } from '../../sim/mammals/vocabulary.ts';

export const config: Config = {
  key: 'whitetail',
  name: 'white-tailed deer',
  form: Form.Quad,
  length: 1.6,
  height: 1,
  likes: [0.6, 0.4, 0, 0.2],
  temperature: [-30, -10, 32, 40],
  horn: Horn.Antler,
  hornSize: 1,
  bulk: 0.22,
  neck: 0.22,
  head: 0.22,
  tail: 0.12,
  ears: 0.1,
  legs: 1.2,
  rut: 0.6,
};
