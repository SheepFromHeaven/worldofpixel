import { claimOf } from '../sim/claims.ts';
import { canBuild, placeBuilding } from '../sim/construction.ts';
import { depositHopper, storedStock } from '../sim/buildings.ts';
import { CLAMP, PIT_FIRING } from '../sim/designs.ts';
import {
  CERAMIC_HEAT,
  CHARGE_HIGH,
  CHARGE_LOW,
  CHAR_METHOD,
  POTS_METHOD,
  addMethod,
  methodById,
} from '../sim/book.ts';
import type { Book, Method, MethodId } from '../sim/book.ts';
import { RIGS, fire, glowOf } from '../sim/models/heat.ts';
import { ceilingOf, charOf, heatOf, heldFor, runRig, scanQueue } from '../sim/process.ts';
import { ItemType } from '../sim/types.ts';
import type { Building, Design } from '../sim/types.ts';
import { header } from './render.ts';
import { harness } from './levels.ts';
import type { Harness, LevelResult, Logger } from './levels.ts';

/**
 * LEVEL 17 — heat in play: the charcoal lesson, on the tick rather than in the model.
 *
 * Level 14 asserts the models are right about heat. This one asserts the town is — the same
 * claims made of buildings standing on the ground, methods in the book and batches landing on
 * the floor. A fire that cannot reach ceramic refuses the pot method in plain words while the pit
 * dug beside it takes the very same entry; the one ordinal knob decides what comes out of the
 * pit and what grade comes out of the clamp; and a method written for a pile cooking itself is
 * refused by a fire in a chamber, and the other way about.
 *
 * The one it exists for is the middle of those: **charcoal is not a free upgrade.** Twice the
 * energy of wood and nearly twice the air, so a rig switched to it before it has the flue to
 * feed it runs *colder*, and smokes while it does. That is the chapter's whole argument for
 * building a taller stack, and it has to be something the fire does rather than something the
 * document says.
 */
