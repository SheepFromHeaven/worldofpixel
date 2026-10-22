import { BUILDING_REACH, HEARTH_REACH, STONE_SPACING, claimOf, claims } from '../sim/claims.ts';
import { canBuild, placeBuilding, raze } from '../sim/construction.ts';
import { LEAN_TO_ID } from '../sim/designs.ts';
import { distance } from '../sim/geometry.ts';
import { PARCEL, parcelOf } from '../sim/parcels.ts';
import { canFound, foundSettlement } from '../sim/worldgen.ts';

import type { LevelResult, Logger } from './harness.ts';
import { designFrom, freeParcelsNear, harness } from './harness.ts';
import { header } from './render.ts';

export function runLevel9(log: Logger): LevelResult {
  log(header('LEVEL 9 — Claim: every building holds the ground round it, and stones mark the edge'));
  const run = harness();
  const { world, settlement } = run;
  const hearth = settlement.buildings.get(settlement.hearthId)!;
  const centre = parcelOf(world.seed, hearth.cellId).site;
  const mixer = designFrom(world, LEAN_TO_ID);

  const before = claimOf(world, settlement);
  const held = new Set(before);

  const edge = freeParcelsNear(world, centre, HEARTH_REACH * PARCEL * 1.6)
    .filter((id) => held.has(id) && canBuild(world, settlement, id, mixer).ok)
    .sort((a, b) => distance(parcelOf(world.seed, b).site, centre) - distance(parcelOf(world.seed, a).site, centre))[0];
  const outpost = edge ? placeBuilding(world, settlement, edge, mixer) : undefined;
  const grown = claimOf(world, settlement);
  const gained = grown.filter((id) => !held.has(id));
  const beyond = freeParcelsNear(world, centre, HEARTH_REACH * PARCEL * 3).find((id) => !new Set(grown).has(id));
  const outside = beyond ? canBuild(world, settlement, beyond, mixer) : undefined;

  if (outpost) raze(settlement, outpost.id);
  const shrunk = claimOf(world, settlement);
  if (edge) placeBuilding(world, settlement, edge, mixer);

  const stones = claims(world).stones.get(settlement.id) ?? [];
  const gaps = stones.slice(1).map((stone, i) => distance(stone, stones[i]!));
  const steady = gaps.filter((gap) => gap >= STONE_SPACING * 0.6 && gap <= STONE_SPACING * 1.05).length;

  const sites = freeParcelsNear(world, centre, HEARTH_REACH * PARCEL * 5).map((id) => parcelOf(world.seed, id));
  const crowding = sites.filter((p) => new Set(claimOf(world, settlement)).has(p.id) || distance(p.site, centre) <= HEARTH_REACH * PARCEL * 1.5);
  const crowdingRefused = crowding.length > 0 && crowding.every((p) => !canFound(world, p.id).ok);
  const clear = sites.find((p) => canFound(world, p.id).ok);
  const neighbour = clear ? foundSettlement(world, clear.id) : undefined;
  let nearestWins = true;
  if (neighbour) {
    const all = [...world.settlements.values()].flatMap((town) =>
      [...town.buildings.values()].map((b) => ({
        town: town.id,
        site: parcelOf(world.seed, b.cellId).site,
        reach: (b.id === town.hearthId ? HEARTH_REACH : BUILDING_REACH) * PARCEL,
      })),
    );
    for (const town of [settlement, neighbour]) {
      for (const id of claimOf(world, town)) {
        const site = parcelOf(world.seed, id).site;
        const reaching = all.filter((b) => distance(b.site, site) <= b.reach);
        const nearest = reaching.reduce((a, b) => (distance(b.site, site) < distance(a.site, site) ? b : a));
        if (nearest.town !== town.id) nearestWins = false;
      }
    }
  }
  const mine = new Set(claimOf(world, settlement));
  const shared = neighbour ? claimOf(world, neighbour).filter((id) => mine.has(id)).length : -1;

  log(`  claim ${before.length} parcels, ${grown.length} with a building at its edge (+${gained.length}), ${shrunk.length} once razed`);
  log(`  ${stones.length} stones, ${steady} of ${gaps.length} steps at the spacing; outside: ${outside?.reason}`);

  const checks: [string, boolean][] = [
    ['the hearth and every building stand in the claim', [...settlement.buildings.values()].every((b) => held.has(b.cellId) || b.cellId === edge)],
    ['a building at the edge pushes the edge out', outpost !== undefined && gained.length > 0],
    ['razing it gives the ground back exactly', shrunk.join() === before.join()],
    ['outside the claim nothing goes up, for the claim', outside?.ok === false && outside.reason.includes('claim')],
    ['the stones stand at a steady pace', gaps.length > 10 && steady / gaps.length > 0.8],
    ['a hearth may not be set where it would cut into a claim', crowdingRefused],
    ['beyond that, a neighbour may be founded', neighbour !== undefined],
    ['where two towns meet, ground goes to the nearer building', nearestWins],
    ['two claims never share a parcel', shared === 0],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-9',
    title: 'Claim',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `${before.length} parcels held, +${gained.length} for a building at the edge, ${stones.length} stones`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}
