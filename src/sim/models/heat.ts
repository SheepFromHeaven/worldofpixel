import { clamp, round2 } from './units.ts';

/**
 * One fire, whatever is standing round it.
 *
 * The hearth, the pit firing, the clamp and both kilns are this one function. Nothing is
 * special-cased, so everything the design claims about fuel and air falls out of the model
 * rather than being asserted somewhere else and drawn here.
 *
 * The constants were fitted against the temperatures these rigs actually reach, and the levels
 * assert the ceilings they produce (an open fire around 500 °C, a pit firing just under 700, an
 * updraft kiln 1050 on charcoal, a downdraft past 1190). Changing one changes the game's whole
 * heat ladder, so the level is the contract: `docs/methods.html` and this file cannot drift.
 */

export type FuelId = 'wood' | 'brands' | 'charcoal';

export interface Fuel {
  label: string;
  /** MJ per unit. */
  energy: number;
  /** Units of air wanted per unit of fuel to burn it clean. */
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

/** What the masonry fixes: changing one of these means tearing the rig down. */
export interface BuildParams {
  vent: number;
  flue: number;
  wall: number;
  chamber: number;
  maxRate: number;
}

/** What a method sets, free, any time. */
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
  /** Short of air: the fuel only half burns and the volatiles leave up the flue as smoke. */
  starved: boolean;
  waste: number;
  glow: GlowStep;
}

/**
 * Draught depends on the temperature it is itself producing — a hotter fire pulls harder — so
 * the balance is found by iterating rather than in one pass. Eighty passes at a relaxation of
 * 0.35 is what `docs/model.js` settles on, and the fitted ceilings are that schedule's answers.
 */
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

/** What the eye reads off a glowing chamber, before anybody has an instrument. */
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
  /** Which of the chapter's 27 steps raises it. */
  step: number;
  build: BuildParams;
  fuels: readonly FuelId[];
  knobs: readonly string[];
}

/**
 * `maxRate` is the firebox: how much fuel it can hold burning at once, which is the only thing
 * stopping every rig being stoked to the same temperature and build params meaning nothing.
 */
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

/**
 * Worked out once per set of build params and kept.
 *
 * The sweep below is a few thousand `fire()` calls of eighty iterations each, and the envelope
 * is asked for on every scan of every rig's queue, every tick. Left uncached that is a couple
 * of hundred thousand floating-point steps a tick for one hearth — which does not look like a
 * slow function, it looks like the game failing to start.
 *
 * Safe to keep because the envelope is exactly what the masonry fixes: nothing but tearing the
 * rig down and building it differently can move it.
 */
const envelopes = new Map<string, Envelope>();

/**
 * The hottest a rig can be driven: the best run params its build params allow, which is what a
 * method is checked against before it may be stamped onto a rig.
 *
 * Swept rather than solved. The peak is a ridge in two knobs and the step sizes here are the
 * ones the fitted ceilings were read off, so coarsening them moves the numbers the levels assert.
 */
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

/**
 * Charring, which is not a fire in a chamber but a pile cooking itself: the heat that drives the
 * pyrolysis comes from burning a part of the wood, so the single knob — how much air is let in —
 * sets the temperature, and the temperature sets both how much charcoal is left and how good it
 * is. Yield and quality pull against each other, and that opposition is the entire decision.
 */
export function char(params: { wood?: number; vent?: number; billet?: number }): CharResult {
  const wood = params.wood ?? 5;
  const open = clamp(params.vent ?? 0.3, 0.02, 1);
  const billet = clamp(params.billet ?? 0.45, 0.05, 1);

  const burnFrac = 0.04 + open * 0.52;
  const even = 1 - Math.abs(billet - 0.45) * 1.1;
  const T = Math.round(240 + burnFrac * 1150 * (0.75 + 0.25 * even));
  // Below ~300 °C the wood is only scorched; past ~500 °C the volatiles are gone and what is
  // left is carbon. Air beyond that burns the carbon itself away.
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
