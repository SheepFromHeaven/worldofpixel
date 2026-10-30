import { note, ordered, repeat, shift } from '../compose.ts';
import { preset } from '../presets.ts';
import type { Note, Song } from '../types.ts';

/**
 * The road south: a drone, a hand drum and a snake of a melody.
 *
 * D phrygian dominant — a minor second over a major third, which is the one interval that says
 * *elsewhere* without anybody having to name a country. There is no chord progression at all;
 * the bass holds D and A for sixty-four beats and everything moves against it, which is how
 * music over a drone actually works and is also why it loops without a seam.
 */

const BARS = 16;

const drone = Array.from({ length: BARS / 2 }, (_, pair) => [
  note(pair * 8, 38, 8.4, 0.7),
  note(pair * 8 + 4, 45, 4.4, 0.4),
]).flat();

const OSTINATO = [62, 66, 69, 66, 70, 69, 66, 63];

const ostinato = Array.from({ length: BARS }, (_, bar) =>
  OSTINATO.map((pitch, eighth) =>
    note(
      bar * 4 + eighth * 0.5,
      bar % 8 >= 4 ? pitch + 12 : pitch,
      0.42,
      eighth % 2 === 0 ? 0.55 : 0.35,
    ),
  ),
).flat();

/**
 * A hand drum, not a kit: the low stroke on the palm and the high one on the rim, with the
 * three-then-three-then-two the whole rhythm leans on.
 */
const drumBar = [
  note(0, 36, 0.25, 1),
  note(1.5, 36, 0.25, 0.7),
  note(2, 48, 0.18, 0.5),
  note(3, 36, 0.25, 0.8),
  note(3.5, 48, 0.18, 0.45),
];
const shakerBar = Array.from({ length: 16 }, (_, sixteenth) =>
  note(sixteenth * 0.25, 88, 0.08, sixteenth % 4 === 0 ? 0.32 : sixteenth % 2 === 0 ? 0.2 : 0.12),
);

const drum = shift(repeat(drumBar, 14, 4), 8);
const shaker = shift(repeat(shakerBar, 12, 4), 16);

const snake: Note[] = [
  note(0, 69, 1.5),
  note(1.5, 70, 0.5, 0.6),
  note(2, 69, 1),
  note(3, 66, 1),
  note(4, 67, 1.5),
  note(5.5, 66, 0.5, 0.6),
  note(6, 63, 2),
  note(8, 62, 1),
  note(9, 66, 1),
  note(10, 69, 1.5),
  note(11.5, 70, 0.5, 0.6),
  note(12, 74, 3),
];

const wail: Note[] = [
  note(0, 74, 1),
  note(1, 75, 1),
  note(2, 74, 1),
  note(3, 70, 1),
  note(4, 69, 2.5),
  note(7, 66, 1),
  note(8, 69, 1.5),
  note(9.5, 67, 0.5, 0.6),
  note(10, 66, 1),
  note(11, 63, 1),
  note(12, 62, 3.5),
];

const melody = [...shift(snake, 24), ...shift(wail, 44)];

export const DUNES: Song = {
  name: 'dunes',
  tempo: 124,
  beatsPerBar: 4,
  bars: BARS,
  tracks: [
    { name: 'drone', patch: preset('bass'), gain: 0.7, muted: false, notes: ordered(drone) },
    {
      name: 'ostinato',
      patch: preset('pluck'),
      gain: 0.6,
      muted: false,
      notes: ordered(ostinato),
    },
    { name: 'snake', patch: preset('reed'), gain: 0.8, muted: false, notes: ordered(melody) },
    { name: 'drum', patch: preset('drum'), gain: 0.8, muted: false, notes: ordered(drum) },
    { name: 'shaker', patch: preset('shaker'), gain: 0.6, muted: false, notes: ordered(shaker) },
  ],
};
