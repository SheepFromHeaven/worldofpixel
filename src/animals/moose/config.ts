import type { Config } from '../types.ts';
import { Form, Horn } from '../../sim/mammals/vocabulary.ts';
import { Realm } from '../../sim/reptiles/species.ts';

export const config: Config = {
  key: 'moose',
  name: 'moose',
  form: Form.Quad,
  realm: Realm.Land | Realm.Fresh,
  length: 2.8,
  height: 1.9,
  likes: [0.6, 0.3, 0, 0.8],
  wet: [0, 0.4, 0, 0.4],
  temperature: [-45, -22, 20, 30],
  horn: Horn.Palm,
  hornSize: 1.6,
  bulk: 0.26,
  neck: 0.18,
  head: 0.34,
  tail: 0.04,
  ears: 0.1,
  legs: 1.5,
  rut: 0.55,
  dive: 12,
};
