import { storedStock } from './buildings.ts';
import type { Vec2 } from './geometry.ts';
import { CARRIER_SPEED } from './carriers.ts';
import { HEARTH_REACH } from './claims.ts';
import { clamp, round2 } from './models/units.ts';
import { landWorkById } from './landWorks.ts';
import { PARCEL, parcelOf } from './parcels.ts';
import { nearestWater } from './terrain.ts';
import { ItemType } from './types.ts';
import type { Building, ItemType as Item, Settlement } from './types.ts';
import type { GameWorld } from './world.ts';

/**
 * The bottom of the pyramid, from the first minute.
 *
 * A villager is not free labour. Water, food, warmth and rest come out of the same day that work
 * does, and at the start they eat nearly all of it — which is the chapter's real subject: every
 * technology in it buys hours back. A town of three foragers has a handful of spare hours a day
 * between them; a town of thirteen with pots, tools and roofs has a hundred and thirty.
 *
 * **Needs cost time, never lives.** Unmet needs slow the town down and nothing else. There is no
 * starvation spiral, because a survival death-loop punishes the player for the one mistake they
 * have least information about, and this game is about information.
 *
 * The arithmetic is `day()` from `docs/methods.html`, with every input read off the town instead
 * of handed in: how far the water is, what there is to carry it in, who has a roof. So the
 * figure in the document and the readout on screen are the same function, and a change to either
 * is a change to both.
 */

export const DAY_HOURS = 14;
/** An hour of the villagers' day. A tick is a tenth of a second, so a day runs about a minute. */
export const TICKS_PER_HOUR = 60;
export const DAY_TICKS = DAY_HOURS * TICKS_PER_HOUR;

export const NEED = { waterLitres: 3, kcal: 2200 };

/**
 * Foraging, by hand, with nothing — and what a camp to do it from is worth.
 *
 * Step 2 is not a fuel site, whatever it also brings back: "this is also where the town's
 * food comes from, all day, until tools make an hour of it worth more". So a forage camp has
 * to move the one number food is priced in, or siting one changes nothing about the day and
 * the chapter's second step is decoration. Edges and digging sticks raise it further; that is
 * steps 3 to 5, and they are not built.
 */
export const FORAGE_KCAL_PER_HOUR = 480;
export const CAMP_KCAL_PER_HOUR = 760;
export const PREP_KCAL_PER_HOUR = 1500;
/** Carrying deadwood for the fire, before anything burns longer for less carrying. */
export const FUEL_HOURS = 1.6;
/** Sleeping rough: you recover badly and start late. A roof is worth about an hour and a half. */
export const ROUGH_REST_HOURS = 2.2;

/**
 * How much a vessel carries, by what it is.
 *
 * The vessel ladder of section 13 — daubed basket, pit-fired pot, kiln-fired pot — only means
 * anything if the rungs differ, and this is where they do. "A hard pot carries more water per
 * trip and survives more trips before it breaks. That is how a firing schedule ends up deciding
 * how many people have to walk to the river." A basket seeps and must be carried carefully; a
 * fired pot does not.
 */
export const VESSEL_LITRES = 3;
export const POT_LITRES = 8;

/**
 * What one whole trip for water costs, door to door.
 *
 * Most of a water errand is not the distance. It is breaking off whatever you were doing,
 * going down to the bank, waiting your turn, drinking, and coming back to find the work cold —
 * which is why a band camped on the riverbank still loses most of an hour a day to it, and why
 * the saving that matters is fetching *fewer times*, not walking a shorter way.
 *
 * These are whole trips and not overheads: twenty-six minutes is the document's own figure for
 * a band with the river inside its own ground, and nine for a village with a well sunk in the
 * middle of it. The walk to water the town already holds is inside them; only a hearth sited
 * beyond its own claim from water pays for any walking on top.
 */
const RIVER_ERRAND_MINUTES = 26;
const WELL_ERRAND_MINUTES = 9;

/** Water nearer than this is the town's own ground, and the errand already covers the walk. */
const AT_HAND = HEARTH_REACH * PARCEL;

export interface Hours {
  water: number;
  food: number;
  prep: number;
  fuel: number;
  rest: number;
  work: number;
}

export interface Budget {
  people: number;
  hours: Hours;
  shares: Hours;
  /** The score: the share of the town's day that is not survival. One readout, always on. */
  surplusShare: number;
  surplusHours: number;
  /** What one whole trip to water costs in minutes, which is what siting and a well buy down. */
  waterWalk: number;
  vessels: number;
  /** Share of the town with a roof over them. */
  shelter: number;
}

