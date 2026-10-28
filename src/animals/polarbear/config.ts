import type { Config } from '../types.ts';
import { Form } from '../../sim/mammals/vocabulary.ts';
import { Realm } from '../../sim/reptiles/species.ts';

export const config: Config = {
  key: 'polarbear',
  name: 'polar bear',
  form: Form.Quad,
  realm: Realm.Land | Realm.Sea,
  length: 2.2,
  height: 1.3,
  likes: [0, 0.4, 0, 0.8],
  wet: [0, 0.3, 0, 0.8],
  temperature: [-60, -40, 6, 16],
  bulk: 0.36,
  neck: 0.18,
  head: 0.18,
  tail: 0.04,
  ears: 0.04,
  legs: 0.7,
  dive: 30,
};
