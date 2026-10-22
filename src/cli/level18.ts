import {
  CHARGE_HIGH,
  CHARGE_LOW,
  CHARGE_STEADY,
  EMBERS_METHOD,
  INSTRUMENTS,
  SWEEP_SETTINGS,
  TRIAL_SHARE,
  addInstrument,
  believed,
  bestResolution,
  earnedTechniques,
  isNamed,
  methodById,
  methodFor,
  nameTechniques,
  rateOf,
  recordTrial,
  startingBook,
  sweep,
} from '../sim/book.ts';
import type { Book, InstrumentId, Method, Trial } from '../sim/book.ts';
import { restoreWorld, saveWorld } from '../sim/save.ts';
import { header } from './render.ts';
import { harness } from './harness.ts';
import type { LevelResult, Logger } from './harness.ts';

export function runLevel18(log: Logger): LevelResult {
  const ember = methodById(startingBook(), EMBERS_METHOD);
  if (!ember) throw new Error('the book opened without its one method');
  const truth = rateOf(ember);
  log(header('LEVEL 18 — Trials, sweeps and the book: watched, never predicted'));
  log(`  the fire really gives ${truth} embers a hundred ticks, which nobody in the town can see`);

  const ignorant = believed(startingBook(), ember);
  log(`  with no trials at all the book says: known ${ignorant.known}, estimate ${ignorant.estimate}`);
  const saysItDoesNotKnow = !ignorant.known && ignorant.estimate === null && ignorant.runs === 0;

  const counts = [1, 4, 16, 64, 1000];
  const closing = counts.map((runs) => watch('cone', runs, ember));
  for (const [index, seen] of closing.entries()) {
    log(
      `  after ${counts[index]} trials with a cone: ${seen.estimate} ± ${seen.spread}` +
        ` (${seen.lo} to ${seen.hi})`,
    );
  }
  const narrows = closing.every((seen, i) => i === 0 || seen.spread < (closing[i - 1]?.spread ?? 0));
  const holdsTheTruth = closing.every(
    (seen) => truth >= (seen.lo ?? Infinity) && truth <= (seen.hi ?? -Infinity),
  );
  const first = closing[0];
  const last = closing[closing.length - 1];
  const closesOnIt =
    first !== undefined &&
    last !== undefined &&
    Math.abs((last.estimate ?? 0) - truth) < Math.abs((first.estimate ?? 0) - truth);

  const floors = (['eye', 'test-ring', 'cone'] as const).map((id) => ({
    id,
    seen: watch(id, 1000, ember),
  }));
  for (const { id, seen } of floors) {
    log(`  a thousand trials read by ${INSTRUMENTS[id].label}: ± ${seen.spread}`);
  }
  const [eye, ring, cone] = floors.map(({ seen }) => seen.spread);
  const eyeStopsAtAFifth =
    eye !== undefined &&
    eye > 0.18 &&
    eye < 0.26 &&
    watch('eye', 64, ember).spread === eye;
  const eachInstrumentTighter =
    eye !== undefined && ring !== undefined && cone !== undefined && eye > ring && ring > cone;

  const bench = startingBook();
  const settings = [CHARGE_LOW, CHARGE_STEADY, CHARGE_HIGH];
  const trials = sweep(bench, EMBERS_METHOD, 'charge', settings);
  const batch = ember.inputs[0];
  const small = trials[0]?.inputs[0];
  log(
    `  a sweep of the charge is ${trials.length} trials, ${small?.amount} × ${small?.item} each` +
      ` against a batch's ${batch?.amount}, ${trials[0]?.ticks} ticks against ${ember.ticks}`,
  );
  const oneParameter = trials.every((trial) => trial.param === 'charge');
  const onePerValue =
    trials.length === settings.length &&
    trials.every((trial, index) => trial.value === settings[index]);
  const costsAFifth =
    small !== undefined &&
    batch !== undefined &&
    small.amount <= Math.max(1, Math.round(batch.amount * TRIAL_SHARE)) &&
    (trials[0]?.ticks ?? 0) < ember.ticks;

  for (const trial of trials) recordTrial(bench, trial, outcomeOf(bench, trial));
  const rowPerValue =
    bench.rows.length === settings.length &&
    bench.rows.every((row, index) => row.value === settings[index] && row.param === 'charge');

  const named = nameTechniques(bench);
  const technique = named[0];
  log(`  the sweep named: ${technique?.label ?? 'nothing'} (read ${technique?.resolution})`);
  const sweepNamesIt =
    named.length === 1 &&
    technique !== undefined &&
    technique.param === 'charge' &&
    technique.value === CHARGE_HIGH &&
    isNamed(bench, technique.id);
  for (const trial of sweep(bench, EMBERS_METHOD, 'charge', settings)) {
    recordTrial(bench, trial, outcomeOf(bench, trial));
  }
  const namedOnce = nameTechniques(bench).length === 0 && bench.named.length === 1;

  const stubborn = startingBook();
  for (let i = 0; i < 50; i += 1) {
    const one = sweep(stubborn, EMBERS_METHOD, 'charge', [CHARGE_HIGH])[0];
    if (one) recordTrial(stubborn, one, outcomeOf(stubborn, one));
  }
  const flat = startingBook();
  for (let pass = 0; pass < 10; pass += 1) {
    for (const trial of sweep(flat, EMBERS_METHOD, 'damper', [0.2, 0.5, 0.9])) {
      recordTrial(flat, trial, outcomeOf(flat, trial));
    }
  }
  log(
    `  ${stubborn.rows.length} trials at one setting named ${earnedTechniques(stubborn).length};` +
      ` ${flat.rows.length} over a knob that does nothing named ${earnedTechniques(flat).length}`,
  );
  const oneSettingNamesNothing =
    stubborn.rows.length > SWEEP_SETTINGS * 10 && earnedTechniques(stubborn).length === 0;
  const aFlatKnobNamesNothing = flat.rows.length > 10 && earnedTechniques(flat).length === 0;

  const run = harness();
  const book = run.settlement.book;
  addInstrument(book, 'test-ring');
  for (const trial of sweep(book, EMBERS_METHOD, 'charge', settings)) {
    recordTrial(book, trial, outcomeOf(book, trial));
  }
  nameTechniques(book);

  const written = JSON.parse(JSON.stringify(saveWorld(run.world, run.engine.tickCount))) as unknown;
  const read = restoreWorld(written, run.world.seed);
  const back = read?.world.settlements.get(run.settlement.id)?.book;
  log(
    `  saved ${book.rows.length} rows, ${book.instruments.length} instruments and` +
      ` ${book.named.length} names; read back ${back?.rows.length}, ${back?.instruments.length},` +
      ` ${back?.named.length}`,
  );
  const sameBook =
    back !== undefined &&
    JSON.stringify(back.rows) === JSON.stringify(book.rows) &&
    JSON.stringify(back.instruments) === JSON.stringify(book.instruments) &&
    JSON.stringify(back.named) === JSON.stringify(book.named) &&
    bestResolution(back) === bestResolution(book) &&
    JSON.stringify(believed(back, ember)) === JSON.stringify(believed(book, ember));

  const checks: [string, boolean][] = [
    ['with nothing run the book says it does not know, rather than zero', saysItDoesNotKnow],
    ['every trial narrows the band', narrows],
    ['which never stops holding the truth', holdsTheTruth],
    ['and closes on it', closesOnIt],
    ['by eye the band stops at about a fifth, however long anyone watches', eyeStopsAtAFifth],
    ['a test ring is tighter, and a cone tighter again', eachInstrumentTighter],
    ['a sweep moves one parameter', oneParameter && onePerValue],
    ['at a fifth of a batch each', costsAFifth],
    ['and writes one row per value', rowPerValue],
    ['three settings told apart names the technique', sweepNamesIt],
    ['and name it once: the second sweep says nothing new', namedOnce],
    ['fifty trials at one setting name nothing', oneSettingNamesNothing],
    ['nor does any number of them over a knob that changes nothing', aFlatKnobNamesNothing],
    ['the rows, the instruments and the names come back off the save', sameBook],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-18',
    title: 'The book',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `the fire gives ${truth}; by eye ± ${eye}, by ring ± ${ring}, by cone ± ${cone};` +
          ` a sweep of ${trials.length} named "${technique?.label}"`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

function watch(instrument: InstrumentId, runs: number, method: Method) {
  const book = startingBook();
  addInstrument(book, instrument);
  const trial = sweep(book, method.id, 'charge', [method.run.charge])[0];
  if (!trial) throw new Error(`the book has no ${method.id}`);
  for (let i = 0; i < runs; i += 1) recordTrial(book, trial, outcomeOf(book, trial));
  return believed(book, method);
}

function outcomeOf(book: Book, trial: Trial): number {
  const method = methodFor(book, trial);
  return method ? rateOf(method) : 0;
}
