import { Player } from '../audio/player.ts';

/**
 * One transport for the whole bench.
 *
 * The shelf previews a piece and the editor plays the one it is working on, and those are the
 * same act: two players would be two audio contexts, two clocks and — the moment one is left
 * running behind the other — two pieces at once. It is built on the first call rather than at
 * load, because a context made before the page has been touched starts suspended.
 */

let player: Player | null = null;
let level = 0.8;

export function transport(): Player {
  if (!player) {
    player = new Player(new AudioContext());
    player.loop = true;
    player.setVolume(level, 0);
  }
  return player;
}

export const volume = (): number => level;

export function setVolume(next: number): void {
  level = Math.max(0, Math.min(1, next));
  player?.setVolume(level, 0.05);
}
