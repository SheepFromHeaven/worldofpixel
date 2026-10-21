/**
 * The physical models behind every figure on this page.
 *
 * Nothing here is drawn by eye: every curve, readout and number in `methods.html` is computed by
 * calling these, so a figure cannot drift away from the design it illustrates. They are written
 * to port into `src/sim/models/` unchanged — pure, deterministic, no clock and no DOM.
 *
 * The constants in `K` were fitted against the temperatures these rigs actually reach: an open
 * fire around 600 °C, a pit firing 700 to 800, an updraft kiln 900 on wood and just over 1000 on
 * charcoal, a downdraft kiln past 1200.
 */


export const FUELS = {
  wood: { label: 'Wood', energy: 15, airNeed: 6.2 },
  brands: { label: 'Brands', energy: 22, airNeed: 8.5 },
  charcoal: { label: 'Charcoal', energy: 30, airNeed: 11.5 },
};

const AMBIENT = 20;
const CP_AIR = 1.1;
export const K = { draught: 0.6, wall: 0.8, efficiency: 0.6, leak: 0.2 };

/**
 * One fire, whatever is standing round it.
 *
 * The rig's build params decide how much air the stack can pull and how much heat the walls
 * keep; the method's run params decide what is burnt and how fast. Draught depends on the
 * temperature it is itself producing — a hotter fire pulls harder — so the balance is found by
 * iterating rather than in one pass.
 *
 * The peak is the whole point: short of stoichiometric air the fuel only half burns and the
 * unburnt volatiles leave up the flue carrying heat with them, and past it every extra litre of
 * air is cold air that has to be heated. Both sides of that are in here, which is why air is a
 * knob with a best setting rather than one to open wide.
 */
