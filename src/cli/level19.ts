import { depositHopper, storedStock } from '../sim/buildings.ts';
import {
  CHARGE_HIGH,
  CHARGE_LOW,
  CORD_METHOD,
  SEAL_METHOD,
  cloneMethod,
  methodById,
} from '../sim/book.ts';
import type { Book, Method, MethodId } from '../sim/book.ts';
import { AMBIENT } from '../sim/models/heat.ts';
import { batchTicks, ceilingOf, heatOf, heldFor, runRig, scanQueue } from '../sim/process.ts';
import { claimOf } from '../sim/claims.ts';
import { landYield } from '../sim/markers.ts';
import { parcelOf } from '../sim/parcels.ts';
import { Biome, ItemType } from '../sim/types.ts';
import type { Building } from '../sim/types.ts';
import { header } from './render.ts';
import { harness } from './levels.ts';
import type { LevelResult, Logger } from './levels.ts';

/**
 * LEVEL 19 — Age II: the first mixes, and the chain that ends in a basket that holds water.
 *
 * Nothing in the age is made in one step, and that is the point of it. Reeds are combed into
 * fibre, fibre is walked into cord, cord binds withies into a basket, mud and fibre are trodden
 * into daub — and only where those two last meet is there anything to carry water in. Level 16
 * asserts what that vessel is worth in hours; this asserts that the town can get one at all.
 *
 * The other half is the third process. Cord walking, weaving and kneading are cold work, so a
 * `hand` rig has no fuel, no chamber and no changeover: its batch takes the time the book says
 * and the charge knob — which is how hard a *fire* is driven — says nothing about it. Written
 * as `fire` it would have been quietly divided by a burn rate and asked for an envelope it does
 * not have.
 */