/**
 * Where a waking day goes, for this town as it stands.
 *
 * `vessel` is the hinge and it is why water is listed first. With nothing to carry water in,
 * everybody walks to the river for every drink; with a basket, one person fetches for several.
 * That is the biggest single hour-saving in the chapter, and it is why the daubed basket is a
 * milestone rather than a convenience.
 */
export function budgetOf(world: GameWorld, settlement: Settlement): Budget {
  const people = Math.max(1, settlement.carriers.size);
  const walkMinutes = waterWalkMinutes(world, settlement);
  const vessels = vesselsHeld(settlement);
  const shelter = shelterShare(settlement);

  const litresPerTrip = vessels > 0 ? litresPerVessel(settlement) : 0;
  // How many people one load covers. The document's prose is explicit — "a hard pot carries
  // more water per trip and survives more trips before it breaks. That is how a firing
  // schedule ends up deciding how many people have to walk to the river" — but its own `day()`
  // takes `ceil(need / vessel)`, which is 1 for anything from three litres up, so the vessel
  // ladder's second rung moved nothing. This is the term that makes the prose true, and it
  // leaves the no-vessel case the document pins its dawn figures on exactly as it was.
  const served = litresPerTrip / NEED.waterLitres;
  // Without a vessel there is no fetching for anybody else: three walks each, every day.
  const tripsEach =
    litresPerTrip <= 0
      ? 3
      : Math.ceil(NEED.waterLitres / litresPerTrip) /
        Math.max(1, Math.min(vessels, people) * served);
  const water = (tripsEach * walkMinutes) / 60;
  const food = NEED.kcal / forageRate(settlement);
  const prep = NEED.kcal / PREP_KCAL_PER_HOUR;
  const rest = ROUGH_REST_HOURS * (1 - shelter * 0.72);

  const survival = water + food + prep + FUEL_HOURS + rest;
  const work = Math.max(0, DAY_HOURS - survival);
  const share = (hours: number): number => round2(hours / DAY_HOURS);

  const hours: Hours = {
    water: round2(water),
    food: round2(food),
    prep: round2(prep),
    fuel: round2(FUEL_HOURS),
    rest: round2(rest),
    work: round2(work),
  };

  return {
    people,
    hours,
    shares: {
      water: share(water),
      food: share(food),
      prep: share(prep),
      fuel: share(FUEL_HOURS),
      rest: share(rest),
      work: share(work),
    },
    surplusShare: share(work),
    surplusHours: round2(work * people),
    waterWalk: Math.round(walkMinutes),
    vessels,
    shelter: round2(shelter),
  };
}

/**
 * One trip to the nearest drinkable water, in minutes of the villagers' day.
 *
 * Off the map rather than out of a constant: a town founded on a riverbank really does spend
 * less of its day walking than one founded a field away, and that is a decision the player made
 * when they sited the hearth.
 */
function waterWalkMinutes(world: GameWorld, settlement: Settlement): number {
  const hearth = settlement.buildings.get(settlement.hearthId);
  if (!hearth) return 0;

  // A well in the town is water brought to the door, and that is true whether or not the river
  // it was dug beside happens to be closer still. Taking the *nearer* of the two, as this did,
  // meant a town founded on a bank — which every town is, because that is where you can drink —
  // never counted its own water hole at all, and step 11 bought it nothing.
  // A building that merely *stands* on wet ground is not a well; the hearth usually does.
  let sunk: Vec2 | null = null;
  for (const building of settlement.buildings.values()) {
    if (building.clearing || !drawsWater(building)) continue;
    const site = parcelOf(world.seed, building.cellId).site;
    if (!sunk || gap(hearth.position, site) < gap(hearth.position, sunk)) sunk = site;
  }
  const nearest = sunk ?? nearestWater(world.seed, hearth.position);

  const errand = sunk ? WELL_ERRAND_MINUTES : RIVER_ERRAND_MINUTES;
  if (!nearest) return errand;
  // Only the walk past the town's own ground is paid on top, there and back, at a walking pace,
  // with a tick standing for a minute of the day.
  const beyond = Math.max(0, gap(hearth.position, nearest) - AT_HAND);
  return errand + (2 * beyond) / CARRIER_SPEED;
}

const gap = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(b.x - a.x, b.y - a.y);

