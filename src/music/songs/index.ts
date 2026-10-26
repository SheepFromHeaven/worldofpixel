import { CONDOR } from './condor.ts';
import { DUNES } from './dunes.ts';
import { DUSK } from './dusk.ts';
import { FORGE } from './forge.ts';
import { MARKET } from './market.ts';
import { MEADOW } from './meadow.ts';
import { MISTFELL } from './mistfell.ts';
import { QUARRY } from './quarry.ts';
import { RAMPARTS } from './ramparts.ts';
import { TEMPLE } from './temple.ts';
import { WARHORNS } from './warhorns.ts';
import type { Song } from '../types.ts';

/**
 * Declaration order is the order they are played in, like everything else here, and the order
 * is a shape: the town wakes, the square fills, the work starts and gets going, evening, high
 * ground and far country, and something coming over the ridge. Two quiet pieces never follow
 * each other and neither do two that drive — a soundtrack that is loud for ten minutes is one
 * that gets turned off.
 */
export const SONGS: readonly Song[] = [
  MEADOW,
  MARKET,
  FORGE,
  RAMPARTS,
  DUSK,
  CONDOR,
  QUARRY,
  MISTFELL,
  TEMPLE,
  DUNES,
  WARHORNS,
];

export {
  CONDOR,
  DUNES,
  DUSK,
  FORGE,
  MARKET,
  MEADOW,
  MISTFELL,
  QUARRY,
  RAMPARTS,
  TEMPLE,
  WARHORNS,
};
