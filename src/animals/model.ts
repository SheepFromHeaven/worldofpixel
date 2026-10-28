export type Vec3 = readonly [number, number, number];

export type PartKind = 'BODY' | 'HEAD' | 'FACE' | 'TAIL' | 'EAR' | 'LEG' | 'HUMP';

export interface Point {
  at: Vec3;
  swing?: number;
  lift?: number;
  grounded?: boolean;
  flex?: { by: 0 | 1 | 2 | 3; x?: number; z?: number };
}

export type At = Vec3 | Point;

export interface Reach {
  dir: Vec3;
  param: 'tail' | 'ears';
  k: number;
  sway?: Vec3;
}

export interface Ellipsoid {
  ellipsoid: At;
  radii: Vec3;
}

export interface Limb {
  limb: readonly [At, At | Reach];
  radii: readonly [number, number];
  floor?: readonly [number, number];
  radiiBy?: 'reach';
}

export type Shape = Ellipsoid | Limb;

export interface Part {
  name?: string;
  kind: PartKind;
  shapes: Shape[];
  mirror?: boolean;
  phase?: number;
  standing?: boolean;
  depth?: 'body' | 'head' | 'self';
  bias?: number;
  far?: boolean;
  inked?: boolean;
  mark?: boolean;
  stagger?: number;
  states?: Record<string, { phase?: number; stagger?: number }>;
}

export interface Gait {
  swing: number;
  lift: number;
  byLegs: boolean;
  bob: number;
  roll?: number;
  stride?: number;
  bobShape?: number;
  bobPhase?: number;
}

export type GaitStates = Record<string, Partial<Gait>>;

export interface Mark {
  at: Vec3;
  radii: Vec3;
}

export interface AnimalModel {
  head: Vec3;
  gait: Gait;
  states?: GaitStates;
  lying: number;
  sink?: number;
  slide?: number;
  mark?: Mark;
  eyes?: Vec3;
  nose?: Vec3;
  parts: Part[];
}

export const isPoint = (at: At): at is Point => !Array.isArray(at);

export const isReach = (end: At | Reach): end is Reach => !Array.isArray(end) && 'dir' in end;
