import { capacityOf, rigAt, setLines, stationSlot } from '../sim/area.ts';
import type { Method } from '../sim/book.ts';
import {
  CHARGE_HIGH,
  CHARGE_LOW,
  CHARGE_STEADY,
  EMBERS_METHOD,
  SEAL_METHOD,
  addMethod,
  methodById,
} from '../sim/book.ts';
import { depositHopper, roomFor, storedStock, withdraw } from '../sim/buildings.ts';
import { batchTicks, ceilingOf, costOf, linesFor, runRig, scanQueue } from '../sim/process.ts';
import { restoreWorld, saveWorld } from '../sim/save.ts';
import { ItemType } from '../sim/types.ts';

import type { LevelResult, Logger } from './harness.ts';
import { harness } from './harness.ts';
import { header } from './render.ts';

export function runLevel15(log: Logger): LevelResult {
  log(header('LEVEL 15 — Rig, method, queue: one fire, an ordered list, first that can run'));

  const run = harness();
  const hearth = run.settlement.buildings.get(run.settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');
  const rig = rigAt(hearth);
  if (!rig) throw new Error('the hearth was founded without its fire');
  const book = run.settlement.book;

  const bornKnowing = linesFor(hearth, stationSlot(hearth)).join('>') === `${SEAL_METHOD}>${EMBERS_METHOD}`;
  log(`  the fire tops out at ${ceilingOf(rig)} °C`);

  const cold = scanQueue(rig, book, hearth, stationSlot(hearth));
  log(`  cold: ${cold.refused.map((r) => `${r.methodId} — ${r.why}`).join('; ') || 'nothing refused'}`);
  const refusesForWood = cold.method === null && cold.refused[0]?.kind === 'inputs';

  depositHopper(hearth, ItemType.Deadwood, 8);
  const banked = scanQueue(rig, book, hearth, stationSlot(hearth)).method;
  const ticksPerBatch = banked ? batchTicks(rig, banked) : 0;
  log(`  with 8 deadwood standing in it the fire takes "${banked?.label}", ${ticksPerBatch} ticks to the batch`);

  let firstEmber = 0;
  for (let tick = 1; tick <= 400 && firstEmber === 0; tick += 1) {
    if (runRig(hearth, stationSlot(hearth), book, true).produced.length > 0) firstEmber = tick;
  }
  const emberMade = firstEmber > 0 && storedStock(hearth, ItemType.Embers) > 0;
  log(`  the first embers came out on tick ${firstEmber}`);

  const method = methodById(book, EMBERS_METHOD);
  if (!method) throw new Error('the book lost its one method');
  const paces = [CHARGE_LOW, CHARGE_STEADY, CHARGE_HIGH].map((charge) =>
    batchTicks(rig, { ...method, run: { ...method.run, charge } }),
  );
  const piles = [CHARGE_LOW, CHARGE_STEADY, CHARGE_HIGH].map(
    (charge) => costOf(rig, { ...method, run: { ...method.run, charge } })[0]?.amount ?? 0,
  );
  log(`  banked ${paces[0]} ticks for ${piles[0]} deadwood · steady ${paces[1]}/${piles[1]} · roaring ${paces[2]}/${piles[2]}`);
  const knobBites = (paces[0] ?? 0) > (paces[1] ?? 0) && (paces[1] ?? 0) > (paces[2] ?? 0);
  const knobCosts = (piles[0] ?? 0) < (piles[1] ?? 0) && (piles[1] ?? 0) < (piles[2] ?? 0);

  const capacity = capacityOf(hearth);
  for (let tick = 1; tick <= 4000; tick += 1) {
    depositHopper(hearth, ItemType.Deadwood, roomFor(hearth, ItemType.Deadwood));
    runRig(hearth, stationSlot(hearth), book, true);
  }
  const embers = storedStock(hearth, ItemType.Embers);
  log(`  fed all it could take the fire stopped at ${embers} embers, the shelf holding ${capacity}`);
  const stoppedAtCapacity = embers === capacity;
  const stoppedBecauseFull =
    scanQueue(rig, book, hearth, stationSlot(hearth)).refused.find((r) => r.methodId === EMBERS_METHOD)?.kind === 'full';

  const scorch: Method = {
    id: 'scorch',
    label: 'Scorch sticks',
    process: 'fire',
    inputs: [{ item: ItemType.Dirt, amount: 1 }],
    outputs: [{ item: ItemType.Mud, amount: 1 }],
    run: { charge: CHARGE_HIGH, fuel: 'wood' },
    ticks: 10,
  };
  addMethod(book, scorch);
  setLines(hearth, stationSlot(hearth), [EMBERS_METHOD, scorch.id]);
  depositHopper(hearth, ItemType.Dirt, 4);
  const belowFull = scanQueue(rig, book, hearth, stationSlot(hearth));
  const fullFallsThrough =
    belowFull.method?.id === scorch.id && belowFull.refused[0]?.kind === 'full';
  log(`  with the embers full the queue takes "${belowFull.method?.label}" instead`);

  const lime: Method = { ...scorch, id: 'burn-lime', label: 'Burn lime', ticks: 40, needsHeat: 1100 };
  addMethod(book, lime);
  setLines(hearth, stationSlot(hearth), [lime.id, EMBERS_METHOD]);
  withdraw(hearth, ItemType.Embers, capacity);

  const scan = scanQueue(rig, book, hearth, stationSlot(hearth));
  const envelopeRefusal = scan.refused.find((r) => r.methodId === lime.id);
  log(`  the kiln method is refused: ${envelopeRefusal?.why}`);
  const refusesOutOfEnvelope = envelopeRefusal?.kind === 'envelope';
  const fellThrough = scan.method?.id === EMBERS_METHOD;

  setLines(hearth, stationSlot(hearth), [scorch.id, EMBERS_METHOD]);
  const topWins = scanQueue(rig, book, hearth, stationSlot(hearth)).method?.id === scorch.id;
  setLines(hearth, stationSlot(hearth), [EMBERS_METHOD, scorch.id]);
  const orderDecides = scanQueue(rig, book, hearth, stationSlot(hearth)).method?.id === EMBERS_METHOD;
  log(`  swapping the two entries over swaps which one the worker takes`);

  const saved = saveWorld(run.world, 100);
  const read = restoreWorld(JSON.parse(JSON.stringify(saved)), run.world.seed);
  const readHearth = read?.world.settlements.get(run.settlement.id)?.buildings.get(hearth.id);
  const readBook = read?.world.settlements.get(run.settlement.id)?.book;
  const bookKept = readBook?.methods.size === book.methods.size && readBook.methods.has(lime.id);
  const rigKept =
    readHearth !== undefined &&
    linesFor(readHearth, stationSlot(readHearth)).join('>') === linesFor(hearth, stationSlot(hearth)).join('>') &&
    rigAt(readHearth)?.spec === rig.spec;

  const checks: [string, boolean][] = [
    ['a town is founded knowing its first methods, on one rig', bornKnowing],
    ['a queue with nothing to work on refuses in plain words', refusesForWood],
    ['the fire banked with deadwood makes embers', emberMade],
    ['stoking harder shortens the batch', knobBites],
    ['and eats more of the woodpile for it', knobCosts],
    ['a rig stops when its output is full, and says so', stoppedAtCapacity && stoppedBecauseFull],
    ['and the entry below a full one runs', fullFallsThrough],
    ['a rig refuses a method it cannot get hot enough for', refusesOutOfEnvelope],
    ['and the queue falls through to the next entry', fellThrough],
    ['the scan is in declaration order', topWins && orderDecides],
    ['the book is saved with the town', bookKept],
    ['the rig is saved with the building', rigKept],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-15',
    title: 'Rig, method, queue',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `first embers on tick ${firstEmber}, stopped at ${capacity}, fell through a method out of envelope`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}