export function runLevel19(log: Logger): LevelResult {
  log(header('LEVEL 19 — Age II: fibre, cord, a woven basket, and the daub that seals it'));

  const run = harness();
  const book = run.settlement.book;
  const hearth = run.settlement.buildings.get(run.settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');
  const fire = hearth.rig;
  if (!fire) throw new Error('the hearth was founded without its fire');

  // Cleared by hand: what this level is about is the chain, not the spadework, and the levels
  // that watch a villager fell a site are 10 and 16.
  for (const works of [run.reedBed, run.cordWalk, run.weavingFrame, run.daubPit]) works.clearing = null;

  // The ground gives the fibre and nothing else does, and it is the marsh that gives it — the
  // one biome in the table that is standing fresh water over land. Hung on the bank test
  // instead, a bank would hand back four things, which is a menu and not a decision.
  const ground = claimOf(run.world, run.settlement).map((id) => ({
    biome: parcelOf(run.world.seed, id).biome,
    yields: landYield(run.world, id),
  }));
  const marshes = ground.filter((parcel) => parcel.biome === Biome.Marsh);
  const onlyMarsh = ground.every(
    (parcel) => !parcel.yields.includes(ItemType.Fibre) || parcel.biome === Biome.Marsh,
  );
  const everyMarsh = marshes.length > 0 && marshes.every((p) => p.yields.includes(ItemType.Fibre));
  const dryBank = ground.filter(
    (parcel) => parcel.biome !== Biome.Marsh && parcel.yields.includes(ItemType.Water),
  );
  const bankUnchanged =
    dryBank.length > 0 &&
    dryBank.every(
      (p) =>
        p.yields.includes(ItemType.Mud) &&
        p.yields.includes(ItemType.Clay) &&
        !p.yields.includes(ItemType.Fibre),
    );
  log(`  of ${ground.length} parcels in the claim ${marshes.length} are marsh, and the reed bed stands on ${run.reedBed.yields.join(', ')}`);

  // Three fibre walked into one cord.
  const cord = batchOn(run.cordWalk, book, [[ItemType.Fibre, 3]]);
  log(`  the cord walk took ${cord.took} and gave ${cord.made} × ${cord.item} in ${cord.ticks} ticks`);

  // The cord and two withies woven into a basket.
  const basket = batchOn(run.weavingFrame, book, [
    [ItemType.Wood, 2],
    [ItemType.Cord, 1],
  ]);
  log(`  the weaving frame took ${basket.took} and gave ${basket.made} × ${basket.item}`);

  // Mud with chopped fibre through it, trodden beside the rest of it.
  const daub = batchOn(run.daubPit, book, [
    [ItemType.Mud, 2],
    [ItemType.Fibre, 1],
  ]);
  log(`  the daub pit took ${daub.took} and gave ${daub.made} × ${daub.item}`);

  const chainRuns =
    cord.item === ItemType.Cord &&
    basket.item === ItemType.Basket &&
    daub.item === ItemType.Daub &&
    cord.made > 0 &&
    basket.made > 0 &&
    daub.made >= 2;

  // And the fire refuses to seal anything until both halves are standing in it — in words, and
  // naming the one it is short of, which is the whole reason a refusal carries a reason.
  fire.queue = [SEAL_METHOD];
  const dry = refusal(fire, book, hearth);
  depositHopper(hearth, ItemType.Basket, 1);
  const halfWay = refusal(fire, book, hearth);
  depositHopper(hearth, ItemType.Daub, 2);
  const ready = scanQueue(fire, book, hearth).method?.id === SEAL_METHOD;
  log(`  the fire with nothing: ${dry?.why}; with the basket alone: ${halfWay?.why}`);

  const before = storedStock(hearth, ItemType.Vessel);
  for (let tick = 1; tick <= 600 && storedStock(hearth, ItemType.Vessel) === before; tick += 1) {
    runRig(hearth, book, true);
  }
  const sealed = storedStock(hearth, ItemType.Vessel) - before;
  log(`  with both: the fire sealed ${sealed} × Vessel out of ${basket.item} and ${daub.item}`);

  const refusesWithoutBoth =
    dry?.kind === 'inputs' &&
    dry.why.includes(ItemType.Basket) &&
    halfWay?.kind === 'inputs' &&
    halfWay.why.includes(ItemType.Daub) &&
    ready &&
    sealed > 0;

  // The knob is a fire's, and a cord walk has no fire. The same method banked low and driven
  // hard takes exactly as long on the hand rig and does not on the hearth.
  const walk = run.cordWalk.rig;
  if (!walk) throw new Error('the cord walk was raised without its frame');
  const twist = methodOf(book, CORD_METHOD);
  const seal = methodOf(book, SEAL_METHOD);
  const handLow = batchTicks(walk, charged(twist, CHARGE_LOW));
  const handHigh = batchTicks(walk, charged(twist, CHARGE_HIGH));
  const fireLow = batchTicks(fire, charged(seal, CHARGE_LOW));
  const fireHigh = batchTicks(fire, charged(seal, CHARGE_HIGH));
  log(`  banked and driven, the cord walk takes ${handLow} and ${handHigh} ticks; the fire ${fireLow} and ${fireHigh}`);
  const knobIsTheFires =
    handLow === twist.ticks && handHigh === twist.ticks && fireHigh < fireLow;

  // Nothing is fired on a hand rig, so it never asks `envelopeOf` for a chamber it has not got.
  const walkCeiling = ceilingOf(walk);
  const walkHeat = heatOf(walk, book).T;
  log(`  the cord walk tops out at ${walkCeiling} °C, which is the weather`);
  const noChamber = walkCeiling === AMBIENT && walkHeat === AMBIENT;

  // And no changeover: you put down one bundle and pick up another. A fire coming down and
  // going back up is a fire's cost, and the reason the heat age runs in campaigns.
  const pit = run.daubPit.rig;
  if (!pit) throw new Error('the daub pit was raised without its floor');
  pit.queue = [CORD_METHOD];
  depositHopper(run.daubPit, ItemType.Fibre, 3);
  runRig(run.daubPit, book, true);
  const switchedFree = pit.changeover === 0 && pit.running?.methodId === CORD_METHOD;
  log(`  the daub pit set to cord instead: ${pit.changeover} ticks of changeover`);

  const checks: [string, boolean][] = [
    ['fibre comes off the marsh, and off nothing else', onlyMarsh && everyMarsh],
    ['so a bank still hands back the three it always did, and no fourth', bankUnchanged],
    ['fibre is walked into cord, cord woven into a basket, and daub trodden beside it', chainRuns],
    ['the fire refuses to seal until both the basket and its daub are standing in it', refusesWithoutBoth],
    ['a hand rig takes the time the book says, banked or driven; a fire does not', knobIsTheFires],
    ['and it never asks for a chamber, because there is no fire in it', noChamber],
    ['nor pays a changeover: you put down one bundle and pick up another', switchedFree],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-19',
    title: 'Age II',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `${cord.made} cord in ${cord.ticks} ticks, ${basket.made} basket, ${daub.made} daub,` +
          ` and ${sealed} vessel sealed of the two; the cord walk is ${handLow} ticks at either banking`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

/** One batch on a rig, by hand: the inputs laid in, then ticked until something comes out. */
function batchOn(
  works: Building,
  book: Book,
  inputs: [ItemType, number][],
): { item: ItemType; made: number; ticks: number; took: string } {
  const rig = works.rig;
  if (!rig) throw new Error(`the ${works.design.label} was raised without its rig`);
  for (const [item, amount] of inputs) stock(works, item, amount);

  for (let tick = 1; tick <= 400; tick += 1) {
    const produced = runRig(works, book, true).produced[0];
    if (produced) {
      return {
        item: produced.item,
        made: produced.amount,
        ticks: tick,
        took: inputs.map(([item, amount]) => `${amount} × ${item}`).join(' and '),
      };
    }
  }
  throw new Error(`the ${works.design.label} ran for four hundred ticks and gave nothing`);
}

/** Lay goods where the rig will find them — its doors first, which is where a carrier leaves them. */
function stock(works: Building, item: ItemType, amount: number): void {
  while (heldFor(works, item) < amount) {
    if (depositHopper(works, item, 1) === 0) {
      throw new Error(`nowhere in the ${works.design.label} for ${item}`);
    }
  }
}

function refusal(rig: NonNullable<Building['rig']>, book: Book, building: Building) {
  return scanQueue(rig, book, building).refused.find((entry) => entry.methodId === SEAL_METHOD);
}

function methodOf(book: Book, id: MethodId): Method {
  const method = methodById(book, id);
  if (!method) throw new Error(`the book has no ${id}`);
  return method;
}

/** The same method at another banking, which is the one knob a fire has. */
function charged(method: Method, charge: number): Method {
  return { ...cloneMethod(method), run: { ...method.run, charge } };
}
