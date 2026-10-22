import { CHIMNEY, STAGES, growTo, orderStage, slotFor, stations, stageOf } from '../sim/area.ts';
import { createBuilding, depositHopper } from '../sim/buildings.ts';
import { runRig } from '../sim/process.ts';
import { claimOf } from '../sim/claims.ts';
import { buildingOnParcel, canBuild, placeBuilding } from '../sim/construction.ts';
import { CORD_WALK, WEAVING_FRAME } from '../sim/designs.ts';
import { parcelOf } from '../sim/parcels.ts';
import { Biome, ItemType } from '../sim/types.ts';
import type { Building } from '../sim/types.ts';
import { header } from './render.ts';
import { harness, play, workOf } from './levels.ts';
import type { LevelResult, Logger } from './levels.ts';

/**
 * LEVEL 20 — work areas: a parcel with a few slots, one shelf, one door and one list.
 *
 * What is asserted is the four things that make an area an area and not a bigger building. The
 * stage ladder gives the slot counts it says, and the stone works spends one on its chimney. A
 * slot refuses what the ground does not allow. A stage is built round an area by hand, out of its
 * own goods. And stations standing together hand on for nothing, where the same two apart need a
 * carrier between them — while two of the same station run side by side, each off its own line.
 */
export function runLevel20(log: Logger): LevelResult {
  log(header('LEVEL 20 — Work areas: slots, the ground, the stage ladder, and the walk that is free'));

  // The ladder, on a bare area: two, three, four, five, six, and the last one's chimney.
  const bare = createBuilding('lab/area', 'lab', { x: 0, y: 0 }, [ItemType.Dirt]);
  const counts: number[] = [bare.slots.length];
  for (let stage = 1; stage < STAGES.length; stage += 1) {
    growTo(bare, stage);
    counts.push(bare.slots.length);
  }
  const chimneyTaken = bare.slots[bare.slots.length - 1]?.design?.id === CHIMNEY.id;
  log(`  slots by stage: ${counts.join(', ')}; the stone works' last slot is its chimney: ${chimneyTaken}`);
  const ladder = counts.join(',') === '2,3,4,5,6' && chimneyTaken && bare.slots[0]?.kind === 'ground';
  const sunRefused = !slotFor(bare, { ...WEAVING_FRAME, id: 'sun-dryer', needsSun: true }, Biome.Meadow).ok;

  const run = harness();
  const { world, settlement } = run;
  for (const area of settlement.buildings.values()) area.clearing = null;

  // A fresh parcel of growing ground in the claim, opened by a fibre patch.
  const site = claimOf(world, settlement).find(
    (id) => !buildingOnParcel(settlement, id) && canBuild(world, settlement, id, workOf('fibre-patch')).ok,
  );
  if (!site) throw new Error('no growing ground left in the claim for a fibre patch');
  const yard = placeBuilding(world, settlement, site, workOf('fibre-patch'));
  yard.clearing = null;
  const biome = parcelOf(world.seed, site).biome;

  // The ground slot is taken, so a second land work is refused; a reed bed would want marsh
  // anyway; and a clearing has one work slot, so the second station has nowhere to stand.
  const groundTaken = !slotFor(yard, workOf('reed-bed'), Biome.Marsh).ok;
  const reedsRefused = !slotFor({ ...yard, slots: yard.slots.map((s, i) => (i === 0 ? { ...s, design: null } : s)) }, workOf('reed-bed'), biome).ok;
  const clearingHoldsOne = slotFor(yard, CORD_WALK, biome).ok && yard.slots.length === 2;

  // Built up to a yard by hand. A yard costs only labour, so the order goes straight to work.
  const ordered = orderStage(yard);
  const before = run.events.length;
  play(run, 1500, () => {});
  const raised = run.events.slice(before).some((event) => event.kind === 'raised' && event.buildingId === yard.id);
  log(`  a ${STAGES[0]!.name.toLowerCase()} ordered up to a ${stageOf(yard).name.toLowerCase()}: raised by hand ${raised}`);

  // The cord walk and the weaving frame stand in it together, beside the patch: fibre to cord to
  // basket without anybody carrying the cord across. Their twins stand apart in their own areas.
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

  // Two cord walks in one area: two lines of the same method, each bound to its own station, and
  // both batches running at once.
  const twinSite = claimOf(world, settlement).find(
    (id) => !buildingOnParcel(settlement, id) && canBuild(world, settlement, id, workOf('fibre-patch')).ok,
  );
  let sideBySide = false;
  if (twinSite) {
    const twins = placeBuilding(world, settlement, twinSite, workOf('fibre-patch'));
    twins.clearing = null;
    growTo(twins, 1);
    placeBuilding(world, settlement, twinSite, CORD_WALK);
    placeBuilding(world, settlement, twinSite, CORD_WALK);
    depositHopper(twins, ItemType.Fibre, 8);
    // Worked by hand, two villagers at once, so what is asserted is the area and not the rota.
    for (let tick = 0; tick < 60 && !sideBySide; tick += 1) {
      for (const station of stations(twins)) runRig(twins, station.slot, settlement.book, true);
      sideBySide = stations(twins).filter((station) => station.rig.running).length === 2;
    }
    const lines = twins.queue.filter((line) => line.methodId === twins.queue[0]?.methodId);
    sideBySide = sideBySide && lines.length === 2 && lines[0]!.slot !== lines[1]!.slot;
  }
  log(`  two cord walks in one area ran side by side: ${sideBySide}`);

  const checks: [string, boolean][] = [
    ['the stage ladder gives two, three, four, five and six slots, the first the ground\'s', ladder],
    ['a stone works spends its last slot on the chimney', chimneyTaken],
    ['a roof refuses anything that dries in the sun', sunRefused],
    ['the ground slot takes one land work, and only one the ground allows', groundTaken && reedsRefused],
    ['a clearing has room for one station beside its ground', clearingHoldsOne],
    ['a stage is ordered and built round the area by hand', ordered && raised && yard.stage === 1],
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
