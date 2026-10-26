import type { GameMode } from '../sim/simulation.ts';
import type { Link } from './link.ts';
import { WORLD_SCALE } from '../sim/grid.ts';
import { readSave } from './persist.ts';

export type { GameMode };

export const GAME_MODES: readonly GameMode[] = ['settle', 'discover'];

export interface WorldSize {
  name: string;
  scale: number;
  blurb: string;
}

export const WORLD_SIZES: readonly WorldSize[] = [
  { name: 'small', scale: 1, blurb: '2 by 1.4 km, the size the game was made at.' },
  { name: 'medium', scale: 1.5, blurb: '3 by 2.1 km, with plates, rain and lakes that grow with it. Takes longer to build.' },
  { name: 'large', scale: 2, blurb: '4 by 2.8 km. Slow to build and heavy on memory.' },
];

export const sizeName = (scale: number): string => WORLD_SIZES.find((size) => size.scale === scale)?.name ?? `${scale}x`;

export interface Launch {
  slot: string;
  seed: number;
  mode: GameMode;
  size: number;
}

let chosen: Launch | null = null;

let connection: Promise<Link> | null = null;

export function launchWith(launch: Launch): void {
  if (chosen?.slot === launch.slot && connection) return;
  chosen = launch;
  const saved = readSave(launch.slot);
  connection = import('./link.ts').then(({ connect }) => connect({ seed: launch.seed, size: WORLD_SCALE, mode: saved?.mode ?? launch.mode, saved, carry: null }));
}

export function connected(): Promise<Link> {
  if (!connection) throw new Error('The game was opened before anything chose a world');
  return connection;
}

export function launched(): Launch {
  if (!chosen) throw new Error('The game was opened before anything chose a world');
  return chosen;
}
