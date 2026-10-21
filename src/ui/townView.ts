import type { Standing } from './rigView.ts';

/**
 * What the town's own slab draws, as plain data.
 *
 * Everything on it is something a person standing in the town could count without owning an
 * instrument: how many of them there are, how many sleep under a roof, what is standing in
 * which building, and where the hours of a day go. Nothing here is a rate, a share or a curve
 * — the fog rule is over the whole panel, not only over the fires (`docs/methods.html` §10).
 *
 * Kept apart from `game.ts` for the same reason `rigView.ts` is: importing `game.ts` raises a
 * world, and the bench has to be able to stand this against nothing.
 */

/**
 * The parts of a waking day, in the order the day is actually spent.
 *
 * Declaration order is the drawing's order, so the row of hours reads as a day rather than as
 * a table of figures sorted by size.
 */
export const DAY_PARTS = ['rest', 'water', 'food', 'cooking', 'firewood', 'work'] as const;

export type DayPart = (typeof DAY_PARTS)[number];

/**
 * One stretch of the day, in whole hours.
 *
 * Hours, because an hour is the finest thing anybody here can tell: the sun is the instrument
 * and it reads to about that. A figure of 1.6 is the model's, and writing it on the slab would
 * be claiming a clock the town has not got.
 */
export interface DayHours {
  part: DayPart;
  hours: number;
}

/** A building with something in it, as the panel names it. */
export interface StandingIn {
  id: string;
  label: string;
  stock: Standing;
  capacity: number;
}

export interface TownView {
  name: string;
  /** Everyone in the band. A count of people you can see, which is the one census there is. */
  people: number;
  /** How many of them sleep under a roof. The rest sleep rough, and it costs them the morning. */
  sheltered: number;
  /** What the town has to carry water in. Until there is one, nobody fetches for anybody. */
  vessels: number;
  buildings: number;
  /** One villager's day, hour by hour. Every part of it, so the fourteen are all accounted. */
  day: DayHours[];
  /** The hours the whole band has over, added up: the score, and the only one. */
  spare: number;
  /** What is standing in the buildings, the town's own store first. */
  standing: StandingIn[];
}

/** What each stretch of the day is called on the slab. */
export const DAY_LABELS: Record<DayPart, string> = {
  rest: 'sleeping',
  water: 'fetching water',
  food: 'finding food',
  cooking: 'cooking it',
  firewood: 'carrying firewood',
  work: 'free to work',
};
