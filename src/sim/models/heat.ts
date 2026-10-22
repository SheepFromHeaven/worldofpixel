import { clamp, round2 } from './units.ts';

export type FuelId = 'wood' | 'brands' | 'charcoal';

export interface Fuel {
  label: string;
  energy: number;
  airNeed: number;
}

export const FUELS: Record<FuelId, Fuel> = {
  wood: { label: 'Wood', energy: 15, airNeed: 6.2 },
  brands: { label: 'Brands', energy: 22, airNeed: 8.5 },
  charcoal: { label: 'Charcoal', energy: 30, airNeed: 11.5 },
};

export const AMBIENT = 20;
const CP_AIR = 1.1;

export const K = { draught: 0.6, wall: 0.8, efficiency: 0.6, leak: 0.2 };

export interface BuildParams {
  vent: number;
  flue: number;
  wall: number;
  chamber: number;
  maxRate: number;
}

export interface RunParams {
  fuel: FuelId;
  damper: number;
  fuelRate: number;
}

export interface FireResult {
  T: number;
  air: number;
  burn: number;
  unburnt: number;
  starved: boolean;
  waste: number;
  glow: GlowStep;
}

export function fire(params: Partial<BuildParams> & Partial<RunParams>): FireResult {
  const fuel = FUELS[params.fuel ?? 'wood'];
  const vent = params.vent ?? 1;
  const flue = params.flue ?? 0.2;
  const wall = params.wall ?? 0.05;
  const chamber = params.chamber ?? 1;
  const damper = clamp(params.damper ?? 1, 0.02, 1);
  const rate = Math.min(Math.max(0, params.fuelRate ?? 1), params.maxRate ?? 99);

  const kWall = (K.wall * Math.pow(chamber, 2 / 3)) / Math.max(wall, 0.03);
  let T = AMBIENT + 1;
  let air = 0;
  let burn = 0;
  let unburnt = 0;
  for (let i = 0; i < 80; i += 1) {
    const draught = K.draught * vent * damper * Math.sqrt(Math.max(0, flue * (T - AMBIENT)));
    air = draught + K.leak * vent * damper;
    burn = Math.min(rate, air / fuel.airNeed);
    unburnt = Math.max(0, rate - burn);
    const efficiency = K.efficiency * (1 - Math.min(0.5, (unburnt / Math.max(rate, 0.001)) * 0.6));
    const flow = air + burn + unburnt * 2.2;
    const next = AMBIENT + (burn * fuel.energy * 1000 * efficiency) / (flow * CP_AIR + kWall);
    T += (next - T) * 0.35;
  }

  return {
    T: Math.round(T),
    air: round2(air),
    burn: round2(burn),
    unburnt: round2(unburnt),
    starved: unburnt > rate * 0.04,
    waste: round2(unburnt / Math.max(rate, 0.001)),
    glow: glowOf(T),
  };
}

export interface GlowStep {
  at: number;
  name: string;
}

export const GLOW: readonly GlowStep[] = [
  { at: 0, name: 'black' },
  { at: 480, name: 'faint red' },
  { at: 600, name: 'dull red' },
  { at: 750, name: 'cherry' },
  { at: 900, name: 'orange' },
  { at: 1050, name: 'yellow' },
  { at: 1200, name: 'white' },
];

export function glowOf(T: number): GlowStep {
  let found = GLOW[0] as GlowStep;
  for (const step of GLOW) if (T >= step.at) found = step;
  return found;
}

export type RigId = 'openFire' | 'pitFire' | 'updraft' | 'downdraft';

export interface RigSpec {
  label: string;
  step: number;
  build: BuildParams;
  fuels: readonly FuelId[];
  knobs: readonly string[];
}

