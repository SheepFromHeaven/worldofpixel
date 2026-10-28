import { growAcacia, growApple, growBaobab, growBirch, growChestnut, growFig, growJungle, growKapok, growOlive, growSnag, growWillow } from './broadleaves.ts';
import { growOak } from './oak.ts';
import { growPalm } from './palm.ts';
import { growCypress, growPine, growSpruce } from './pine.ts';
import type { Grower } from './types.ts';

export const GROWERS: Readonly<Record<string, Grower>> = {
  oak: growOak,
  birch: growBirch,
  chestnut: growChestnut,
  apple: growApple,
  olive: growOlive,
  fig: growFig,
  jungle: growJungle,
  kapok: growKapok,
  willow: growWillow,
  acacia: growAcacia,
  baobab: growBaobab,
  snag: growSnag,
  pine: growPine,
  snowpine: growPine,
  spruce: growSpruce,
  cypress: growCypress,
  palm: growPalm,
};

export const GROWTH_AGE: Readonly<Record<string, number>> = {
  sapling: 0.2,
  young: 0.4,
  low: 0.65,
  mid: 1,
  high: 1.3,
};
