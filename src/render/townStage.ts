/**
 * How far a town has got, in the only measure the simulation actually keeps: its buildings.
 *
 * There is no age and no tier in `sim/`, and inventing one to drive a drawing would put a number
 * there that nothing but the renderer reads. Two things ask this — the mark a town is drawn as
 * on the far view, and the material its ledger is written on — and they have to turn over at the
 * same counts, or a town is a village on the map and a hamlet in its own books.
 *
 * The thresholds are the shape of the opening a player actually plays: the fire alone, the first
 * few works round it, a village, and then a town that has outgrown the hand it was laid out by.
 */
export const TOWN_STAGES = ['fire', 'huts', 'village', 'stone'] as const;

export type TownStage = (typeof TOWN_STAGES)[number];

const FROM: readonly { from: number; stage: TownStage }[] = [
  { from: 12, stage: 'stone' },
  { from: 5, stage: 'village' },
  { from: 2, stage: 'huts' },
  { from: 0, stage: 'fire' },
];

export const townStage = (buildings: number): TownStage =>
  FROM.find((rung) => buildings >= rung.from)?.stage ?? 'fire';
