import { CHIMNEY, STAGES, groundSlot, growTo, orderStage, readyToRaise, slotFor, stageOf, stations } from '../sim/area.ts';
import { createBuilding, depositHopper } from '../sim/buildings.ts';
import { runRig } from '../sim/process.ts';
import { claimOf } from '../sim/claims.ts';
import { buildingOnParcel, canBuild, placeBuilding } from '../sim/construction.ts';
import { CORD_WALK, WEAVING_FRAME } from '../sim/designs.ts';
import { parcelOf } from '../sim/terrain/parcels.ts';
import { Biome, ItemType } from '../sim/types.ts';
import type { Building } from '../sim/types.ts';
import { header } from './render.ts';
import { harness, play, workOf } from './harness.ts';
import type { LevelResult, Logger } from './harness.ts';

export function runLevel20(log: Logger): LevelResult {
  log(header('LEVEL 20 — Work areas: slots, the ground, the stage ladder, and the walk that is free'));

  const bare = createBuilding('lab/area', 'lab', { x: 0, y: 0 }, [ItemType.Dirt]);
  const counts: number[] = [bare.slots.length];
  for (let stage = 1; stage < STAGES.length; stage += 1) {
    growTo(bare, stage);
    counts.push(bare.slots.length);
  }
  const chimneyTaken = bare.slots[bare.slots.length - 1]?.design?.id === CHIMNEY.id;
  log(`  slots by stage: ${counts.join(', ')}; the stone works' last slot is its chimney: ${chimneyTaken}`);
  const ladder = counts.join(',') === '1,2,3,4,5' && chimneyTaken;
  const sunRefused = !slotFor(bare, { ...WEAVING_FRAME, id: 'sun-dryer', needsSun: true }, Biome.Meadow).ok;

  const run = harness();
  const { world, settlement } = run;
  for (const area of settlement.buildings.values()) area.clearing = null;

  const wallSite = run.cordWalk;
  const wallOrdered = orderStage(wallSite);
  const beforeWall = run.events.length;
  play(run, 6000, () => {});
  const wallEvents = run.events.slice(beforeWall);
  const stonesFound = wallEvents.filter((event) => event.kind === 'produced' && event.item === ItemType.Stone).length;
  const stonesCarried = wallEvents.filter((event) => event.kind === 'pickup' && event.item === ItemType.Stone).length;
  const wallBuilt = wallEvents.some((event) => event.kind === 'raised' && event.buildingId === wallSite.id);
  log(`  the forager turned up ${stonesFound} stones, ${stonesCarried} carried out; the wall round the cord walk: ${wallBuilt}`);

  const site = claimOf(world, settlement).find(
    (id) => !buildingOnParcel(settlement, id) && canBuild(world, settlement, id, workOf('fibre-patch')).ok,
  );
  if (!site) throw new Error('no growing ground left in the claim for a fibre patch');
  const yard = placeBuilding(world, settlement, site, workOf('fibre-patch'));
  yard.clearing = null;
  const biome = parcelOf(world.seed, site).biome;

  const clearingHoldsOne = yard.slots.length === 1 && !slotFor(yard, CORD_WALK, biome).ok;

  const refusedBare = orderStage(yard) && !readyToRaise(yard);
  depositHopper(yard, ItemType.Stone, 3);
  const before = run.events.length;
  play(run, 1500, () => {});
  const walled = run.events.slice(before).some((event) => event.kind === 'raised' && event.buildingId === yard.id);
  log(`  a ${STAGES[0]!.name.toLowerCase()} walled with three stones: ${walled}, now ${yard.slots.length} slots`);

  const groundTaken = !slotFor(yard, workOf('bank-dig'), Biome.Meadow).ok;
  const reedsRefused = !slotFor(
    { ...yard, slots: yard.slots.map((slot, index) => (index === groundSlot(yard) ? { ...slot, design: null } : slot)) },
    workOf('reed-bed'),
    biome,
  ).ok;

  const campBeside = slotFor(yard, workOf('forage-camp'), biome).ok;

  depositHopper(yard, ItemType.Cord, 2);
  depositHopper(yard, ItemType.Daub, 2);
  const ordered = orderStage(yard);
  const beforeWalled = run.events.length;
  play(run, 2000, () => {});
  const raised = run.events.slice(beforeWalled).some((event) => event.kind === 'raised' && event.buildingId === yard.id);
  log(`  ordered up to a ${stageOf(yard).name.toLowerCase()}: raised by hand ${raised}, now ${yard.slots.length} slots`);

  placeBuilding(world, settlement, site, CORD_WALK);
  placeBuilding(world, settlement, site, WEAVING_FRAME);
  const full = !canBuild(world, settlement, site, CORD_WALK).ok;
  depositHopper(yard, ItemType.Fibre, 6);
  const watchedFrom = run.events.length;
  play(run, 4000, () => {});
  const watched = run.events.slice(watchedFrom);
  const madeHere = (item: string) =>
    watched.filter((event) => event.kind === 'produced' && event.buildingId === yard.id && event.item === item).length;
  const carriedOut = (area: Building, item: string) =>
    watched.filter((event) => event.kind === 'pickup' && event.buildingId === area.id && event.item === item).length;
  const cordHere = madeHere(ItemType.Cord);
  const basketsHere = madeHere(ItemType.Basket);
  const cordHauledHere = carriedOut(yard, ItemType.Cord);
  const cordHauledApart = carriedOut(run.cordWalk, ItemType.Cord);
  log(`  together: ${cordHere} cord made, ${basketsHere} baskets woven, cord carried out ${cordHauledHere} times`);
  log(`  apart: the town's own cord walk had its cord carried off ${cordHauledApart} times`);
  const freeInside = cordHere > 0 && basketsHere > 0 && cordHauledHere === 0;
  const hauledBetween = cordHauledApart > 0;

  const twinSite = claimOf(world, settlement).find(
    (id) => !buildingOnParcel(settlement, id) && canBuild(world, settlement, id, workOf('fibre-patch')).ok,
  );
  let sideBySide = false;
  if (twinSite) {
    const twins = placeBuilding(world, settlement, twinSite, workOf('fibre-patch'));
    twins.clearing = null;
    growTo(twins, 2);
    placeBuilding(world, settlement, twinSite, CORD_WALK);
    placeBuilding(world, settlement, twinSite, CORD_WALK);
    depositHopper(twins, ItemType.Fibre, 8);
    for (let tick = 0; tick < 60 && !sideBySide; tick += 1) {
      for (const station of stations(twins)) runRig(twins, station.slot, settlement.book, true);
      sideBySide = stations(twins).filter((station) => station.rig.running).length === 2;
    }
    const lines = twins.queue.filter((line) => line.methodId === twins.queue[0]?.methodId);
    sideBySide = sideBySide && lines.length === 2 && lines[0]!.slot !== lines[1]!.slot;
  }
  log(`  two cord walks in one area ran side by side: ${sideBySide}`);

  const checks: [string, boolean][] = [
    ['the stage ladder gives one, two, three, four and five slots', ladder],
    ['a stone works spends its last slot on the chimney', chimneyTaken],
    ['a roof refuses anything that dries in the sun', sunRefused],
    ['the ground slot takes one land work, and only one the ground allows', groundTaken && reedsRefused],
    ['the forager turns up the stones, and they are carried to a wall that was ordered', wallOrdered && stonesFound > 0 && stonesCarried > 0 && wallBuilt],
    ['a clearing has one slot, and a second thing has nowhere to stand in it', clearingHoldsOne],
    ['a wall is ordered, waits for its stones, and is then built by hand into a second slot', refusedBare && walled],
    ['a stage is ordered and built round the area by hand', ordered && raised && yard.stage === 2],
    ['a forage camp stands beside the work that opens the ground', campBeside],
    ['and a full area takes nothing more', full],
    ['stations standing together hand on for nothing', freeInside],
    ['the same two apart need a carrier between them', hauledBetween],
    ['two of a station run side by side, each off its own line', sideBySide],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-20',
    title: 'Work areas',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `slots ${counts.join('/')}; together ${cordHere} cord and ${basketsHere} baskets with the cord never carried`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}
