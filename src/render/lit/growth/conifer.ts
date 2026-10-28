import { fitted } from './fit.ts';
import { between, seeded } from './random.ts';
import type { Grower, Limb, Tuft } from './types.ts';
import type { Vec3 } from './vec.ts';
import { add, distance, scaled, tilted, UP, unit } from './vec.ts';

export interface ConiferParams {
  reach: number;
  stretch: number;
  height: number;
  trunkRadius: number;
  trunkTop: number;
  clear: number;
  whorlsBase: number;
  whorlsPerAge: number;
  branchesPerWhorl: readonly [number, number];
  branchLength: number;
  shortest: number;
  taper: number;
  droopLow: number;
  liftHigh: number;
  branchSteps: number;
  tipLift: number;
  wander: number;
  twigsPerBranch: number;
  twigAngle: readonly [number, number];
  twigLength: number;
  twigDroop: number;
  needleSpacing: number;
  needleFrom: number;
  needle: number;
  needleFlat: number;
  needleHang: number;
  crownTuft: number;
  ragged: number;
  holes: number;
}

export const makeConifer = (params: ConiferParams): Grower => ({ radius, age, seed }) => {
  const random = seeded(seed);
  const limbs: Limb[] = [];
  const tufts: Tuft[] = [];
  const height = radius * params.height;
  const trunkRadius = Math.max(1.3, radius * params.trunkRadius);
  const whorls = Math.round(params.whorlsBase + params.whorlsPerAge * Math.min(1, age));
  const bottom = height * params.clear;
  const top = height * 0.93;

  const needles = (from: Vec3, to: Vec3, reachOut: number, tone: number): void => {
    const span = distance(from, to);
    const count = Math.max(1, Math.floor((span * (1 - params.needleFrom)) / params.needleSpacing));
    for (let at = 0; at <= count; at += 1) {
      const along = params.needleFrom + (1 - params.needleFrom) * (count === 0 ? 1 : at / count);
      const across = Math.max(2, radius * params.needle * between(random, 0.8, 1.25));
      const base = add(from, scaled([to[0] - from[0], to[1] - from[1], to[2] - from[2]], along));
      tufts.push({
        at: [base[0], base[1], base[2] - across * params.needleHang],
        across,
        up: across * params.needleFlat,
        tone: Math.min(1, Math.max(0, tone + (random() - 0.5) * 0.4)),
        open: Math.min(1, (Math.hypot(base[0], base[1]) + 1) / Math.max(reachOut, 1)),
      });
    }
  };

  const branch = (from: Vec3, heading: Vec3, length: number, width: number, tone: number, twigs: boolean): void => {
    const stride = length / params.branchSteps;
    let at = from;
    let direction = heading;
    let thickness = width;
    for (let step = 0; step < params.branchSteps; step += 1) {
      direction = unit(add(tilted(direction, params.wander * random(), random() * Math.PI * 2), scaled(UP, params.tipLift)));
      const to = add(at, scaled(direction, stride));
      const next = thickness * 0.6;
      limbs.push({ from: at, to, fromRadius: Math.max(0.5, thickness), toRadius: Math.max(0.4, next) });
      needles(at, to, Math.hypot(from[0], from[1]) + length, tone);
      if (twigs && step >= 1) {
        for (let twig = 0; twig < params.twigsPerBranch; twig += 1) {
          const side = twig % 2 === 0 ? 1 : -1;
          const turned = tilted(direction, between(random, params.twigAngle[0]!, params.twigAngle[1]!), (side > 0 ? 0 : Math.PI) + (random() - 0.5) * 0.5);
          const lowered = unit(add(turned, scaled(UP, params.twigDroop)));
          branch(to, lowered, length * params.twigLength * between(random, 0.8, 1.1), Math.max(0.5, next * 0.6), tone, false);
        }
      }
      thickness = next;
      at = to;
    }
  };

  let at: Vec3 = [0, 0, 0];
  const stride = height / 6;
  const lean = tilted(UP, 0.05 * random(), random() * Math.PI * 2);
  const verticals: Vec3[] = [at];
  for (let step = 0; step < 6; step += 1) {
    const direction = unit(add(lean, scaled(tilted(UP, 0.07 * random(), random() * Math.PI * 2), 0.6)));
    const to = add(at, scaled(direction, stride));
    const from = trunkRadius * (1 - (1 - params.trunkTop) * (step / 6));
    const next = trunkRadius * (1 - (1 - params.trunkTop) * ((step + 1) / 6));
    limbs.push({ from: at, to, fromRadius: from, toRadius: next });
    at = to;
    verticals.push(at);
  }
  const trunkAt = (z: number): Vec3 => {
    const level = Math.min(6 - 1e-6, Math.max(0, z / stride));
    const index = Math.floor(level);
    const a = verticals[index]!;
    const b = verticals[index + 1]!;
    const t = level - index;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };

  const golden = random() * Math.PI * 2;
  for (let whorl = 0; whorl < whorls; whorl += 1) {
    const t = whorls === 1 ? 0 : whorl / (whorls - 1);
    const z = bottom + (top - bottom) * t;
    const reach = Math.max(radius * params.shortest, radius * params.branchLength * Math.pow(1 - t, params.taper));
    const count = Math.round(between(random, params.branchesPerWhorl[0]!, params.branchesPerWhorl[1]! + 0.99));
    const pitch = params.droopLow + (params.liftHigh - params.droopLow) * t;
    const radiusHere = Math.max(0.6, trunkRadius * (1 - (1 - params.trunkTop) * (z / height)) * 0.42);
    for (let one = 0; one < count; one += 1) {
      const azimuth = golden + whorl * 2.4 + (one / count) * Math.PI * 2 + (random() - 0.5) * 0.5;
      const heading: Vec3 = [Math.cos(pitch) * Math.cos(azimuth), Math.cos(pitch) * Math.sin(azimuth), Math.sin(pitch)];
      branch(trunkAt(z), heading, reach * between(random, 0.82, 1.12), radiusHere, 0.2 + 0.6 * t, true);
    }
  }
  for (let one = 0; one < 4; one += 1) {
    const across = Math.max(1.4, radius * params.crownTuft * (1.1 - one * 0.15));
    const base = trunkAt(top + (height - top) * (one / 3));
    tufts.push({ at: [base[0], base[1], base[2]], across, up: across * 1.3, tone: 0.9, open: 1 });
  }
  return fitted({ limbs, tufts, ragged: params.ragged, holes: params.holes, clump: 0, envelope: 0, bark: 0 }, radius * params.reach, params.stretch);
};
