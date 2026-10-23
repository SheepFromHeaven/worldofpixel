import { stationAt, setLines, stationSlot } from '../sim/area.ts';
import type { Book } from '../sim/book.ts';
import { CORD_RECIPE, SEAL_RECIPE, recipeById } from '../sim/book.ts';
import { depositHopper, labelOf, storedStock } from '../sim/buildings.ts';
import { claimOf } from '../sim/claims.ts';
import { landYield } from '../sim/markers.ts';
import { AMBIENT } from '../sim/models/heat.ts';
import { ceilingOf, heatOf, heldFor, runStation, scanQueue } from '../sim/process.ts';
import type { Recipe, RecipeId } from '../sim/recipe.ts';
import { CHARGE_HIGH, CHARGE_LOW, ChargedRecipe } from '../sim/recipe.ts';
import type { Station } from '../sim/station.ts';
import { parcelOf } from '../sim/terrain/parcels.ts';
import type { Building } from '../sim/types.ts';
import { Biome, ItemType } from '../sim/types.ts';
import type { LevelResult, Logger } from './harness.ts';
import { harness } from './harness.ts';
import { header } from './render.ts';

export function runLevel19(log: Logger): LevelResult {
  log(header('LEVEL 19 — Age II: fibre, cord, a woven basket, and the daub that seals it'));

  const run = harness();
  const book = run.settlement.book;
  const hearth = run.settlement.buildings.get(run.settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');
  const fire = stationAt(hearth);
  if (!fire) throw new Error('the hearth was founded without its fire');

  for (const works of [run.reedBed, run.cordWalk, run.weavingFrame, run.daubPit]) works.clearing = null;

  const ground = claimOf(run.world, run.settlement).map((id) => ({
    biome: parcelOf(run.world.seed, id).biome,
    yields: landYield(run.world, id),
  }));
  const marshes = ground.filter((parcel) => parcel.biome === Biome.Marsh);
  const growing = [Biome.Marsh, Biome.Meadow, Biome.Forest, Biome.Highland, Biome.Tundra, Biome.Desert] as string[];
  const onlyMarsh = ground.every((parcel) => parcel.yields.includes(ItemType.Fibre) === growing.includes(parcel.biome));
  const everyMarsh = marshes.length > 0 && marshes.every((p) => p.yields.includes(ItemType.Fibre));
  const dryBank = ground.filter(
    (parcel) => parcel.biome !== Biome.Marsh && parcel.yields.includes(ItemType.Water),
  );
  const bankUnchanged =
    dryBank.length > 0 &&
    dryBank.every(
      (p) =>
        p.yields.includes(ItemType.Mud) &&
        p.yields.includes(ItemType.Clay),
    );
  log(`  of ${ground.length} parcels in the claim ${marshes.length} are marsh, and the reed bed stands on ${run.reedBed.yields.join(', ')}`);

  const cord = batchOn(run.cordWalk, book, [[ItemType.Fibre, 3]]);
  log(`  the cord walk took ${cord.took} and gave ${cord.made} × ${cord.item} in ${cord.ticks} ticks`);

  const basket = batchOn(run.weavingFrame, book, [
    [ItemType.Deadwood, 2],
    [ItemType.Cord, 1],
  ]);
  log(`  the weaving frame took ${basket.took} and gave ${basket.made} × ${basket.item}`);

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

  setLines(hearth, stationSlot(hearth), [SEAL_RECIPE]);
  const dry = refusal(fire, book, hearth);
  depositHopper(hearth, ItemType.Basket, 1);
  const halfWay = refusal(fire, book, hearth);
  depositHopper(hearth, ItemType.Daub, 2);
  const ready = scanQueue(fire, book, hearth, stationSlot(hearth)).recipe?.id === SEAL_RECIPE;
  log(`  the fire with nothing: ${dry?.why}; with the basket alone: ${halfWay?.why}`);

  const before = storedStock(hearth, ItemType.Vessel);
  for (let tick = 1; tick <= 600 && storedStock(hearth, ItemType.Vessel) === before; tick += 1) {
    runStation(hearth, stationSlot(hearth), book, true);
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

  const walk = stationAt(run.cordWalk);
  if (!walk) throw new Error('the cord walk was raised without its frame');
  const twist = recipeOf(book, CORD_RECIPE);
  const seal = recipeOf(book, SEAL_RECIPE);
  const handLow = walk.duration(charged(twist, CHARGE_LOW));
  const handHigh = walk.duration(charged(twist, CHARGE_HIGH));
  const fireLow = fire.duration(charged(seal, CHARGE_LOW));
  const fireHigh = fire.duration(charged(seal, CHARGE_HIGH));
  const handHasNoKnob = !(twist instanceof ChargedRecipe);
  log(`  banked and driven, the cord walk takes ${handLow} and ${handHigh} ticks; the fire ${fireLow} and ${fireHigh}`);
  log(`  twisting cord is written down with no banking to turn: ${handHasNoKnob}`);
  const knobIsTheFires =
    handHasNoKnob && handLow === twist.ticks && handHigh === twist.ticks && fireHigh < fireLow;

  const walkCeiling = ceilingOf(walk);
  const walkHeat = heatOf(walk, book).T;
  log(`  the cord walk tops out at ${walkCeiling} °C, which is the weather`);
  const noChamber = walkCeiling === AMBIENT && walkHeat === AMBIENT;

  const pit = stationAt(run.daubPit);
  if (!pit) throw new Error('the daub pit was raised without its floor');
  setLines(run.daubPit, stationSlot(run.daubPit), [CORD_RECIPE]);
  depositHopper(run.daubPit, ItemType.Fibre, 3);
  runStation(run.daubPit, stationSlot(run.daubPit), book, true);
  const switchedFree = pit.changeover === 0 && pit.running?.recipeId === CORD_RECIPE;
  log(`  the daub pit set to cord instead: ${pit.changeover} ticks of changeover`);

  const checks: [string, boolean][] = [
    ['fibre grows on every growing ground, the marsh included', onlyMarsh && everyMarsh],
    ['and a bank still hands back water, mud and clay', bankUnchanged],
    ['fibre is walked into cord, cord woven into a basket, and daub trodden beside it', chainRuns],
    ['the fire refuses to seal until both the basket and its daub are standing in it', refusesWithoutBoth],
    [
      'a hand method carries no banking at all, and takes the time the book says; a fire does',
      knobIsTheFires,
    ],
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

function batchOn(
  works: Building,
  book: Book,
  inputs: [ItemType, number][],
): { item: ItemType; made: number; ticks: number; took: string } {
  const rig = stationAt(works);
  if (!rig) throw new Error(`the ${labelOf(works)} was raised without its rig`);
  for (const [item, amount] of inputs) stock(works, item, amount);

  for (let tick = 1; tick <= 400; tick += 1) {
    const produced = runStation(works, stationSlot(works), book, true).produced[0];
    if (produced) {
      return {
        item: produced.item,
        made: produced.amount,
        ticks: tick,
        took: inputs.map(([item, amount]) => `${amount} × ${item}`).join(' and '),
      };
    }
  }
  throw new Error(`the ${labelOf(works)} ran for four hundred ticks and gave nothing`);
}

function stock(works: Building, item: ItemType, amount: number): void {
  while (heldFor(works, item) < amount) {
    if (depositHopper(works, item, 1) === 0) {
      throw new Error(`nowhere in the ${labelOf(works)} for ${item}`);
    }
  }
}

function refusal(rig: Station, book: Book, building: Building) {
  return scanQueue(rig, book, building, stationSlot(building)).refused.find((entry) => entry.recipeId === SEAL_RECIPE);
}

function recipeOf(book: Book, id: RecipeId): Recipe {
  const recipe = recipeById(book, id);
  if (!recipe) throw new Error(`the book has no ${id}`);
  return recipe;
}

function charged(recipe: Recipe, charge: number): Recipe {
  return recipe instanceof ChargedRecipe ? recipe.withCharge(charge) : recipe;
}
