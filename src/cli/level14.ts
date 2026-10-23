import { clay } from '../sim/models/clay.ts';
import { knap } from '../sim/models/fracture.ts';
import type { RigId } from '../sim/models/heat.ts';
import { RIGS, RIG_IDS, char, envelopeOf, fire, glowOf } from '../sim/models/heat.ts';

import type { LevelResult, Logger } from './harness.ts';
import { header } from './render.ts';

export function runLevel14(log: Logger): LevelResult {
  log(header('LEVEL 14 — The models: the fire reaches what the book says it reaches'));

  const ceilings = RIG_IDS.map((id) => ({ id, T: envelopeOf(RIGS[id]).T }));
  for (const { id, T } of ceilings) {
    log(`  ${RIGS[id].label.padEnd(15)} tops out at ${String(T).padStart(5)} °C — ${glowOf(T).name}`);
  }
  const expected: Record<RigId, number> = { openFire: 506, pitFire: 697, updraft: 1050, downdraft: 1197 };
  const ceilingsHold = ceilings.every(({ id, T }) => T === expected[id]);

  const ladder =
    expected.openFire < expected.pitFire &&
    expected.pitFire < expected.updraft &&
    expected.updraft < expected.downdraft;
  const kilnNeedsCharcoal = envelopeOf(RIGS.updraft).fuel === 'charcoal';

  const potRate = 1.2;
  const atDamper = (damper: number) =>
    fire({ ...RIGS.updraft.build, fuel: 'charcoal', damper, fuelRate: potRate });
  let peak = { damper: 0, T: 0 };
  for (let step = 0; step <= 400; step += 1) {
    const damper = 0.02 + (step * 0.98) / 400;
    const out = atDamper(damper);
    if (!out.starved && out.T > peak.T) peak = { damper: Math.round(damper * 1000) / 1000, T: out.T };
  }
  log(`  the air peak for pots sits at damper ${peak.damper} — ${peak.T} °C, ${glowOf(peak.T).name}`);
  const peakWhereExpected = Math.abs(peak.damper - 0.6) < 0.02 && peak.T === 918;
  const starvedBelow = atDamper(peak.damper - 0.05).starved;
  const chilledAbove = !atDamper(peak.damper + 0.2).starved && atDamper(peak.damper + 0.2).T < peak.T;

  const woodPit = fire({ ...RIGS.pitFire.build, fuel: 'wood', damper: 1, fuelRate: 1.5 });
  const charPit = fire({ ...RIGS.pitFire.build, fuel: 'charcoal', damper: 1, fuelRate: 1.5 });
  log(`  the pit on wood reaches ${woodPit.T} °C; on charcoal, ${charPit.T} °C and ${charPit.starved ? 'smoking' : 'clean'}`);
  const charcoalPunishes = charPit.T < woodPit.T && charPit.starved && !woodPit.starved;

  const shut = char({ wood: 5, vent: 0.1 });
  const open = char({ wood: 5, vent: 0.5 });
  log(`  the clamp shut gives ${shut.charcoal} of ${shut.grade} (${shut.smoke} smoke); open, ${open.charcoal} of ${open.grade} (${open.smoke})`);
  const charTrades =
    shut.grade === 'brands' && open.grade === 'charcoal' && open.charcoal < shut.charcoal && open.T > shut.T;

  const slow = clay({ temper: 0.2, dryRate: 0.3, rampLow: 0.2, ramp573: 0.2, peak: 960, hold: 35 });
  const fast = clay({ temper: 0.2, dryRate: 0.3, rampLow: 0.95, ramp573: 0.95, peak: 960, hold: 35 });
  log(`  taken up slowly ${Math.round(slow.loss * 100)}% of the ware is lost; rushed, ${Math.round(fast.loss * 100)}%`);
  const scheduleMatters = fast.loss > slow.loss * 2 && slow.grade === fast.grade;
  const soft = clay({ peak: 700, hold: 10 });
  const hard = clay({ peak: 1050, hold: 45 });
  const hardnessCarries = hard.carries > soft.carries && hard.tripsBeforeBreaking > soft.tripsBeforeBreaking;

  const hard3 = knap({ hammer: 'hard' });
  const antler = knap({ hammer: 'antler' });
  log(`  a hard hammer takes ${hard3.fromOneCore} ${hard3.grade} flakes off a core; antler, ${antler.fromOneCore} ${antler.grade}`);
  const knapTrades =
    hard3.ok &&
    antler.ok &&
    (antler.ratio ?? 0) > (hard3.ratio ?? 0) &&
    (antler.fromOneCore ?? 0) < (hard3.fromOneCore ?? 0);
  const overhangSlides = !knap({ angle: 95 }).ok;

  const twice =
    JSON.stringify(fire({ ...RIGS.updraft.build, fuel: 'charcoal', damper: 0.6, fuelRate: 1.2 })) ===
      JSON.stringify(fire({ ...RIGS.updraft.build, fuel: 'charcoal', damper: 0.6, fuelRate: 1.2 })) &&
    JSON.stringify(clay({ peak: 900 })) === JSON.stringify(clay({ peak: 900 }));

  const checks: [string, boolean][] = [
    ['every rig reaches the ceiling the book quotes', ceilingsHold],
    ['the four rigs make a ladder', ladder],
    ['a kiln is at its best on charcoal', kilnNeedsCharcoal],
    ['air has a best setting, where the book says it is', peakWhereExpected],
    ['below the peak the fire is starved', starvedBelow],
    ['above it, cold air chills the chamber', chilledAbove],
    ['charcoal without draught is colder than the wood it replaced', charcoalPunishes],
    ['the clamp trades yield against carbon', charTrades],
    ['a firing is a schedule, not a temperature', scheduleMatters],
    ['a harder pot carries more and lasts longer', hardnessCarries],
    ['a long flake costs the core', knapTrades],
    ['a platform over 90° slides the blow off', overhangSlides],
    ['the models are pure', twice],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    title: 'the models',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `ceilings ${ceilings.map(({ T }) => T).join('/')} °C, air peaks at damper ${peak.damper}`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}
