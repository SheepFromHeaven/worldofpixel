import type { AnimalModel, Part, Shape, Vec3 } from '../model.ts';
import { extendModel } from './extend.ts';
import { flexFront, flexHead, flexRear, foreLegPart, hindLegPart, QUADRUPED } from './quadruped.ts';

const KNEE_SWING = 0.4;

export interface DeerSpec {
  rise?: number;
  head?: Vec3;
  headScale?: number;
  muzzle?: Vec3;
  neck?: readonly [number, number];
  neckMass?: number;
  bodyDepth?: number;
  ears?: { dir: Vec3; k: number };
  tail?: { at: Vec3; dir: Vec3; k: number; radii: readonly [number, number] };
  antlers: Part;
  extra?: readonly Part[];
}

export const tine = (from: Vec3, to: Vec3, radii: readonly [number, number] = [0.014, 0.008]): Shape => ({ limb: [flexHead(from), flexHead(to)], radii, floor: [1, 0.7] });

export const antlerPart = (anchor: Vec3, full: number, shapes: Shape[], far = true, behind = false): Part => ({
  kind: 'HORN',
  when: 'grown',
  grows: { anchor, full },
  mirror: true,
  far,
  behind,
  depth: 'self',
  shapes,
});

const lift = (at: Vec3, rise: number): Vec3 => [at[0], at[1], at[2] + rise];

export const deerModel = ({
  rise = 0,
  head = [0.5, 0, 0.8],
  headScale = 1,
  muzzle = [0.135, 0, -0.08],
  neck = [0.1, 0.062],
  neckMass = 1,
  bodyDepth = 0.175,
  ears = { dir: [-0.15, 0.85, 0.5], k: 1.1 },
  tail = { at: [-0.43, 0, 0.58], dir: [-0.6, 0, -0.55], k: 1.3, radii: [0.055, 0.035] },
  antlers,
  extra = [],
}: DeerSpec): AnimalModel => {
  const knee = 0.25 + rise * 0.5;
  const hock = 0.28 + rise * 0.5;
  const foreThigh: Part = foreLegPart(
    [{ limb: [flexFront(lift([0.2, 0.1, 0.52], rise)), { at: [0.22, 0.1, knee], swing: KNEE_SWING, flex: { by: 0, z: -0.02 } }], radii: [0.105, 0.05] }],
    { name: 'foreThigh', far: false, standing: false, depth: 'self', blend: true },
  );
  const foreLeg: Part = foreLegPart([{ limb: [{ at: [0.22, 0.1, knee], swing: KNEE_SWING }, { at: [0.2, 0.1, 0.04], swing: 1, lift: 1, grounded: true }], radii: [0.05, 0.034], floor: [1.6, 1.2] }], { blend: true });
  const hindThigh: Part = hindLegPart(
    [{ limb: [flexRear(lift([-0.22, 0.1, 0.55], rise)), { at: [-0.3, 0.1, hock], swing: KNEE_SWING, lift: 0.5, grounded: true, flex: { by: 0, z: 0.02 } }], radii: [0.125, 0.055] }],
    { name: 'hindThigh', far: false, standing: false, depth: 'self', blend: true },
  );
  const hindLeg: Part = hindLegPart([{ limb: [{ at: [-0.3, 0.1, hock], swing: KNEE_SWING, lift: 0.5, grounded: true }, { at: [-0.23, 0.1, 0.04], swing: 1, lift: 1, grounded: true }], radii: [0.055, 0.034], floor: [1.6, 1.2] }], { blend: true });
  const at = lift(head, rise);
  const neckRoot = lift([0.24, 0, 0.6], rise);
  const mass: Part[] =
    neckMass > 0
      ? [
          {
            kind: 'BODY',
            when: 'grown',
            grows: { anchor: neckRoot, full: 1.2 },
            blend: true,
            shapes: [
              { ellipsoid: flexFront(lift([0.3, 0, 0.63], rise)), radii: [0.15 * neckMass, 0.12 * neckMass, 0.14 * neckMass] },
              { limb: [flexFront(lift([0.3, 0, 0.64], rise)), flexHead(lift([0.44, 0, 0.76], rise))], radii: [0.125 * neckMass, 0.082 * neckMass] },
            ],
          },
        ]
      : [];
  const body: Part = {
    kind: 'BODY',
    blend: true,
    shapes: [
      { ellipsoid: lift([-0.2, 0, 0.53], rise), radii: [0.25, 0.145, bodyDepth] },
      { ellipsoid: flexRear(lift([-0.02, 0, 0.5], rise), 0.5), radii: [0.28, 0.14, bodyDepth - 0.005] },
      { ellipsoid: flexFront(lift([0.15, 0, 0.52], rise)), radii: [0.22, 0.14, bodyDepth] },
      { limb: [flexFront(neckRoot), flexHead(lift([head[0] - 0.07, 0, head[2] - 0.03], rise))], radii: neck },
    ],
  };
  const skull: Part = {
    kind: 'HEAD',
    depth: 'head',
    inked: true,
    shapes: [
      { ellipsoid: flexHead(at), radii: [0.09 * headScale, 0.062 * headScale, 0.07 * headScale] },
      { limb: [flexHead([at[0] + 0.02, 0, at[2] - 0.01]), flexHead([at[0] + muzzle[0], 0, at[2] + muzzle[2]])], radii: [0.055 * headScale, 0.032 * headScale], floor: [1, 0.8] },
    ],
  };
  return extendModel(QUADRUPED, {
    head: at,
    gait: { swing: 0.12, lift: 0.07, bob: 0.025, roll: 0.01 },
    states: { run: { swing: 0.28, lift: 0.17, bob: 0.06, roll: 0.012 } },
    lying: 0.3,
    eyes: [at[0] + 0.03, 0.05, at[2] + 0.02],
    eyeFlex: { by: 1, z: 0.07 },
    nose: [at[0] + muzzle[0] + 0.01, 0, at[2] + muzzle[2]],
    parts: { foreLeg, hindLeg },
    add: [
      foreThigh,
      hindThigh,
      body,
      skull,
      { kind: 'TAIL', depth: 'self', shapes: [{ limb: [lift(tail.at, rise), { dir: tail.dir, param: 'tail', k: tail.k, sway: [0, 1, 0.2] }], radii: tail.radii, floor: [1.2, 1] }] },
      { kind: 'EAR', mirror: true, far: true, depth: 'self', shapes: [{ limb: [flexHead([at[0] - 0.04, 0.045, at[2] + 0.06]), { dir: ears.dir, param: 'ears', k: ears.k }], radii: [0.4, 0.25], floor: [1, 0.75], radiiBy: 'reach' }] },
      ...mass,
      ...extra,
      antlers,
    ],
  });
};
