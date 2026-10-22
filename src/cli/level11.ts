import { claimOf } from '../sim/claims.ts';
import { canBuild, placeBuilding } from '../sim/construction.ts';
import { LEAN_TO_ID } from '../sim/designs.ts';
import { fadeWear, neighbours, paceAt, positionOf, route, routeCost, wornness } from '../sim/footpaths.ts';
import { distance } from '../sim/geometry.ts';
import { PARCEL, cellsIn, parcelOf } from '../sim/terrain/parcels.ts';
import { waterBetween } from '../sim/terrain/terrain.ts';
import { isWater } from '../sim/terrain/worldfield.ts';
import type { CellId } from '../sim/types.ts';
import { BuildingState } from '../sim/types.ts';

import type { LevelResult, Logger } from './harness.ts';
import { designFrom, harness, play, workOf } from './harness.ts';
import { header } from './render.ts';

export function runLevel11(log: Logger): LevelResult {
  log(header('LEVEL 11 — Footpaths: nobody lays a road; walking wears one'));
  const run = harness();
  const { world, settlement } = run;
  const hearth = settlement.buildings.get(settlement.hearthId)!;

  let far = run.woodcutter;
  for (let i = 0; i < 2; i += 1) {
    const edge = claimOf(world, settlement)
      .filter((id) => canBuild(world, settlement, id, workOf('forage-camp')).ok)
      .sort((a, b) => distance(parcelOf(world.seed, b).site, hearth.position) - distance(parcelOf(world.seed, a).site, hearth.position))[0];
    if (edge) far = placeBuilding(world, settlement, edge, workOf('forage-camp'));
  }

  for (let i = 0; i < 3; i += 1) {
    const spot = claimOf(world, settlement).find((id) =>
      canBuild(world, settlement, id, designFrom(world, LEAN_TO_ID)).ok,
    );
    if (spot) placeBuilding(world, settlement, spot, designFrom(world, LEAN_TO_ID));
  }

  for (const building of settlement.buildings.values()) {
    building.clearing = null;
    building.state = BuildingState.Idle;
  }

  const fresh = route(world, hearth.cellId, far.cellId);
  const freshCost = fresh ? routeCost(world, fresh) : Infinity;
  play(run, 6000, () => {});

  const worn = [...world.wear.keys()];
  const showing = worn.filter((id) => wornness(world, id) >= 0.1);
  const again = route(world, hearth.cellId, far.cellId);
  const wornCost = fresh ? routeCost(world, fresh) : Infinity;
  const busiest = [...settlement.buildings.values()]
    .filter((b) => b.id !== hearth.id)
    .sort((a, b) => b.producedTotal - a.producedTotal)[0];
  const toward = busiest ? route(world, hearth.cellId, busiest.cellId) : null;
  const between = toward ? toward.slice(1, -1) : [];
  const onPaths =
    between.length > 0 ? between.filter((id) => (world.wear.get(id) ?? 0) > 0).length / between.length : 0;

  const best = worn.reduce((a, b) => ((world.wear.get(b) ?? 0) > (world.wear.get(a) ?? 0) ? b : a), worn[0] ?? '');
  const quicker = best ? paceAt(world, best) : 0;
  const steps = world.wear.get(best) ?? 0;
  const resting = new Map(world.wear);
  world.wear.set(best, 0);
  world.wear.delete(best);
  const unworn = best ? paceAt(world, best) : 0;
  world.wear = resting;

  const most = Math.max(...world.wear.values());
  for (let i = 0; i < most; i += 1) fadeWear(world);
  const grownBack = world.wear.size === 0;

  const banks = cellsIn(world.seed, PARCEL, {
    minX: hearth.position.x - PARCEL * 10,
    maxX: hearth.position.x + PARCEL * 10,
    minY: hearth.position.y - PARCEL * 10,
    maxY: hearth.position.y + PARCEL * 10,
  }).filter((parcel) => !isWater(parcel.biome));

  let opposite: [CellId, CellId] | null = null;
  for (const parcel of banks) {
    for (const other of parcel.neighbors) {
      const across = banks.find((p) => p.id === other);
      if (!across || !waterBetween(world.seed, parcel.site, across.site)) continue;
      opposite = [parcel.id, across.id];
      break;
    }
    if (opposite) break;
  }

  const acrossWater = opposite ? route(world, opposite[0], opposite[1]) : null;
  const wades = (walk: readonly string[]): boolean =>
    walk.some((id, i) => i > 0 && waterBetween(world.seed, positionOf(world, walk[i - 1]!), positionOf(world, id)));
  const roundAbout =
    opposite !== null &&
    (acrossWater === null ||
      (!wades(acrossWater) &&
        acrossWater.length > 2 &&
        routeCost(world, acrossWater) >
          distance(parcelOf(world.seed, opposite[0]).site, parcelOf(world.seed, opposite[1]).site)));

  const everyStepDry = worn.every((id) =>
    neighbours(world, id).every((next) => !waterBetween(world.seed, positionOf(world, id), positionOf(world, next))),
  );
  const noneWade = again !== null && !wades(again);

  log(`  two banks a step apart: ${opposite ? `${opposite[0]} to ${opposite[1]}` : 'none near the town'} — ${acrossWater ? `${acrossWater.length} nodes round` : 'no way round'}`);
  log(`  ${worn.length} nodes stepped on, ${showing.length} worn enough to show; the most-worn ${steps} steps`);
  log(`  hearth to the furthest dig (${fresh?.length ?? 0} nodes): ${freshCost.toFixed(1)} on fresh ground, ${wornCost.toFixed(1)} once worn; the walk to the busiest place ${(onPaths * 100).toFixed(0)}% on worn ground`);

  const checks: [string, boolean][] = [
    ['walking wears the ground', worn.length > 0],
    ['enough of it is worn to show as paths', showing.length >= 8 && showing.length >= worn.length * 0.85],
    ['a worn way is cheaper to walk than fresh ground', wornCost < freshCost],
    ['later walks keep to the worn ground', onPaths > 0.5],
    ['a worn path is walked faster', quicker > unworn],
    ['left alone, the paths grow back', grownBack],
    ['a step never crosses water', everyStepDry],
    ['the walks taken never cross water', noneWade],
    ['two banks a step apart are walked round, or not at all', roundAbout],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-11',
    title: 'Footpaths',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `${showing.length} nodes worn into paths; the walk out ${freshCost.toFixed(0)} → ${wornCost.toFixed(0)}`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}
