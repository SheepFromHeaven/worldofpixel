import type { Tool } from './game.ts';

/**
 * What the shell's permanent slots draw, as plain data (`docs/methods.html` §5). Kept apart from
 * `game.ts` because importing that raises a world, and the bench has to stand the whole frame
 * against nothing — empty and full.
 */

/** The top-left strip: always there, and it says what there is to do before there is a town. */
export interface StripView {
  seed: number;
  /** Whether a settlement exists to speak for. */
  town: boolean;
  people: number;
  /** Hours the band had left over from its own needs in the last day watched. */
  spare: number;
  /** Something going wrong, in a few words, or null. */
  trouble: string | null;
}

/** The top-right clock: the day and how fast it is running. */
export interface ClockView {
  tick: number;
  playing: boolean;
  speed: number;
}

/** The bottom bar: what can be put down, and why a thing cannot be. */
export interface BarView {
  tool: Tool;
  /** The ground is resolved into parcels, so a tool has something to act on. */
  fine: boolean;
  towns: number;
}
