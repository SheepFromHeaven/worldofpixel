import { round2 } from './units.ts';

/**
 * A knob is only as fine as the instrument that reads it.
 *
 * This is the correction that keeps the design honest. Nobody can set a damper to 62% before
 * anybody can measure anything: what they can do is bank the fire low, middling or high, run it,
 * and see what comes out. So a parameter arrives as a handful of named settings you can tell
 * apart by eye, and it only becomes a number — and only then a curve — when an instrument exists
 * that reads it continuously.
 *
 * The rule the UI must keep: never draw a line between two settings the player has no reason to
 * believe anything lies between. Three settings are three bars, not a curve through three points.
 */

export type ResolutionId = 'ordinal' | 'graded' | 'continuous';

/** What the floor of the spread is at each resolution: the instrument, not the sample. */
const FLOORS: Record<ResolutionId, number> = { ordinal: 0.22, graded: 0.09, continuous: 0.02 };

export interface Observation {
  known: boolean;
  runs: number;
  estimate: number | null;
  lo: number | null;
  hi: number | null;
  spread: number;
  confident?: boolean;
}

/**
 * What a setting is *worth*, which early on is not predicted but measured: run it, wait, and the
 * town reports a rate. The estimate closes on the truth as the sample grows, and it can never be
 * finer than the instrument reading it.
 *
 * Deterministic on purpose. The spread here stands in for variation the simulation will have for
 * real — damp fuel, a slower worker, a coarser batch of clay — so no `Math.random` is needed in
 * the figure or later in `sim/`.
 */
export function observe(truth: number, runs: number, resolution: ResolutionId = 'ordinal'): Observation {
  const floor = FLOORS[resolution];
  const n = Math.max(0, runs);
  if (n === 0) return { known: false, estimate: null, lo: null, hi: null, spread: 1, runs: 0 };
  const spread = Math.max(floor, 0.55 / Math.sqrt(n));
  // A deterministic wobble that shrinks with the sample, standing in for real variation.
  const bias = (hashish(Math.round(truth * 97), n) - 0.5) * spread * 0.8;
  const estimate = truth * (1 + bias);
  return {
    known: true,
    runs: n,
    estimate: round2(estimate),
    lo: round2(estimate * (1 - spread)),
    hi: round2(estimate * (1 + spread)),
    spread: round2(spread),
    confident: spread <= floor * 1.35,
  };
}

function hashish(a: number, b: number): number {
  let h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
  h ^= h >>> 15;
  return ((h >>> 0) % 10000) / 10000;
}
