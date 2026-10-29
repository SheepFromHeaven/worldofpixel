import type { Config } from '../types.ts';
import { Form, Horn } from '../../sim/mammals/vocabulary.ts';

export const config: Config = {
  key: 'roedeer',
  name: 'roe deer',
  form: Form.Quad,
  length: 1.2,
  height: 0.7,
  likes: [0.6, 0.4, 0, 0.2],
  temperature: [-25, -8, 28, 36],
  horn: Horn.Antler,
  hornSize: 0.5,
  bulk: 0.22,
  neck: 0.22,
  head: 0.22,
  tail: 0.04,
  ears: 0.1,
  legs: 1.2,
  rut: 0.4,
};
