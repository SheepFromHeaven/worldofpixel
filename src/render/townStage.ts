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
