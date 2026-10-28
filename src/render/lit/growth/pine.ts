import { makeConifer } from './conifer.ts';
import type { ConiferParams } from './conifer.ts';

export const PINE: ConiferParams = {
  reach: 0.95,
  stretch: 1,
  height: 4.6,
  trunkRadius: 0.07,
  trunkTop: 0.2,
  clear: 0.27,
  whorlsBase: 4,
  whorlsPerAge: 3,
  branchesPerWhorl: [6, 8],
  branchLength: 0.62,
  shortest: 0.12,
  taper: 0.85,
  droopLow: -0.2,
  liftHigh: 0.12,
  branchSteps: 3,
  tipLift: 0.06,
  wander: 0.16,
  twigsPerBranch: 2,
  twigAngle: [0.5, 0.9],
  twigLength: 0.45,
  twigDroop: -0.25,
  needleSpacing: 1.4,
  needleFrom: 0.28,
  needle: 0.12,
  needleFlat: 0.55,
  needleHang: -0.2,
  crownTuft: 0.07,
  ragged: 0.16,
  holes: 0.03,
};

export const growPine = makeConifer(PINE);

export const SPRUCE: ConiferParams = {
  ...PINE,
  height: 4.4,
  clear: 0.12,
  whorlsBase: 6,
  whorlsPerAge: 4,
  branchesPerWhorl: [6, 8],
  branchLength: 0.5,
  shortest: 0.15,
  taper: 1,
  droopLow: -0.45,
  liftHigh: -0.05,
  needleSpacing: 1.1,
  needle: 0.11,
};

export const CYPRESS: ConiferParams = {
  ...PINE,
  height: 5.4,
  clear: 0.08,
  whorlsBase: 8,
  whorlsPerAge: 4,
  branchesPerWhorl: [5, 6],
  branchLength: 0.34,
  shortest: 0.2,
  taper: 0.3,
  droopLow: 0.35,
  liftHigh: 0.75,
  twigsPerBranch: 1,
  needleSpacing: 1,
  needle: 0.15,
};

export const growSpruce = makeConifer(SPRUCE);

export const growCypress = makeConifer(CYPRESS);
