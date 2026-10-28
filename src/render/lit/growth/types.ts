import type { Vec3 } from './vec.ts';

export interface Limb {
  from: Vec3;
  to: Vec3;
  fromRadius: number;
  toRadius: number;
}

export interface Tuft {
  at: Vec3;
  across: number;
  up: number;
  tone: number;
  open: number;
}

export interface Grown {
  limbs: Limb[];
  tufts: Tuft[];
  ragged: number;
  holes: number;
  clump: number;
  envelope: number;
  bark: number;
}

export interface Growth {
  radius: number;
  age: number;
  seed: number;
}

export type Grower = (growth: Growth) => Grown;
