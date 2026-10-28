import type { Grown } from './types.ts';

export function fitted(grown: Grown, radius: number, stretch: number): Grown {
  let reach = 1e-6;
  for (const tuft of grown.tufts) reach = Math.max(reach, Math.hypot(tuft.at[0], tuft.at[1]) + tuft.across);
  for (const limb of grown.limbs) reach = Math.max(reach, Math.hypot(limb.to[0], limb.to[1]));
  const side = radius / reach;
  const rise = side * stretch;
  return {
    ...grown,
    limbs: grown.limbs.map((limb) => ({
      from: [limb.from[0] * side, limb.from[1] * side, limb.from[2] * rise],
      to: [limb.to[0] * side, limb.to[1] * side, limb.to[2] * rise],
      fromRadius: limb.fromRadius * side,
      toRadius: limb.toRadius * side,
    })),
    tufts: grown.tufts.map((tuft) => ({ ...tuft, at: [tuft.at[0] * side, tuft.at[1] * side, tuft.at[2] * rise], across: tuft.across * side, up: tuft.up * rise })),
  };
}
