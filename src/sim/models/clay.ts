import { clamp, round2 } from './units.ts';

export interface ClayParams {
  fineness?: number;
  temper?: number;
  water?: number;
  wall?: number;
  dryRate?: number;
  rampLow?: number;
  ramp573?: number;
  peak?: number;
  hold?: number;
}

export type ClayGrade = 'soft' | 'good' | 'hard';

export interface ClayResult {
  shrink: number;
  loss: number;
  dryCrack: number;
  thermalShock: number;
  hardness: number;
  porosity: number;
  strength: number;
  grade: ClayGrade;
  carries: number;
  tripsBeforeBreaking: number;
}

const QUARTZ_INVERSION = 573;

export function clay(params: ClayParams): ClayResult {
  const fine = clamp(params.fineness ?? 0.6);
  const temper = clamp(params.temper ?? 0.15, 0, 0.5);
  const water = clamp(params.water ?? 0.25, 0.1, 0.45);
  const wall = clamp(params.wall ?? 0.5);
  const dry = clamp(params.dryRate ?? 0.5);
  const rampLow = clamp(params.rampLow ?? 0.5);
  const ramp573 = clamp(params.ramp573 ?? 0.5);
  const peak = params.peak ?? 800;
  const hold = params.hold ?? 20;

  const shrink = (0.04 + fine * 0.09) * (water / 0.25) * (1 - temper * 1.3);
  const dryCrack = clamp((shrink - 0.045) * 9 * (0.35 + dry) * (0.6 + wall), 0, 1);
  const moistureLeft = clamp(0.5 - dry * 0.3, 0, 1) * clamp(rampLow * 1.4, 0, 1);
  const steamCrack = clamp(moistureLeft * (0.3 + wall), 0, 1);
  const quartzCrack =
    peak > QUARTZ_INVERSION ? clamp((ramp573 - 0.35) * 1.5 * (0.4 + wall * 1.2), 0, 1) : 0;
  const thermalShock = clamp((quartzCrack + steamCrack) * (1 - temper * 1.6), 0, 1);
  const loss = clamp(dryCrack * 0.55 + thermalShock * 0.8, 0, 0.95);

  const vitrify = clamp((peak - 600) / 450, 0, 1) * clamp(0.45 + hold / 60, 0, 1);
  const hardness = clamp(vitrify * (1 - temper * 0.55) * (0.5 + fine * 0.6), 0, 1);
  const porosity = clamp(0.55 - vitrify * 0.45 + temper * 0.4, 0.02, 0.9);
  const strength = clamp(hardness * (0.55 + 0.45 * (1 - temper)) * (0.5 + wall * 0.7), 0, 1);

  return {
    shrink: round2(shrink),
    loss: round2(loss),
    dryCrack: round2(dryCrack),
    thermalShock: round2(thermalShock),
    hardness: round2(hardness),
    porosity: round2(porosity),
    strength: round2(strength),
    grade: hardness < 0.3 ? 'soft' : hardness < 0.62 ? 'good' : 'hard',
    carries: Math.max(1, Math.round(1 + hardness * 3)),
    tripsBeforeBreaking: Math.max(2, Math.round(4 + hardness * 36)),
  };
}
