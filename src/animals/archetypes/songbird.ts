import type { AnimalModel, Tilt, Vec3 } from '../model.ts';
import type { AnimalBehaviour, BirdHabits, Pose, PoseContext } from '../types.ts';
import { extendModel } from './extend.ts';
import { hindLegPart, QUADRUPED } from './quadruped.ts';

export const SONGBIRD_STATES = ['perch', 'hop', 'fly', 'sing'] as const;

const FLY_PITCH = 0.25;

const SING_PITCH = 0.45;

const DROP = 0.06;

const low = (x: number, y: number, z: number): Vec3 => [x, y, z - DROP];

const SHOULDER: Vec3 = low(0.1, 0.1, 0.5);

const FLYING = ['fly'] as const;

const SINGING = ['sing'] as const;

const SPREAD: Tilt = { by: 1, max: -1.45, pivot: SHOULDER, axis: 'spread', on: FLYING };

const FLAP: Tilt = { by: 0, max: 0.85, pivot: SHOULDER, axis: 'roll', on: FLYING };

const LIFT: Tilt = { by: 1, max: 0.35, pivot: low(0.12, 0, 0.46), on: SINGING };

const LIFT_NECK: Tilt = { by: 1, max: 0.17, pivot: low(0.12, 0, 0.46), on: SINGING };

const GAPE: Tilt = { by: 0, max: -0.5, pivot: low(0.42, 0, 0.6), on: SINGING };

const PITCH: Tilt = { by: 2, max: 0.9, pivot: low(0, 0, 0.4) };

const HEAD: Vec3 = low(0.32, 0, 0.6);

export interface Songbird {
  body?: Vec3;
  head?: Vec3;
  bill?: { length: number; depth: number };
  tail?: { to: readonly [number, number]; radii: readonly [number, number] };
  wing?: number;
  leg?: number;
  mark?: AnimalModel['mark'];
  face?: boolean;
  belly?: boolean;
}

export const songbirdModel = ({
  body = [0.34, 0.17, 0.2],
  head = [0.13, 0.11, 0.12],
  bill = { length: 0.12, depth: 0.03 },
  tail = { to: [-0.56, 0.34], radii: [0.06, 0.045] },
  wing = -0.2,
  leg = 0.24,
  mark,
  face = true,
  belly = true,
}: Songbird = {}): AnimalModel =>
  extendModel(QUADRUPED, {
    head: HEAD,
    gait: { swing: 0.1, lift: 0.1, byLegs: false, bob: 0.06, stride: 2 },
    states: { run: null, hop: { swing: 0.14, lift: 0.12, bob: 0.07, stride: 2 }, fly: { swing: 0, lift: 0, bob: 0, stride: 1 } },
    lying: 0.1,
    eyes: low(0.4, 0.075, 0.63),
    headTilt: [LIFT, PITCH],
    ...(mark ? { mark: { at: low(...mark.at), radii: mark.radii } } : {}),
    parts: {
      foreLeg: null,
      hindLeg: hindLegPart([{ limb: [{ at: [0.02, 0.06, leg - DROP] }, { at: [0.04, 0.06, 0.01], swing: 1, lift: 1, grounded: true }], radii: [0.03, 0.02], floor: [0.8, 0.7] }], { phase: 0, stagger: 0, states: {} }),
    },
    add: [
      { kind: 'BODY', ...(mark ? { mark: true } : {}), tilt: PITCH, blend: true, shapes: [{ ellipsoid: low(0, 0, 0.38), radii: body }] },
      ...(belly ? [{ kind: 'HUMP' as const, tilt: PITCH, blend: true, shapes: [{ ellipsoid: low(0.06, 0, 0.28), radii: [body[0] * 0.8, body[1] * 0.85, body[2] * 0.55] as Vec3 }] }] : []),
      { kind: 'BODY', tilt: [LIFT_NECK, PITCH], blend: true, shapes: [{ limb: [low(0.1, 0, 0.46), low(0.3, 0, 0.58)], radii: [0.17, 0.12] }] },
      { kind: 'HEAD', depth: 'head', tilt: [LIFT, PITCH], shapes: [{ ellipsoid: HEAD, radii: head }] },
      ...(face ? [{ kind: 'FACE' as const, depth: 'head' as const, tilt: [LIFT, PITCH], shapes: [{ ellipsoid: low(0.38, 0, 0.58), radii: [0.09, 0.09, 0.09] as Vec3 }] }] : []),
      { kind: 'BILL', depth: 'head', tilt: [LIFT, PITCH], shapes: [{ limb: [low(0.42, 0, 0.61), low(0.42 + bill.length, 0, 0.6)], radii: [bill.depth, 0.01], floor: [0.5, 0.4] }] },
      { kind: 'BILL', depth: 'head', tilt: [GAPE, LIFT, PITCH], shapes: [{ limb: [low(0.42, 0, 0.59), low(0.42 + bill.length - 0.01, 0, 0.57)], radii: [bill.depth - 0.005, 0.01], floor: [0.5, 0.4] }] },
      { kind: 'TAIL', depth: 'self', tilt: PITCH, shapes: [{ limb: [low(-0.3, 0, 0.4), low(tail.to[0], 0, tail.to[1])], radii: tail.radii, floor: [0.7, 0.6] }] },
      {
        kind: 'WING',
        mirror: true,
        far: true,
        depth: 'self',
        tilt: [SPREAD, FLAP, PITCH],
        shapes: [{ limb: [[SHOULDER[0], 0.14, SHOULDER[2]], low(wing, 0.15, 0.43)], radii: [0.08, 0.03], floor: [0.9, 0.6] }],
      },
    ],
  });

const songbirdPose = ({ state, phase }: PoseContext): Pose => {
  if (state === 'fly') return [Math.sin(phase), 1, FLY_PITCH, 0];
  if (state === 'sing') return [0.5 + 0.5 * Math.sin(phase), 1, SING_PITCH, 0];
  if (state === 'hop') return [0, 0, 0.25, 0];
  return [0, 0, 0.4, 0];
};

export const songbirdBehaviour = (habits: BirdHabits): AnimalBehaviour<BirdHabits> => ({
  habits,
  states: SONGBIRD_STATES,
  hooks: { pose: songbirdPose },
});
