import { fitted } from './fit.ts';
import { between, seeded } from './random.ts';
import type { Grower, Limb, Tuft } from './types.ts';
import type { Vec3 } from './vec.ts';
import { add, scaled, tilted, UP, unit } from './vec.ts';

export interface BroadleafParams {
  reach: number;
  stretch: number;
  trunkHeight: number;
  trunkRadius: number;
  trunkLean: number;
  trunkWander: number;
  trunkTaper: readonly [number, number, number];
  primaries: number;
  primaryLength: number;
  primaryWidth: number;
  primarySpread: readonly [number, number];
  steps: number;
  wander: number;
  upward: number;
  sag: number;
  sideAngle: readonly [number, number];
  forkAngle: readonly [number, number];
  childLength: readonly [number, number];
  childWidth: number;
  taper: number;
  tuft: number;
  tuftFlat: number;
  hang: number;
  cluster: number;
  clusterSpread: number;
  skipped: number;
  topTuft: number;
  ragged: number;
  holes: number;
  clump: number;
  envelope: number;
  bark: number;
  leafless: boolean;
  buttress: number;
  buttressHeight: number;
  buttressReach: number;
  depthByAge: readonly { below: number; depth: number }[];
}

export const BROADLEAF_DEFAULTS: BroadleafParams = {
  reach: 0.98,
  stretch: 1.05,
  trunkHeight: 0.8,
  trunkRadius: 0.13,
  trunkLean: 0.06,
  trunkWander: 0.12,
  trunkTaper: [0.93, 0.93, 0.8],
  primaries: 5,
  primaryLength: 0.8,
  primaryWidth: 0.7,
  primarySpread: [0.65, 1.1],
  steps: 4,
  wander: 0.42,
  upward: 0.2,
  sag: 0.06,
  sideAngle: [0.75, 1.25],
  forkAngle: [0.4, 0.85],
  childLength: [0.62, 0.76],
  childWidth: 0.72,
  taper: 0.38,
  tuft: 0.11,
  tuftFlat: 0.7,
  hang: 0,
  cluster: 8,
  clusterSpread: 0.13,
  skipped: 0.05,
  topTuft: 1.3,
  ragged: 0.3,
  holes: 0.07,
  clump: 0.55,
  envelope: 0.65,
  bark: 0,
  leafless: false,
  buttress: 0,
  buttressHeight: 0.35,
  buttressReach: 0.25,
  depthByAge: [
    { below: 0.3, depth: 1 },
    { below: 0.8, depth: 2 },
    { below: Infinity, depth: 3 },
  ],
};

export const broadleaf = (overrides: Partial<BroadleafParams>): BroadleafParams => ({ ...BROADLEAF_DEFAULTS, ...overrides });

