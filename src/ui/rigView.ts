import type { ProcessId } from '../sim/book.ts';
import type { RefusalKind } from '../sim/process.ts';
import type { ItemType as Item } from '../sim/types.ts';

/*
 * Plain data for the rail's drawings. Kept apart from `game.ts` because importing that builds a
 * world, and the bench has to stand these against nothing.
 */

/** What is standing in a building, in the order it arrived. */
export type Standing = [Item, number][];

/** One batch of anything: what it eats, what it makes, how long, and how far through it is. */
export interface Batch {
  uses: { item: Item; amount: number }[];
  makes: { item: Item; amount: number }[];
  seconds: number;
  progress: number;
  /** What each unit may turn out to be, when it is drawn from a pool (`makes` then gives the count). */
  pool?: { item: Item; chance: number }[];
}

/** One line of a station's recipes: a batch, whether it is the one running, and why it is not. */
export interface QueueEntry extends Batch {
  id: string;
  label: string;
  running: boolean;
  /** The kind of refusal, so a line short of an input can be told from one that is simply full. */
  refusal?: RefusalKind | null;
  /** The refusal in plain words. Empty when the line is running. */
  why: string;
}

/** A station's banking strip: which fire is set and which the town has the fuel to pay for. */
export interface FireView {
  process: ProcessId;
  /** An index into `CHARGE_STEPS`. */
  charge: number;
  affordable: boolean[];
  /** The fire is coming down and going back up between two methods. */
  changingOver: boolean;
}