export function runLevel17(log: Logger): LevelResult {
  log(header('LEVEL 17 — Heat in play: what a fire will take, and what the one knob decides'));

  const run = harness();
  const hearth = run.settlement.buildings.get(run.settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');
  const fireRig = hearth.rig;
  if (!fireRig) throw new Error('the hearth was founded without its fire');
  const book = run.settlement.book;

  // Two pits and two clamps, because a rig that has run once has its room spoken for and this
  // level is about what the *same* masonry does at two settings of one knob.
  const bankedPit = raise(run, PIT_FIRING);
  const drivenPit = raise(run, PIT_FIRING);
  const shutClamp = raise(run, CLAMP);
  const ventedClamp = raise(run, CLAMP);
  const pitRig = bankedPit.rig;
  if (!pitRig) throw new Error('a pit firing raised no masonry');

  // What the masonry fixes, and the whole of the pot method's siting decision. An open fire in
  // the wind is half the chamber a dug pit is, and no banking will make up the difference.
  const open = ceilingOf(fireRig);
  const dug = ceilingOf(pitRig);
  log(`  the fire tops out at ${open} °C (${glowOf(open).name}); the pit at ${dug} °C (${glowOf(dug).name})`);
  const pitIsHotter = open < CERAMIC_HEAT && dug >= CERAMIC_HEAT;

  // The same method and the same clay handed to both. The fire refuses it in words a player can
  // act on — which glow it needs and which it tops out at — and the pit takes it.
  stockBins(hearth, ItemType.Clay, 4);
  stockBins(bankedPit, ItemType.Clay, 4);
  fireRig.queue = [POTS_METHOD];
  pitRig.queue = [POTS_METHOD];
  const refusal = scanQueue(fireRig, book, hearth).refused.find((r) => r.methodId === POTS_METHOD);
  log(`  the fire refuses the pots: ${refusal?.why}`);
  const refusesInWords =
    refusal?.kind === 'envelope' &&
    refusal.why.includes(glowOf(CERAMIC_HEAT).name) &&
    refusal.why.includes(glowOf(open).name);
  const pitTakesIt = scanQueue(pitRig, book, bankedPit).method?.id === POTS_METHOD;

  // The ordinal knob, on the pit. Same pots, same pit, banked and then driven: the chamber sits
  // under ceramic at one setting and over it at the other, which is the choice the three-fire
  // strip is putting in front of the player.
  const banked = charge(book, POTS_METHOD, CHARGE_LOW, 'fire-pots-banked', 'Fire pots, banked');
  const driven = charge(book, POTS_METHOD, CHARGE_HIGH, 'fire-pots-driven', 'Fire pots, driven');
  const cold = firePit(bankedPit, book, banked.id);
  const hot = firePit(drivenPit, book, driven.id);
  log(`  banked, the pit sits at ${cold.T} °C (${glowOf(cold.T).name}) and gave ${cold.made} pots`);
  log(`  driven, it reaches ${hot.T} °C (${glowOf(hot.T).name}) and gave ${hot.made}`);
  const knobMovesTheHeat = cold.T < CERAMIC_HEAT && hot.T >= CERAMIC_HEAT;
  const knobDecidesTheWare = cold.made === 0 && hot.made > 0;

  // The same knob on the clamp, where it disagrees with itself: vents nearly shut and the pile
  // smoulders cool and gives a lot of half-burnt brands; opened, it runs hot, gives proper
  // charcoal, and gives less of it.
  const shut = charge(book, CHAR_METHOD, CHARGE_LOW, 'burn-charcoal-shut', 'Burn charcoal, vents shut');
  const vented = charge(book, CHAR_METHOD, CHARGE_HIGH, 'burn-charcoal-open', 'Burn charcoal, vents open');
  const smoulder = burnClamp(shutClamp, book, shut.id);
  const proper = burnClamp(ventedClamp, book, vented.id);
  const shutPile = charOf(shut);
  const ventedPile = charOf(vented);
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

  // Charcoal is not a free upgrade. The pit's own masonry, the same rate, nothing changed but
  // what is being burnt: short of air the fuel only half burns, the volatiles leave up the flue
  // as smoke, and the chamber comes out colder than it was on wood.
  const rate = RIGS.pitFire.build.maxRate * 0.6;
  const onWood = fire({ ...RIGS.pitFire.build, fuel: 'wood', damper: 1, fuelRate: rate });
  const onCharcoal = fire({ ...RIGS.pitFire.build, fuel: 'charcoal', damper: 1, fuelRate: rate });
  log(
    `  the pit's flue on wood: ${onWood.T} °C, ${onWood.starved ? 'starved' : 'burning clean'};` +
      ` on charcoal: ${onCharcoal.T} °C, ${onCharcoal.starved ? 'starved' : 'burning clean'}`,
  );
  const charcoalPunishes = onCharcoal.T < onWood.T && onCharcoal.starved && !onWood.starved;

  // A pile cooking itself and a fire in a chamber are two models, so they are two processes,
  // and neither floor will take the other's method.
  drivenPit.rig?.queue.unshift(CHAR_METHOD);
  ventedClamp.rig?.queue.unshift(POTS_METHOD);
  const atThePit = drivenPit.rig
    ? scanQueue(drivenPit.rig, book, drivenPit).refused.find((r) => r.methodId === CHAR_METHOD)
    : undefined;
  const atTheClamp = ventedClamp.rig
    ? scanQueue(ventedClamp.rig, book, ventedClamp).refused.find((r) => r.methodId === POTS_METHOD)
    : undefined;
  log(`  the pit asked to char: ${atThePit?.why}; the clamp asked for pots: ${atTheClamp?.why}`);
  const wrongFloorRefused =
    atThePit?.kind === 'wrong-process' && atTheClamp?.kind === 'wrong-process';

  // "Wood and mud in, stack, clamp, embers from the hearth": a pile is not kindled from
  // nothing, and this is the one thing the hearth's own product is for.
  const needsEmbers =
    methodById(book, CHAR_METHOD)?.inputs.some((input) => input.item === ItemType.Embers) === true;

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

/** Raise one of the heat age's rigs inside the town's claim, the way a player would. */
function raise(run: Harness, design: Design): Building {
  const { world, settlement } = run;
  const site = claimOf(world, settlement).find((id) => canBuild(world, settlement, id, design).ok);
  if (!site) throw new Error(`nowhere in the claim to raise a ${design.label}`);
  const building = placeBuilding(world, settlement, site, design);
  // Cleared by hand: this level ticks its rigs itself, with no villager to fell the site, and
  // what it is about is the heat rather than the spadework.
  building.clearing = null;
  return building;
}

/** The same method at a different banking, written into the book under a name of its own. */
function charge(book: Book, from: MethodId, level: number, id: MethodId, label: string): Method {
  const original = methodById(book, from);
  if (!original) throw new Error(`the book has no ${from}`);
  const method: Method = {
    ...original,
    id,
    label,
    run: { ...original.run, charge: level },
    inputs: original.inputs.map((input) => ({ ...input })),
    outputs: original.outputs.map((output) => ({ ...output })),
  };
  addMethod(book, method);
  return method;
}

/** One firing at one banking: the hottest the chamber got, and what the pit held after. */
function firePit(pit: Building, book: Book, methodId: MethodId): { T: number; made: number } {
  const rig = pit.rig;
  if (!rig) throw new Error('the pit lost its masonry');
  rig.queue = [methodId];
  stockBins(pit, ItemType.Clay, 4);
  let T = 20;
  for (let tick = 1; tick <= 400; tick += 1) {
    runRig(pit, book, true);
    if (rig.running) T = Math.max(T, heatOf(rig, book).T);
  }
  return { T, made: storedStock(pit, ItemType.Pot) };
}

/** One burn at one vent setting, and the grade and the amount the pile gave back. */
function burnClamp(
  clamp: Building,
  book: Book,
  methodId: MethodId,
): { item: ItemType; amount: number } {
  const rig = clamp.rig;
  if (!rig) throw new Error('the clamp lost its pile');
  rig.queue = [methodId];
  stockBins(clamp, ItemType.Deadwood, 4);
  // A clamp is lit from the hearth: it wants embers as well as something to char.
  stockBins(clamp, ItemType.Embers, 4);
  for (let tick = 1; tick <= 400; tick += 1) {
    const produced = runRig(clamp, book, true).produced[0];
    if (produced) return { item: produced.item, amount: produced.amount };
  }
  throw new Error('the clamp burned for four hundred ticks and gave nothing');
}

/**
 * Hand goods in at a rig until it has what it needs.
 *
 * Against `heldFor`, which is what the rig itself reads: everything standing in the building,
 * whoever brought it. A building's capacity is shared across every item in it, so handing in
 * more than the method asks for is handing away the room the output needs — which is how the
 * clamp came to refuse its own method for want of a shelf it had been given away.
 */
function stockBins(building: Building, item: ItemType, amount: number): void {
  while (heldFor(building, item) < amount) {
    if (depositHopper(building, item, 1) === 0) {
      throw new Error(`nowhere left in the ${building.design.label} for ${item}`);
    }
  }
}
