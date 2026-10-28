import { fitted } from './fit.ts';
import { between, seeded } from './random.ts';
import type { Grower, Limb, Tuft } from './types.ts';
import type { Vec3 } from './vec.ts';
import { add, scaled, tilted, UP, unit } from './vec.ts';

export const PALM = {
  reach: 0.98,
  stretch: 1,
  height: 2.3,
  trunkRadius: 0.05,
  trunkBase: 1.35,
  trunkBend: 0.1,
  trunkSteps: 6,
  frondsBase: 11,
  frondsPerAge: 4,
  frondLength: 1.05,
  frondSteps: 6,
  frondRise: 1.25,
  frondDroop: 0.2,
  frondWidth: 0.012,
  leaflet: 0.06,
  leafletFlat: 0.45,
  leafletSpacing: 0.9,
  leafletFrom: 0.1,
  ragged: 0.25,
  holes: 0,
  envelope: 0.2,
};

export const growPalm: Grower = ({ radius, age, seed }) => {
  const random = seeded(seed);
  const limbs: Limb[] = [];
  const tufts: Tuft[] = [];
  const height = radius * PALM.height;
  const trunkRadius = Math.max(1.4, radius * PALM.trunkRadius);

  let at: Vec3 = [0, 0, 0];
  const lean = tilted(UP, PALM.trunkBend * (0.4 + random()), random() * Math.PI * 2);
  const stride = height / PALM.trunkSteps;
  for (let step = 0; step < PALM.trunkSteps; step += 1) {
    const direction = unit(add(UP, scaled(lean, 0.6 + step * 0.25)));
    const to = add(at, scaled(direction, stride));
    const from = trunkRadius * (step === 0 ? PALM.trunkBase : 1 - 0.12 * (step / PALM.trunkSteps));
    const next = trunkRadius * (1 - 0.12 * ((step + 1) / PALM.trunkSteps));
    limbs.push({ from: at, to, fromRadius: from, toRadius: next });
    at = to;
  }
  const crown = at;

  const count = Math.round(PALM.frondsBase + PALM.frondsPerAge * Math.min(1, age));
  const golden = random() * Math.PI * 2;
  for (let frond = 0; frond < count; frond += 1) {
    const youth = count === 1 ? 0 : frond / (count - 1);
    const azimuth = golden + frond * 2.4 + (random() - 0.5) * 0.4;
    let pitch = PALM.frondRise * (1.1 - 1.25 * (1 - youth)) + (random() - 0.5) * 0.2;
    pitch = Math.max(-0.1, Math.min(1.35, pitch));
    const length = radius * PALM.frondLength * between(random, 0.85, 1.1);
    const step = length / PALM.frondSteps;
    let direction: Vec3 = [Math.cos(pitch) * Math.cos(azimuth), Math.cos(pitch) * Math.sin(azimuth), Math.sin(pitch)];
    let from = crown;
    for (let one = 0; one < PALM.frondSteps; one += 1) {
      direction = unit(add(direction, [0, 0, -PALM.frondDroop * (0.5 + youth * 0.2)]));
      const to = add(from, scaled(direction, step));
      const widthFrom = Math.max(0.45, radius * PALM.frondWidth * (1 - one / PALM.frondSteps));
      const widthTo = Math.max(0.35, radius * PALM.frondWidth * (1 - (one + 1) / PALM.frondSteps));
      limbs.push({ from, to, fromRadius: widthFrom, toRadius: widthTo });
      if (one / PALM.frondSteps >= PALM.leafletFrom) {
        const side: Vec3 = unit([-direction[1], direction[0], 0]);
        const across = Math.max(1.4, radius * PALM.leaflet * (1.15 - 0.6 * (one / PALM.frondSteps)));
        const along = Math.max(1, Math.floor(step / PALM.leafletSpacing));
        for (let leaflet = 0; leaflet < along; leaflet += 1) {
          const there = add(from, scaled(direction, (step * leaflet) / along));
          for (const sign of [1, -1]) {
            tufts.push({
              at: add(there, add(scaled(side, sign * across * 0.8), [0, 0, -across * 0.25])),
              across,
              up: across * PALM.leafletFlat,
              tone: Math.min(1, Math.max(0, 0.35 + 0.4 * youth + (random() - 0.5) * 0.3)),
              open: Math.min(1, 0.35 + one / PALM.frondSteps),
            });
          }
        }
      }
      from = to;
    }
  }
  tufts.push({ at: [crown[0], crown[1], crown[2] + radius * 0.05], across: Math.max(1.6, radius * 0.07), up: Math.max(1.6, radius * 0.07), tone: 0.8, open: 1 });
  return fitted({ limbs, tufts, ragged: PALM.ragged, holes: PALM.holes, clump: 0, envelope: PALM.envelope, bark: 0 }, radius * PALM.reach, PALM.stretch);
};