export const makeBroadleaf = (params: BroadleafParams): Grower => ({ radius, age, seed }) => {
  const random = seeded(seed);
  const rootRandom = seeded(seed ^ 0x5bd1e995);
  const limbs: Limb[] = [];
  const tufts: Tuft[] = [];
  const unitLength = radius;
  const deepest = params.depthByAge.find((rule) => age < rule.below)!.depth;
  const trunkRadius = Math.max(1.6, unitLength * params.trunkRadius);

  const tuftAt = (at: Vec3, size: number, generation: number): void => {
    if (params.leafless || random() < params.skipped) return;
    const spread = unitLength * params.clusterSpread * size;
    for (let one = 0; one < params.cluster; one += 1) {
      const across = Math.max(1.5, unitLength * params.tuft * size * between(random, 0.7, 1.3));
      const offset: Vec3 = [(random() - 0.5) * 2 * spread, (random() - 0.5) * 2 * spread, (random() - 0.35) * 2 * spread * params.tuftFlat - params.hang * spread];
      tufts.push({ at: add(at, offset), across, up: across * params.tuftFlat, tone: Math.min(1, 0.25 + 0.5 * random() + 0.12 * generation), open: 0 });
    }
  };

  const grow = (from: Vec3, heading: Vec3, length: number, width: number, generation: number): void => {
    let at = from;
    let direction = heading;
    let thickness = width;
    const stride = length / params.steps;
    for (let step = 0; step < params.steps; step += 1) {
      const bend = tilted(direction, params.wander * random(), random() * Math.PI * 2);
      direction = unit(add(bend, scaled(UP, params.upward - params.sag * generation)));
      const to = add(at, scaled(direction, stride));
      const next = thickness * (1 - params.taper / params.steps);
      limbs.push({ from: at, to, fromRadius: thickness, toRadius: next });
      thickness = next;
      at = to;
      if (step === 1 && generation < deepest) {
        const side = tilted(direction, between(random, params.sideAngle[0], params.sideAngle[1]), random() * Math.PI * 2);
        grow(at, side, length * between(random, params.childLength[0], params.childLength[1]), thickness * params.childWidth, generation + 1);
      }
      if (generation === deepest && step >= 1) tuftAt(at, step === params.steps - 1 ? 1 : 0.6, generation);
    }
    if (generation >= deepest) return;
    const turn = random() * Math.PI * 2;
    for (let fork = 0; fork < 2; fork += 1) {
      const branch = tilted(direction, between(random, params.forkAngle[0], params.forkAngle[1]), turn + fork * Math.PI + (random() - 0.5) * 0.6);
      grow(at, branch, length * between(random, params.childLength[0], params.childLength[1]), thickness * params.childWidth, generation + 1);
    }
  };

  let top: Vec3 = [0, 0, 0];
  const trunkHeight = unitLength * params.trunkHeight * (0.9 + 0.2 * random());
  const lean = tilted(UP, params.trunkLean * random(), random() * Math.PI * 2);
  let thickness = trunkRadius;
  for (let step = 0; step < 3; step += 1) {
    const to = add(top, scaled(unit(add(lean, scaled(tilted(UP, params.trunkWander * random(), random() * Math.PI * 2), 0.5))), trunkHeight / 3));
    const next = thickness * params.trunkTaper[step]!;
    limbs.push({ from: top, to, fromRadius: thickness, toRadius: next });
    thickness = next;
    top = to;
  }

  for (let root = 0; root < params.buttress; root += 1) {
    const azimuth = (root / params.buttress) * Math.PI * 2 + (rootRandom() - 0.5) * 0.5;
    const out: Vec3 = [Math.cos(azimuth) * unitLength * params.buttressReach, Math.sin(azimuth) * unitLength * params.buttressReach, 0];
    const high: Vec3 = [Math.cos(azimuth) * trunkRadius * 0.6, Math.sin(azimuth) * trunkRadius * 0.6, trunkHeight * params.buttressHeight];
    limbs.push({ from: high, to: out, fromRadius: trunkRadius * 0.55, toRadius: Math.max(0.6, trunkRadius * 0.2) });
  }

  const turn = random() * Math.PI * 2;
  for (let primary = 0; primary < params.primaries; primary += 1) {
    const azimuth = turn + (primary / params.primaries) * Math.PI * 2 + (random() - 0.5) * 0.7;
    const heading = tilted(UP, between(random, params.primarySpread[0], params.primarySpread[1]), azimuth);
    grow(top, heading, unitLength * params.primaryLength * between(random, 0.85, 1.15), thickness * params.primaryWidth, 0);
  }
  if (params.topTuft > 0) tuftAt([top[0], top[1], top[2] + unitLength * 0.12], params.topTuft, 0);

  for (const tuft of tufts) tuft.open = Math.min(1, Math.hypot(tuft.at[0], tuft.at[1]) / (unitLength * 0.9) + 0.15);
  return fitted({ limbs, tufts, ragged: params.ragged, holes: params.holes, clump: params.clump, envelope: params.envelope, bark: params.bark }, radius * params.reach, params.stretch);
};