/**
 * A building that has the ground open for water, rather than one that happens to stand on it.
 *
 * A land work is the only thing that opens the ground, so what it draws is its own entry in
 * `LAND_WORKS` — a lean-to on a bank is a bed by a river, not a well.
 */
function drawsWater(building: Building): boolean {
  return (
    building.yields.includes(ItemType.Water) &&
    landWorkById(building.designId)?.item === ItemType.Water
  );
}

/**
 * What an hour of foraging returns. A camp is somewhere to bring it back to and work it up,
 * which is most of the difference between picking as you walk and feeding a town.
 */
function forageRate(settlement: Settlement): number {
  for (const building of settlement.buildings.values()) {
    if (building.clearing) continue;
    if (building.designId === 'forage-camp') return CAMP_KCAL_PER_HOUR;
  }
  return FORAGE_KCAL_PER_HOUR;
}

/** Everything the town has to carry water in, wherever it is standing. */
export function vesselsHeld(settlement: Settlement): number {
  return countHeld(settlement, ItemType.Vessel) + countHeld(settlement, ItemType.Pot);
}

/** The biggest thing the town has to carry water in, which is what sets a trip's worth. */
export function litresPerVessel(settlement: Settlement): number {
  return countHeld(settlement, ItemType.Pot) > 0 ? POT_LITRES : VESSEL_LITRES;
}

/** Everything of a kind the town has, wherever it is standing. */
function countHeld(settlement: Settlement, item: Item): number {
  let held = 0;
  for (const building of settlement.buildings.values()) held += storedStock(building, item);
  return held;
}

/**
 * Whether the town may carry an item at all.
 *
 * Water is the one that needs an answer: until there is something to carry it in, everybody
 * drinks at the source and nobody fetches for anybody. That is what makes the first vessel a
 * milestone rather than a convenience, and it is why the bank dig exists — mud without carrying
 * water, which is the only way out of the circle.
 */
export function canHaul(settlement: Settlement, item: Item): boolean {
  if (!wanted(settlement, item)) return false;
  return item !== ItemType.Water || vesselsHeld(settlement) > 0;
}

/**
 * Whether anything in the town would ever use this.
 *
 * A store takes anything and is the destination of last resort, which together mean a thing
 * nobody wants is carried to the fire and left there for good. With Water that is not merely
 * untidy: the well is step 11 and the hearth's shelf is the town's, so the biggest hour-saving
 * in the chapter could fill the very shelf the sealing method draws its baskets off, and stop it.
 *
 * So an item is cargo when some method in the book asks for it, and not before. Derived on every
 * call, so the day the clay web gives water a use it becomes carriable again with nothing here
 * to remember.
 */
export function wanted(settlement: Settlement, item: Item): boolean {
  for (const method of settlement.book.methods.values()) {
    if (method.inputs.some((input) => input.item === item)) return true;
  }
  return false;
}

/** Beds under a roof, as a share of the town. Sleeping rough is the rest. */
function shelterShare(settlement: Settlement): number {
  let sheltered = 0;
  for (const building of settlement.buildings.values()) {
    if (building.clearing) continue;
    if (building.design.sheltered) sheltered += building.design.beds ?? 0;
  }
  return clamp(sheltered / Math.max(1, settlement.carriers.size));
}

/** Everywhere there is to sleep. A town can be no bigger than the beds it has built. */
export function bedsIn(settlement: Settlement): number {
  let beds = 0;
  for (const building of settlement.buildings.values()) beds += bedsOf(building);
  return beds;
}

export function bedsOf(building: Building): number {
  return building.design.beds ?? 0;
}

/**
 * Whether a villager is at work this minute or at their own survival.
 *
 * The share comes from the budget; the *rota* is here, and it is staggered by the villager's
 * place in the town so they do not all sit down at once — a map where the whole band stops
 * together reads as the game having frozen, which is the opposite of what this is for. A walk
 * already begun is never interrupted: the gate is on taking a new errand, not on finishing one.
 */
export function onShift(index: number, people: number, tick: number, workShare: number): boolean {
  if (workShare >= 1) return true;
  const stagger = Math.floor((index * DAY_TICKS) / Math.max(1, people));
  const minute = (tick + stagger) % DAY_TICKS;
  // At least one minute of work in the day, or a town with no surplus at all never moves again
  // and the player is left with nothing to read the problem off.
  return minute < Math.max(1, Math.round(workShare * DAY_TICKS));
}