export const RIGS: Record<RigId, RigSpec> = {
  openFire: {
    label: 'Open fire',
    step: 1,
    build: { vent: 3, flue: 0.06, wall: 0.03, chamber: 0.5, maxRate: 1.6 },
    fuels: ['wood'],
    knobs: ['fuelRate'],
  },
  pitFire: {
    label: 'Pit fire',
    step: 14,
    build: { vent: 1.2, flue: 0.3, wall: 0.1, chamber: 1.2, maxRate: 2.6 },
    fuels: ['wood'],
    knobs: ['fuelRate', 'damper'],
  },
  updraft: {
    label: 'Updraft kiln',
    step: 18,
    build: { vent: 1.0, flue: 1.6, wall: 0.18, chamber: 2.2, maxRate: 3.4 },
    fuels: ['wood', 'charcoal'],
    knobs: ['fuelRate', 'damper', 'fuel', 'stack'],
  },
  downdraft: {
    label: 'Downdraft kiln',
    step: 27,
    build: { vent: 1.2, flue: 3.2, wall: 0.3, chamber: 3.0, maxRate: 5 },
    fuels: ['wood', 'charcoal'],
    knobs: ['fuelRate', 'damper', 'fuel', 'stack', 'reduction'],
  },
};

export const RIG_IDS: readonly RigId[] = ['openFire', 'pitFire', 'updraft', 'downdraft'];

export interface Envelope extends FireResult {
  fuel: FuelId;
  damper: number;
  fuelRate: number;
}

const envelopes = new Map<string, Envelope>();

export function envelopeOf(rig: RigSpec): Envelope {
  const { vent, flue, wall, chamber, maxRate } = rig.build;
  const key = `${rig.fuels.join(',')}|${vent}|${flue}|${wall}|${chamber}|${maxRate}`;
  const known = envelopes.get(key);
  if (known) return known;
  const found = sweepEnvelope(rig);
  envelopes.set(key, found);
  return found;
}

function sweepEnvelope(rig: RigSpec): Envelope {
  let best: Envelope = { ...fire({ ...rig.build, fuel: 'wood', damper: 0.02, fuelRate: 0 }), T: 0, fuel: 'wood', damper: 0, fuelRate: 0 };
  for (const fuel of rig.fuels)
    for (let d = 0.05; d <= 1.001; d += 0.025)
      for (let r = 0.1; r <= rig.build.maxRate + 0.001; r += 0.1) {
        const out = fire({ ...rig.build, fuel, damper: d, fuelRate: r });
        if (!out.starved && out.T > best.T) {
          best = { ...out, fuel, damper: round2(d), fuelRate: round2(r) };
        }
      }
  return best;
}

export type CharGrade = 'brands' | 'char' | 'charcoal';

export interface CharResult {
  T: number;
  carbon: number;
  charcoal: number;
  yieldFrac: number;
  grade: CharGrade;
  fuel: FuelId;
  minutes: number;
  smoke: 'white' | 'yellow' | 'blue';
}

export function char(params: { wood?: number; vent?: number; billet?: number }): CharResult {
  const wood = params.wood ?? 5;
  const open = clamp(params.vent ?? 0.3, 0.02, 1);
  const billet = clamp(params.billet ?? 0.45, 0.05, 1);

  const burnFrac = 0.04 + open * 0.52;
  const even = 1 - Math.abs(billet - 0.45) * 1.1;
  const T = Math.round(240 + burnFrac * 1150 * (0.75 + 0.25 * even));
  const carbon = clamp((T - 260) / 300, 0, 1);
  const yieldFrac = clamp(0.38 - burnFrac * 0.42, 0.05, 0.38) * (0.6 + 0.4 * even);
  const grade: CharGrade = carbon < 0.45 ? 'brands' : carbon < 0.8 ? 'char' : 'charcoal';

  return {
    T,
    carbon: round2(carbon),
    charcoal: Math.round(wood * yieldFrac * 10) / 10,
    yieldFrac: round2(yieldFrac),
    grade,
    fuel: grade === 'brands' ? 'brands' : 'charcoal',
    minutes: Math.round((16 - open * 9) * (0.6 + billet)),
    smoke: carbon < 0.35 ? 'white' : carbon < 0.75 ? 'yellow' : 'blue',
  };
}
