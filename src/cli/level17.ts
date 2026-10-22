import { rigAt, setLines, stationSlot } from '../sim/area.ts';
import type { Book } from '../sim/book.ts';
import { CERAMIC_HEAT, CHAR_RECIPE, POTS_RECIPE, addRecipe, recipeById } from '../sim/book.ts';
import { depositHopper, labelOf, storedStock } from '../sim/buildings.ts';
import { claimOf } from '../sim/claims.ts';
import { canBuild, placeBuilding } from '../sim/construction.ts';
import { CLAMP, PIT_FIRING } from '../sim/designs.ts';
import { RIGS, fire, glowOf } from '../sim/models/heat.ts';
import { ceilingOf, heatOf, heldFor, runRig, scanQueue } from '../sim/process.ts';
import type { Recipe, RecipeId } from '../sim/recipe.ts';
import { CHARGE_HIGH, CHARGE_LOW } from '../sim/recipe.ts';
import type { Building, Design } from '../sim/types.ts';
import { ItemType } from '../sim/types.ts';
import type { Harness, LevelResult, Logger } from './harness.ts';
import { harness } from './harness.ts';
import { header } from './render.ts';

export function runLevel17(log: Logger): LevelResult {
  log(header('LEVEL 17 — Heat in play: what a fire will take, and what the one knob decides'));

  const run = harness();
  const hearth = run.settlement.buildings.get(run.settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');
  const fireRig = rigAt(hearth);
  if (!fireRig) throw new Error('the hearth was founded without its fire');
  const book = run.settlement.book;

  const bankedPit = raise(run, PIT_FIRING);
  const drivenPit = raise(run, PIT_FIRING);
  const shutClamp = raise(run, CLAMP);
  const ventedClamp = raise(run, CLAMP);
  const pitRig = rigAt(bankedPit);
  if (!pitRig) throw new Error('a pit firing raised no masonry');

  const open = ceilingOf(fireRig);
  const dug = ceilingOf(pitRig);
  log(`  the fire tops out at ${open} °C (${glowOf(open).name}); the pit at ${dug} °C (${glowOf(dug).name})`);
  const pitIsHotter = open < CERAMIC_HEAT && dug >= CERAMIC_HEAT;

  stockBins(hearth, ItemType.Clay, 4);
  stockBins(bankedPit, ItemType.Clay, 4);
  setLines(hearth, stationSlot(hearth), [POTS_RECIPE]);
  setLines(bankedPit, stationSlot(bankedPit), [POTS_RECIPE]);
  const refusal = scanQueue(fireRig, book, hearth, stationSlot(hearth)).refused.find((r) => r.recipeId === POTS_RECIPE);
  log(`  the fire refuses the pots: ${refusal?.why}`);
  const refusesInWords =
    refusal?.kind === 'envelope' &&
    refusal.why.includes(glowOf(CERAMIC_HEAT).name) &&
    refusal.why.includes(glowOf(open).name);
  const pitTakesIt = scanQueue(pitRig, book, bankedPit, stationSlot(bankedPit)).recipe?.id === POTS_RECIPE;

  const banked = charge(book, POTS_RECIPE, CHARGE_LOW, 'fire-pots-banked', 'Fire pots, banked');
  const driven = charge(book, POTS_RECIPE, CHARGE_HIGH, 'fire-pots-driven', 'Fire pots, driven');
  const cold = firePit(bankedPit, book, banked.id);
  const hot = firePit(drivenPit, book, driven.id);
  log(`  banked, the pit sits at ${cold.T} °C (${glowOf(cold.T).name}) and gave ${cold.made} pots`);
  log(`  driven, it reaches ${hot.T} °C (${glowOf(hot.T).name}) and gave ${hot.made}`);
  const knobMovesTheHeat = cold.T < CERAMIC_HEAT && hot.T >= CERAMIC_HEAT;
  const knobDecidesTheWare = cold.made === 0 && hot.made > 0;

  const shut = charge(book, CHAR_RECIPE, CHARGE_LOW, 'burn-charcoal-shut', 'Burn charcoal, vents shut');
  const vented = charge(book, CHAR_RECIPE, CHARGE_HIGH, 'burn-charcoal-open', 'Burn charcoal, vents open');
  const smoulder = burnClamp(shutClamp, book, shut.id);
  const proper = burnClamp(ventedClamp, book, vented.id);
  const shutPile = shut.pile();
  const ventedPile = vented.pile();
  log(
    `  vents shut: the pile sits at ${shutPile.T} °C under ${shutPile.smoke} smoke and gave` +
      ` ${smoulder.amount} × ${smoulder.item} (${shutPile.charcoal} off the pile)`,
  );
  log(
    `  vents open: ${ventedPile.T} °C under ${ventedPile.smoke} smoke and gave` +
      ` ${proper.amount} × ${proper.item} (${ventedPile.charcoal} off the pile)`,
  );
  const gradeTurnsOver = smoulder.item === ItemType.Brands && proper.item === ItemType.Charcoal;
  const yieldPaysForIt = smoulder.amount > proper.amount;

  const rate = RIGS.pitFire.build.maxRate * 0.6;
  const onWood = fire({ ...RIGS.pitFire.build, fuel: 'wood', damper: 1, fuelRate: rate });
  const onCharcoal = fire({ ...RIGS.pitFire.build, fuel: 'charcoal', damper: 1, fuelRate: rate });
  log(
    `  the pit's flue on wood: ${onWood.T} °C, ${onWood.starved ? 'starved' : 'burning clean'};` +
      ` on charcoal: ${onCharcoal.T} °C, ${onCharcoal.starved ? 'starved' : 'burning clean'}`,
  );
  const charcoalPunishes = onCharcoal.T < onWood.T && onCharcoal.starved && !onWood.starved;

  drivenPit.queue.unshift({ recipeId: CHAR_RECIPE, slot: stationSlot(drivenPit) });
  ventedClamp.queue.unshift({ recipeId: POTS_RECIPE, slot: stationSlot(ventedClamp) });
  const atThePit = rigAt(drivenPit)
    ? scanQueue(rigAt(drivenPit)!, book, drivenPit, stationSlot(drivenPit)).refused.find((r) => r.recipeId === CHAR_RECIPE)
    : undefined;
  const atTheClamp = rigAt(ventedClamp)
    ? scanQueue(rigAt(ventedClamp)!, book, ventedClamp, stationSlot(ventedClamp)).refused.find((r) => r.recipeId === POTS_RECIPE)
    : undefined;
  log(`  the pit asked to char: ${atThePit?.why}; the clamp asked for pots: ${atTheClamp?.why}`);
  const wrongFloorRefused =
    atThePit?.kind === 'wrong-process' && atTheClamp?.kind === 'wrong-process';

  const needsEmbers =
    recipeById(book, CHAR_RECIPE)?.inputs.some((input) => input.item === ItemType.Embers) === true;

  const checks: [string, boolean][] = [
    ['a pit reaches ceramic and an open fire never will', pitIsHotter],
    ['so the fire refuses the pots, and names the glow it is short of', refusesInWords],
    ['while the pit dug beside it takes the very same method', pitTakesIt],
    ['banking the pit low keeps the chamber under ceramic', knobMovesTheHeat],
    ['and clay fired under ceramic comes out of the pit as nothing', knobDecidesTheWare],
    ['vents shut give brands, vents open give charcoal', gradeTurnsOver],
    ['and the better grade is paid for in what the pile gives back', yieldPaysForIt],
    ['charcoal without the draught to feed it is colder than the wood it replaced', charcoalPunishes],
    ['and it smokes while it is being colder', onCharcoal.starved],
    ['a clamp is not a fire rig, and each refuses the other in plain words', wrongFloorRefused],
    ['and a pile is lit from the hearth, which is what embers are for', needsEmbers],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-17',
    title: 'Heat in play',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `fire ${open} °C, pit ${dug} °C; banked ${cold.T} °C gave ${cold.made} pots, driven ${hot.T} °C gave ${hot.made};` +
          ` the clamp gave ${smoulder.amount} ${smoulder.item} shut and ${proper.amount} ${proper.item} open;` +
          ` charcoal on the pit's flue ${onWood.T} → ${onCharcoal.T} °C`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

function raise(run: Harness, design: Design): Building {
  const { world, settlement } = run;
  const site = claimOf(world, settlement).find((id) => canBuild(world, settlement, id, design).ok);
  if (!site) throw new Error(`nowhere in the claim to raise a ${design.label}`);
  const building = placeBuilding(world, settlement, site, design);
  building.clearing = null;
  return building;
}

function charge(book: Book, from: RecipeId, level: number, id: RecipeId, label: string): Recipe {
  const original = recipeById(book, from);
  if (!original) throw new Error(`the book has no ${from}`);
  const recipe = original.with({ id, label }).withCharge(level);
  addRecipe(book, recipe);
  return recipe;
}

function firePit(pit: Building, book: Book, recipeId: RecipeId): { T: number; made: number } {
  const rig = rigAt(pit);
  if (!rig) throw new Error('the pit lost its masonry');
  setLines(pit, stationSlot(pit), [recipeId]);
  stockBins(pit, ItemType.Clay, 4);
  let T = 20;
  for (let tick = 1; tick <= 400; tick += 1) {
    runRig(pit, stationSlot(pit), book, true);
    if (rig.running) T = Math.max(T, heatOf(rig, book).T);
  }
  return { T, made: storedStock(pit, ItemType.Pot) };
}

function burnClamp(
  clamp: Building,
  book: Book,
  recipeId: RecipeId,
): { item: ItemType; amount: number } {
  const rig = rigAt(clamp);
  if (!rig) throw new Error('the clamp lost its pile');
  setLines(clamp, stationSlot(clamp), [recipeId]);
  stockBins(clamp, ItemType.Deadwood, 4);
  stockBins(clamp, ItemType.Embers, 4);
  for (let tick = 1; tick <= 400; tick += 1) {
    const produced = runRig(clamp, stationSlot(clamp), book, true).produced[0];
    if (produced) return { item: produced.item, amount: produced.amount };
  }
  throw new Error('the clamp burned for four hundred ticks and gave nothing');
}

function stockBins(building: Building, item: ItemType, amount: number): void {
  while (heldFor(building, item) < amount) {
    if (depositHopper(building, item, 1) === 0) {
      throw new Error(`nowhere left in the ${labelOf(building)} for ${item}`);
    }
  }
}
