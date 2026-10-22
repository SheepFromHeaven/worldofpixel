import { stationSlot } from '../sim/area.ts';
import { EMBERS_METHOD, SEAL_METHOD } from '../sim/book.ts';
import { chapterProgress, designOpen, nextSteps, openingItems, workOpen } from '../sim/chapter.ts';
import { claimOf, proposedClaim } from '../sim/claims.ts';
import { canBuild, placeBuilding, raze } from '../sim/construction.ts';
import { CORD_WALK, DAUB_PIT, HEARTH_DESIGN, HEARTH_DESIGN_ID, PIT_FIRING_ID } from '../sim/designs.ts';
import { parcelOf } from '../sim/parcels.ts';
import { linesFor } from '../sim/process.ts';
import type { Design } from '../sim/types.ts';
import { generateWorld } from '../sim/worldgen.ts';

import type { LevelResult, Logger } from './harness.ts';
import { SEED, foundBesideWater, freeParcelsNear, raiseTheTown, workOf } from './harness.ts';
import { header } from './render.ts';

export function runLevel6(log: Logger): LevelResult {
  log(header('LEVEL 6 — The chapter: a town opens with its fire, and earns the rest in order'));

  const world = generateWorld(SEED);
  const { settlement, water, reeds } = foundBesideWater(world);
  const hearth = settlement.buildings.get(settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');

  const opening = [...settlement.buildings.values()];
  const foundedWith =
    hearth.slots.length === 2 &&
    hearth.slots[0]?.design?.id === HEARTH_DESIGN_ID &&
    hearth.slots[1]?.design?.id === 'forage-camp' &&
    hearth.stage === 1;
  const openNow = (): string[] => nextSteps(settlement).map((step) => step.label);

  const unfounded = generateWorld(SEED);
  const promised = proposedClaim(unfounded, hearth.cellId);
  const promiseKept = promised.length > 0 && promised.join() === claimOf(world, settlement).join();
  const wantsTheOpening = openingItems().join() === 'Deadwood,Mud';
  log(`  a hearth here would hold ${promised.length} parcels; wanting first: ${openingItems().join(' and ')}`);
  log(`  founded on a fire alone; it may site ${openNow().join(' or ')}`);

  const opensOnAgeI = openNow().join(',') === 'Bank dig';
  const kilnRefused = !designOpen(settlement, PIT_FIRING_ID);
  const wellRefused = !workOpen(settlement, 'well');
  const refusal = canBuild(world, settlement, reeds, workOf('reed-bed'));

  const bornKnowing = linesFor(hearth, stationSlot(hearth)).join(',') === EMBERS_METHOD;

  const raised = raiseTheTown(world, settlement, water, reeds);
  const walked = settlement.buildings.size === opening.length + 7;

  const learntToSeal = linesFor(hearth, stationSlot(hearth)).includes(SEAL_METHOD);
  const wellOpenNow = workOpen(settlement, 'well');
  log(`  with the frame and the pit up it knows ${linesFor(hearth, stationSlot(hearth)).join(' > ')}`);

  const progress = chapterProgress(settlement);
  log(`  ${progress.done.size} steps done, in the age of ${progress.age}; next: ${openNow().join(', ') || 'nothing'}`);

  raze(settlement, raised.daubPit.id);
  const stepUndone = !chapterProgress(settlement).done.has(9);
  const stillKnowsIt = linesFor(hearth, stationSlot(hearth)).includes(SEAL_METHOD);

  const dryWorld = generateWorld(SEED);
  const dry = foundBesideWater(dryWorld);
  const dryPlots = freeParcelsNear(dryWorld, dry.settlement.buildings.get(dry.settlement.hearthId)!.position, 70);
  const firstOk = (design: Design) => dryPlots.find((id) => canBuild(dryWorld, dry.settlement, id, design).ok);
  const dryBank = firstOk(workOf('bank-dig'));
  if (dryBank) placeBuilding(dryWorld, dry.settlement, dryBank, workOf('bank-dig'));
  const patchSite = dryPlots.find(
    (id) =>
      canBuild(dryWorld, dry.settlement, id, workOf('fibre-patch')).ok &&
      !canBuild(dryWorld, dry.settlement, id, workOf('reed-bed')).ok,
  );
  const reedsOffMarsh = patchSite !== undefined;
  if (patchSite) placeBuilding(dryWorld, dry.settlement, patchSite, workOf('fibre-patch'));
  const patchOpensCord =
    designOpen(dry.settlement, CORD_WALK.id) && designOpen(dry.settlement, DAUB_PIT.id) && !chapterProgress(dry.settlement).done.has(6.5);
  log(`  without a reed bed: a fibre patch on ${patchSite ? parcelOf(dryWorld.seed, patchSite).biome : 'nothing'} opens the cord walk: ${patchOpensCord}`);

  const hearthRefused = canBuild(world, settlement, water, HEARTH_DESIGN);
  const hearthStays = !raze(settlement, hearth.id);

  const checks: [string, boolean][] = [
    ['a new settlement is one work area with a fireplace and a forage camp in it', opening.length === 1 && foundedWith],
    ['a reed bed wants marsh, and a fibre patch takes growing ground elsewhere', reedsOffMarsh],
    ['and a fibre patch alone opens the cord walk and the daub pit', patchOpensCord],
    ['and it opens on Age I alone', opensOnAgeI],
    ['founding holds the ground the overlay showed', promiseKept],
    ['and the overlay puts forward what the opening wants', wantsTheOpening],
    ['a kiln is not on the bar before there is a reason to want one', kilnRefused],
    ['nor a well, which is step eleven', wellRefused],
    ['something out of reach is refused in the town’s own name', !refusal.ok && refusal.reason.includes('worked out')],
    ['the fire is founded knowing one method, not the book', bornKnowing],
    ['the chapter can be walked end to end', walked],
    ['a method step is written up the moment it is earned', learntToSeal],
    ['and earning it opens what follows', wellOpenNow],
    ['razing a rig takes its step back', stepUndone],
    ['but never the method: the book is what the town found out', stillKnowsIt],
    ['the hearth is not the player’s to place or to raze', !hearthRefused.ok && hearthStays],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-6',
    title: 'The chapter',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `opened on a fire, walked ${progress.done.size} steps into the age of ${progress.age}`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}
