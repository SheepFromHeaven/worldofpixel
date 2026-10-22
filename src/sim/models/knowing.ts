import { round2 } from './units.ts';

export type ResolutionId = 'ordinal' | 'graded' | 'continuous';

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

export function observe(truth: number, runs: number, resolution: ResolutionId = 'ordinal'): Observation {
  const floor = FLOORS[resolution];
  const n = Math.max(0, runs);
  if (n === 0) return { known: false, estimate: null, lo: null, hi: null, spread: 1, runs: 0 };
  const spread = Math.max(floor, 0.55 / Math.sqrt(n));
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
