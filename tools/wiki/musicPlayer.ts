import { Player } from '../../src/audio/player.ts';
import { openChannel, playVoice } from '../../src/audio/synth.ts';
import type { Channel } from '../../src/audio/synth.ts';
import { hits, repeat } from '../../src/music/compose.ts';
import { PRESETS } from '../../src/music/presets.ts';
import { SONGS } from '../../src/music/songs/index.ts';
import type { Patch } from '../../src/music/types.ts';

/**
 * What makes the wiki's play buttons sound: the game's own synth, bundled for the page.
 *
 * A page about a synthesiser that cannot be heard is a page of tables, and a second synth
 * written in plain JavaScript beside it would drift from the real one by the first patch
 * anybody retuned. So this file is the only thing the wiki ships that imports `src/` and runs
 * in a browser — `tools/wiki/musicBundle.ts` builds it into `docs/wiki/music.js`.
 *
 * What a button plays is this file's business; how it sounds is `src/audio/`.
 */

/** A bar of the kit, one row per voice, in the notation the pieces are written in. */
const ROWS: Record<string, readonly [string, number]> = {
  kick: ['X..x..X...x.X...', 36],
  snare: ['....X.......X..x', 62],
  rim: ['....X.......X...', 64],
  hat: ['x.x.x.x.x.x.x.xx', 90],
  openhat: ['..............x.', 88],
  tom: ['X...x...X..x..x.', 45],
  wood: ['X.....x.....X...', 50],
  rattle: ['x.oox.oox.oox.oo', 76],
  shaker: ['x.x.x.x.x.x.x.oo', 86],
  drum: ['X..x..x.X..x..x.', 36],
  brush: ['....x.......x...', 58],
};

const DEMO_TEMPO = 104;

/** Up an open chord and back: enough to hear the attack, the body and the release. */
const FIGURE = [0, 7, 12, 16, 19, 12];

/** Where a voice sits is its own corner: a bass is tuned low and a bell high. */
const rootOf = (patch: Patch): number =>
  patch.cutoff < 700 ? 38 : patch.cutoff < 2000 ? 57 : 69;

let context: AudioContext | null = null;
let player: Player | null = null;
let channel: Channel | null = null;
let pressed: HTMLButtonElement | null = null;
let ending = 0;

function transport(): Player {
  context ??= new AudioContext();
  if (!player) {
    player = new Player(context);
    player.onEnd = (): void => release();
  }
  return player;
}

function release(): void {
  window.clearTimeout(ending);
  if (!pressed) return;
  pressed.textContent = 'play';
  pressed.classList.remove('on');
  pressed = null;
}

function silence(): void {
  player?.silence();
  channel?.fade(0.06);
  channel = null;
  release();
}

/** One at a time: starting anything stops whatever was sounding. */
function held(button: HTMLButtonElement): boolean {
  const same = pressed === button;
  silence();
  if (same) return false;
  pressed = button;
  button.textContent = 'stop';
  button.classList.add('on');
  return true;
}

function playSong(button: HTMLButtonElement, name: string): void {
  const song = SONGS.find((entry) => entry.name === name);
  if (!song || !held(button)) return;
  const transportPlayer = transport();
  transportPlayer.setSong(song);
  transportPlayer.play(0);
}

function playVoiceDemo(button: HTMLButtonElement, name: string): void {
  const patch = PRESETS[name];
  if (!patch || !held(button)) return;

  const sounding = transport();
  sounding.wake();
  channel = openChannel(sounding.bus);

  const perBeat = 60 / DEMO_TEMPO;
  const row = ROWS[name];
  const notes = row
    ? repeat(hits(row[0], row[1]), 2, 4)
    : FIGURE.map((step, index) => ({
        at: index * 0.5,
        length: index === FIGURE.length - 1 ? 2 : 0.45,
        pitch: rootOf(patch) + step,
        velocity: 0.85,
      }));

  const start = sounding.bus.ctx.currentTime + 0.06;
  let last = 0;
  for (const note of notes) {
    playVoice(channel, patch, note.pitch, note.velocity, start + note.at * perBeat, note.length * perBeat);
    last = Math.max(last, (note.at + note.length) * perBeat);
  }

  ending = window.setTimeout(release, (last + patch.release + 0.2) * 1000);
}

for (const button of document.querySelectorAll<HTMLButtonElement>('button.play')) {
  const song = button.dataset.song;
  const voice = button.dataset.voice;
  button.disabled = false;
  button.addEventListener('click', () => {
    if (song) playSong(button, song);
    else if (voice) playVoiceDemo(button, voice);
  });
}