export function fire(p) {
  const fuel = FUELS[p.fuel] || FUELS.wood;
  const vent = p.vent ?? 1;
  const flue = p.flue ?? 0.2;
  const wall = p.wall ?? 0.05;
  const chamber = p.chamber ?? 1;
  const damper = clamp(p.damper ?? 1, 0.02, 1);
  const rate = Math.min(Math.max(0, p.fuelRate ?? 1), p.maxRate ?? 99);

  const kWall = (K.wall * Math.pow(chamber, 2 / 3)) / Math.max(wall, 0.03);
  let T = AMBIENT + 1;
  let air = 0, burn = 0, unburnt = 0;
  for (let i = 0; i < 80; i++) {
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

/** The hottest a rig can be driven: the best run params its build params allow. */
export function envelopeOf(rig) {
  let best = { T: 0 };
  for (const fuel of rig.fuels)
    for (let d = 0.05; d <= 1.001; d += 0.025)
      for (let r = 0.1; r <= (rig.build.maxRate ?? 6) + 0.001; r += 0.1) {
        const out = fire({ ...rig.build, fuel, damper: d, fuelRate: r });
        if (!out.starved && out.T > best.T) best = { ...out, fuel, damper: round2(d), fuelRate: round2(r) };
      }
  return best;
}

/** What the eye reads off a glowing chamber, before anybody has an instrument. */
export const GLOW = [
  { at: 0, name: 'black', hex: '#2a1c16' },
  { at: 480, name: 'faint red', hex: '#6b1f12' },
  { at: 600, name: 'dull red', hex: '#9c2a14' },
  { at: 750, name: 'cherry', hex: '#d4502a' },
  { at: 900, name: 'orange', hex: '#ef8a38' },
  { at: 1050, name: 'yellow', hex: '#ffcf55' },
  { at: 1200, name: 'white', hex: '#fff4b8' },
];
export function glowOf(T) {
  let g = GLOW[0];
  for (const step of GLOW) if (T >= step.at) g = step;
  return g;
}

/**
 * The rigs, as build params. `maxRate` is the firebox: how much fuel it can hold burning at once,
 * which is what stops every rig being driven to the same temperature by stoking harder.
 */
export const RIGS = {
  openFire: { label: 'Open fire', step: 1, build: { vent: 3, flue: 0.06, wall: 0.03, chamber: 0.5, maxRate: 1.6 }, fuels: ['wood'], knobs: ['fuelRate'] },
  pitFire: { label: 'Pit fire', step: 14, build: { vent: 1.2, flue: 0.3, wall: 0.1, chamber: 1.2, maxRate: 2.6 }, fuels: ['wood'], knobs: ['fuelRate', 'damper'] },
  updraft: { label: 'Updraft kiln', step: 18, build: { vent: 1.0, flue: 1.6, wall: 0.18, chamber: 2.2, maxRate: 3.4 }, fuels: ['wood', 'charcoal'], knobs: ['fuelRate', 'damper', 'fuel', 'stack'] },
  downdraft: { label: 'Downdraft kiln', step: 27, build: { vent: 1.2, flue: 3.2, wall: 0.3, chamber: 3.0, maxRate: 5 }, fuels: ['wood', 'charcoal'], knobs: ['fuelRate', 'damper', 'fuel', 'stack', 'reduction'] },
};

/**
 * Charring, which is not a fire in a chamber but a pile cooking itself: the heat that drives the
 * pyrolysis comes from burning a part of the wood, so the single knob — how much air is let in —
 * sets the temperature, and the temperature sets both how much charcoal is left and how good it
 * is. Yield and quality pull against each other in opposite directions, which is the entire
 * decision.
 */
export function char(p) {
  const wood = p.wood ?? 5;
  const open = clamp(p.vent ?? 0.3, 0.02, 1);
  const billet = clamp(p.billet ?? 0.45, 0.05, 1);

  // Air admitted decides what share of the pile burns to drive the rest, and so how hot it gets.
  const burnFrac = 0.04 + open * 0.52;
  const even = 1 - Math.abs(billet - 0.45) * 1.1;
  const T = Math.round(240 + burnFrac * 1150 * (0.75 + 0.25 * even));
  // Below ~300 °C the wood is only scorched; past ~500 °C the volatiles are gone and what is left
  // is carbon. Air beyond that burns the carbon itself away.
  const carbon = clamp((T - 260) / 300, 0, 1);
  const yieldFrac = clamp(0.38 - burnFrac * 0.42, 0.05, 0.38) * (0.6 + 0.4 * even);
  const grade = carbon < 0.45 ? 'brands' : carbon < 0.8 ? 'char' : 'charcoal';

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

/**
 * Clay, from the pit to a fired pot. Everything that makes a pot strong also makes it likelier
 * to crack, and temper is the answer to that at the cost of the strength it was bought with.
 * Two of the knobs are schedule rather than quantity: how fast the firing is taken through
 * boiling, and how fast through the quartz inversion at 573 °C, which cracks ware on the way up
 * and again on the way down.
 */
export function clay(p) {
  const fine = clamp(p.fineness ?? 0.6);
  const temper = clamp(p.temper ?? 0.15, 0, 0.5);
  const water = clamp(p.water ?? 0.25, 0.1, 0.45);
  const wall = clamp(p.wall ?? 0.5);
  const dry = clamp(p.dryRate ?? 0.5);
  const rampLow = clamp(p.rampLow ?? 0.5);
  const ramp573 = clamp(p.ramp573 ?? 0.5);
  const peak = p.peak ?? 800;
  const hold = p.hold ?? 20;

  const shrink = (0.04 + fine * 0.09) * (water / 0.25) * (1 - temper * 1.3);
  const dryCrack = clamp((shrink - 0.045) * 9 * (0.35 + dry) * (0.6 + wall), 0, 1);
  const moistureLeft = clamp(0.5 - dry * 0.3, 0, 1) * clamp(rampLow * 1.4, 0, 1);
  const steamCrack = clamp(moistureLeft * (0.3 + wall), 0, 1);
  const quartzCrack = peak > 573 ? clamp((ramp573 - 0.35) * 1.5 * (0.4 + wall * 1.2), 0, 1) : 0;
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

/**
 * Conchoidal fracture, which is what makes knapping a parameter problem rather than a timing one.
 * The platform has to lean under 90°, the blow has to land close behind the edge, and the hammer
 * decides whether the force arrives as a shock or a push. A long thin flake is the better edge
 * and takes more of the core with it, so the trade is edges against how many you get.
 */
export const HAMMERS = {
  hard: { label: 'Hard stone', shock: 1, spread: 0.35, crush: 1 },
  soft: { label: 'Soft stone', shock: 0.72, spread: 0.6, crush: 0.5 },
  antler: { label: 'Antler', shock: 0.5, spread: 0.85, crush: 0.18 },
};
export function knap(p) {
  const h = HAMMERS[p.hammer] || HAMMERS.hard;
  const angle = p.angle ?? 72;
  const force = clamp(p.force ?? 0.6, 0, 1);
  const setback = clamp(p.setback ?? 0.5, 0, 1);
  const prepared = p.prepared ?? false;

  if (angle >= 90) return { ok: false, why: 'The platform overhangs, so the blow slides off.', flakes: 0 };
  const angleFit = clamp(1 - Math.abs(angle - 72) / 32, 0, 1);
  const crush = clamp((h.crush * (prepared ? 0.35 : 1) * force - angleFit * 0.45) * 1.4, 0, 1);
  if (crush > 0.62) return { ok: false, why: 'The platform crushed: too much hammer for an unprepared edge.', flakes: 1, grade: 'scrap' };
  if (force > 0.9 && h.shock > 0.8) return { ok: false, why: 'The core snapped in two.', flakes: 0 };

  const length = force * (0.5 + h.spread) * (0.55 + angleFit * 0.65) * (1.25 - setback * 0.5);
  const thickness = force * h.shock * (0.5 + setback * 0.8);
  const ratio = length / Math.max(0.08, thickness);
  return {
    ok: true,
    grade: ratio > 2.4 ? 'fine' : ratio > 1.5 ? 'good' : 'rough',
    ratio: round2(ratio),
    length: round2(length),
    fromOneCore: Math.max(1, Math.round(9 - ratio * 2.2)),
    edgeLife: Math.round(6 + ratio * 9),
  };
}

const round2 = (v) => Math.round(v * 100) / 100;
function clamp(v, a = 0, b = 1) {
  return v < a ? a : v > b ? b : v;
}



/* ------------------------------------------------------------------ knowing

 * A knob is only as fine as the instrument that reads it.
 *
 * This is the correction that keeps the design honest. Nobody can set a damper to 62% before
 * anybody can measure anything: what they can do is bank the fire low, middling or high, run it,
 * and see what comes out. So a parameter arrives as a handful of named settings you can tell
 * apart by eye, and it only becomes a number — and only then a curve — when an instrument exists
 * that reads it continuously.
 *
 * The rule the UI must keep: never draw a line between two settings the player has no reason to
 * believe anything lies between. Three settings are three bars, not a curve through three points.
 */

export const RESOLUTIONS = {
  ordinal: {
    label: 'ordinal', steps: 3, readout: 'bars',
    note: 'Named settings you can tell apart by eye. No units, no interpolation.',
  },
  graded: {
    label: 'graded', steps: 7, readout: 'steps',
    note: 'Numbered notches. The book can rank them, but the space between two is still unknown.',
  },
  continuous: {
    label: 'continuous', steps: 0, readout: 'curve',
    note: 'A measured value with units. Only here may the game draw a curve and interpolate.',
  },
};

/** How a heat knob reads at each stage, and what the setting really is underneath. */
export const HEAT_SETTINGS = {
  ordinal: [
    { name: 'red', damper: 0.34, hint: 'barely glowing' },
    { name: 'yellow', damper: 0.6, hint: 'bright, steady' },
    { name: 'white', damper: 0.95, hint: 'roaring' },
  ],
  graded: [0.2, 0.33, 0.46, 0.6, 0.73, 0.86, 0.99].map((d, i) => ({ name: `notch ${i + 1}`, damper: d })),
};

/**
 * What a setting is *worth*, which early on is not predicted but measured: run it, wait, and the
 * town reports a rate. The estimate closes on the truth as the sample grows, and it can never be
 * finer than the instrument reading it.
 *
 * Deterministic on purpose. The spread here stands in for variation the simulation will have for
 * real — damp fuel, a slower worker, a coarser batch of clay — so no `Math.random` is needed in
 * the figure or later in `sim/`.
 */
export function observe(truth, runs, resolution = 'ordinal') {
  const floor = { ordinal: 0.22, graded: 0.09, continuous: 0.02 }[resolution] ?? 0.22;
  const n = Math.max(0, runs);
  if (n === 0) return { known: false, estimate: null, lo: null, hi: null, spread: 1, runs: 0 };
  const spread = Math.max(floor, 0.55 / Math.sqrt(n));
  // A deterministic wobble that shrinks with the sample, standing in for real variation.
  const bias = (hashish(Math.round(truth * 97), n) - 0.5) * spread * 0.8;
  const estimate = truth * (1 + bias);
  return {
    known: true,
    runs: n,
    estimate: round2(estimate),
    lo: round2(estimate * (1 - spread)),
    hi: round2(estimate * (1 + spread)),
    spread: round2(spread),
    confident: spread <= floor * 1.35,
  };
}
function hashish(a, b) {
  let h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
  h ^= h >>> 15;
  return ((h >>> 0) % 10000) / 10000;
}

/* ------------------------------------------------------------------- needs

 * The bottom of the pyramid, from the first minute.
 *
 * A villager is not free labour. Water, food, warmth and rest come out of the same day that
 * work does, and at the start they eat nearly all of it. That is the chapter's real subject:
 * every technology here buys back hours. A town of three foragers has a handful of spare hours
 * a day between them; a town of thirteen with pots, tools and roofs has a hundred.
 *
 * Hours are per person per day, out of a waking day of fourteen.
 */
export const DAY_HOURS = 14;
export const NEED = { waterLitres: 3, kcal: 2200 };

export function day(p) {
  const people = p.people ?? 3;
  const walkMinutes = p.waterWalk ?? 24;
  const vessel = p.vessel ?? 0;
  const forageRate = p.kcalPerHour ?? 480;
  const prepRate = p.prepPerHour ?? 1500;
  const shelter = clamp(p.shelter ?? 0);
  const fuelHours = p.fuelHours ?? 1.5;

  // With nothing to carry water in, everybody walks to the river for every drink.
  const tripsEach = vessel <= 0 ? 3 : Math.ceil(NEED.waterLitres / vessel) / (p.carriers ?? 1);
  const water = (tripsEach * walkMinutes) / 60;
  const food = NEED.kcal / forageRate;
  const prep = NEED.kcal / prepRate;
  // Sleeping rough costs waking hours: you recover badly and start late.
  const rest = 2.2 * (1 - shelter * 0.72);

  const survival = water + food + prep + fuelHours + rest;
  const work = Math.max(0, DAY_HOURS - survival);
  const share = (v) => round2(v / DAY_HOURS);

  return {
    people,
    hours: { water: round2(water), food: round2(food), prep: round2(prep), fuel: round2(fuelHours), rest: round2(rest), work: round2(work) },
    shares: { water: share(water), food: share(food), prep: share(prep), fuel: share(fuelHours), rest: share(rest), work: share(work) },
    surplusShare: share(work),
    surplusHours: round2(work * people),
  };
}

/** The two ends of the chapter, as the same function with different equipment. */
export const DAYS = {
  dawn: { label: 'Age I · three foragers', people: 3, waterWalk: 26, vessel: 0, kcalPerHour: 480, prepPerHour: 1500, shelter: 0, fuelHours: 1.6 },
  mid: { label: 'Age III · pots and a hut', people: 8, waterWalk: 12, vessel: 8, carriers: 2, kcalPerHour: 760, prepPerHour: 2600, shelter: 0.55, fuelHours: 1.1 },
  dusk: { label: 'Age V · the clay house', people: 13, waterWalk: 9, vessel: 8, carriers: 3, kcalPerHour: 1150, prepPerHour: 4200, shelter: 0.95, fuelHours: 0.75 },
};
