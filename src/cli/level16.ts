import { DAY_HOURS, DAY_TICKS, bedsIn, canHaul, dayOf, vesselsHeld } from '../sim/needs.ts';
import { ItemType } from '../sim/types.ts';
import { generateWorld } from '../sim/worldgen.ts';

import type { LevelResult, Logger } from './harness.ts';
import { SEED, foundBesideWater, harness, meanTicks, watchNeeds } from './harness.ts';
import { header } from './render.ts';

const WATCHED = DAY_TICKS * 20;

export function runLevel16(log: Logger): LevelResult {
  log(header('LEVEL 16 — Needs: each villager drinks, eats and sleeps, and works in between'));

  const fresh = generateWorld(SEED);
  const dawnTown = foundBesideWater(fresh).settlement;
  const dryStart = !canHaul(dawnTown, ItemType.Water) && vesselsHeld(dawnTown) === 0;

  const run = harness();
  const { settlement } = run;
  const mudRegardless = canHaul(settlement, ItemType.Mud);
  const bankGivesMud = run.bank.yields.includes(ItemType.Mud);

  const watched = watchNeeds(run, WATCHED);
  const { errands } = watched;
  const by = (kind: string) => errands.filter((e) => e.kind === kind);
  const everyone = [...settlement.carriers.values()].every((carrier) =>
    ['drink', 'eat', 'sleep'].every((kind) => errands.some((e) => e.carrierId === carrier.id && e.kind === kind)),
  );
  log(`  ${by('drink').length} drinks, ${by('eat').length} meals, ${by('sleep').length} sleeps across ${settlement.carriers.size} villagers`);
  const perDay = (kind: string) => by(kind).length / settlement.carriers.size / (WATCHED / DAY_TICKS);
  log(`  a villager's day: ${perDay('drink').toFixed(1)} drinks, ${perDay('eat').toFixed(1)} meals, ${perDay('sleep').toFixed(1)} sleeps`);
  const paced =
    Math.abs(perDay('drink') - 3) < 0.6 && Math.abs(perDay('eat') - 2) < 0.5 && Math.abs(perDay('sleep') - 1) < 0.4;
  log(`  the longest anybody went with a need unmet: ${watched.longestLow} ticks; work taken while one was down: ${watched.workedWhileLow}`);

  const storedMeals = by('eat').filter((e) => e.easy);
  const picked = by('eat').filter((e) => !e.easy);
  log(`  a meal out of a store: ${meanTicks(storedMeals)} ticks (${storedMeals.length}); picking your own: ${meanTicks(picked)} (${picked.length})`);
  const berriesQuicker = storedMeals.length > 0 && picked.length > 0 && meanTicks(storedMeals) < meanTicks(picked);

  const roofed = by('sleep').filter((e) => e.easy);
  const rough = by('sleep').filter((e) => !e.easy);
  log(`  a sleep under a roof: ${meanTicks(roofed)} ticks (${roofed.length}); by the fire: ${meanTicks(rough)} (${rough.length})`);
  const roofQuicker = roofed.length > 0 && rough.length > 0 && meanTicks(roofed) < meanTicks(rough);

  const found = run.events.filter((e) => e.kind === 'produced' && e.buildingId === run.woodcutter.id);
  const berries = found.filter((e) => e.item === ItemType.Berries).length;
  const share = found.length === 0 ? 0 : berries / found.length;
  log(`  the forage camp turned up ${berries} berries in ${found.length} finds (${Math.round(share * 100)}%)`);
  const poolHolds = found.length >= 20 && share > 0.08 && share < 0.35;

  const day = dayOf(settlement);
  const addsUp = Math.abs(Object.values(day).reduce((sum, h) => sum + h, 0) - DAY_HOURS) < 0.01;
  log(`  a day as watched: ${(Object.entries(day) as [string, number][]).map(([part, h]) => `${part} ${h.toFixed(1)}h`).join(' · ')}`);

  const nobodyDied = settlement.carriers.size === bedsIn(settlement) && settlement.carriers.size >= 3;

  const checks: [string, boolean][] = [
    ['every villager drinks, eats and sleeps', everyone],
    ['about three drinks, two meals and a sleep in a day', paced],
    ['nobody goes half a day with a need unmet', watched.longestLow < DAY_TICKS / 2],
    ['nobody takes work while a need is down to its mark', watched.workedWhileLow === 0],
    ['berries out of a store are a quicker meal than picking your own', berriesQuicker],
    ['a roof is a quicker night than the fire', roofQuicker],
    ['the forage camp turns up berries about one time in five', poolHolds],
    ['the watched day comes to fourteen hours', addsUp],
    ['nobody carries water before there is something to carry it in', dryStart],
    ['mud can be dug out of a bank regardless, which is the way out', mudRegardless && bankGivesMud],
    ['needs cost time, never lives', nobodyDied],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-16',
    title: 'Needs',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `${errands.length} needs seen to; the longest unmet ${watched.longestLow} ticks; berries ${Math.round(share * 100)}% of finds`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}
