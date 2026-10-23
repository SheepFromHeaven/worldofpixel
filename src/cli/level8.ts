import { groundWork } from '../sim/area.ts';
import { labelOf, processBuilding } from '../sim/buildings.ts';
import { landWorkById } from '../sim/landWorks.ts';
import type { Building } from '../sim/types.ts';
import { CarrierState } from '../sim/types.ts';

import type { LevelResult, Logger } from './harness.ts';
import { harness } from './harness.ts';
import { header } from './render.ts';

export function runLevel8(log: Logger): LevelResult {
  log(header('LEVEL 8 — Work: the ground gives nothing until a villager works it'));

  const idle = harness();
  for (let tick = 1; tick <= 600; tick += 1) processBuilding(idle.bank, tick);
  const unworkedDrewNothing = idle.bank.producedTotal === 0;

  const run = harness();
  let workingOffMap = true;
  let oneWorkerEach = true;
  let withinCrew = true;
  for (let i = 0; i < 10000; i += 1) {
    const report = run.engine.tick();
    run.events.push(...report.events);

    const inside = new Map<string, number>();
    for (const carrier of run.settlement.carriers.values()) {
      if (carrier.state !== CarrierState.Working) continue;
      const site = run.settlement.buildings.get(carrier.atId);
      if (carrier.trail.length > 0 || !site) workingOffMap = false;
      if (site && carrier.job?.kind === 'work' && groundWork(site)) {
        inside.set(carrier.atId, (inside.get(carrier.atId) ?? 0) + 1);
      } else if (site && carrier.job?.kind === 'tend' && site.slots[carrier.job.slot ?? 0]?.station) {
        const key = `rig:${carrier.atId}#${carrier.job.slot ?? 0}`;
        const crew = (inside.get(key) ?? 0) + 1;
        inside.set(key, crew);
        if (crew > (site.slots[carrier.job.slot ?? 0]?.station?.crew.max ?? 0)) withinCrew = false;
      } else {
        workingOffMap = false;
      }
    }
    for (const [where, count] of inside) {
      if (!where.startsWith('rig:') && count > 1) oneWorkerEach = false;
    }
  }

  const firstShift = (site: Building) => {
    const made = run.events.filter((event) => event.kind === 'produced' && event.buildingId === site.id);
    const worker = made[0]?.carrierId;
    const shift = [];
    for (const event of made) {
      if (event.carrierId !== worker) break;
      if (event.tick !== made[0]!.tick) break;
      shift.push(event);
    }
    const last = shift[shift.length - 1];
    const next = last
      ? run.events.find(
          (event) =>
            event.carrierId === worker && event.tick > last.tick && event.kind !== 'produced',
        )
      : undefined;
    return { shift, next };
  };

  const checks: [string, boolean][] = [
    ['an unworked dig draws nothing', unworkedDrewNothing],
    ['a well bucket takes five seconds', landWorkById('well')?.batch === 1 && landWorkById('well')?.ticks === 50],
    ['the dig gives five loads in ten seconds', landWorkById('digging')?.batch === 5 && landWorkById('digging')?.ticks === 100],
    ['the woodcutter gives ten logs in fifteen', landWorkById('woodcutter')?.batch === 10 && landWorkById('woodcutter')?.ticks === 150],
    ['a worker is never out on the map while working', workingOffMap],
    ['one villager works a land work at a time', oneWorkerEach],
    ['a rig takes a crew, and never more than it has room for', withinCrew],
  ];

  for (const site of [run.reedBed, run.bank]) {
    const work = groundWork(site)!;
    const { shift, next } = firstShift(site);
    log(
      `  ${labelOf(site)}: ${shift.length} × ${work.item} at once after ${work.ticks} ticks, ` +
        `then ${next ? `${next.kind} of ${next.item} at ${next.buildingId === site.id ? 'the same site' : next.buildingId}` : 'nothing'}`,
    );
    checks.push([`one shift at the ${labelOf(site)} yields the batch`, shift.length === work.batch]);
    checks.push([
      `the ${labelOf(site)}'s worker carries out what it drew, unless a need comes first`,
      next?.kind === 'tended' || (next?.kind === 'pickup' && next.buildingId === site.id && next.item === work.item),
    ]);
  }

  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-8',
    title: 'Work',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `${run.events.filter((event) => event.kind === 'produced' && event.carrierId).length} units drawn by hand in 1500 ticks`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}
