import { chord, note, ordered, repeat, shift } from '../compose.ts';
import { preset } from '../presets.ts';
import type { Note, Song } from '../types.ts';

/**
 * The square on a market morning: the first piece with a beat under it.
 *
 * G mixolydian — a major scale with the leading note knocked down, which is what keeps a bright
 * tune from sounding like a fanfare. The drum does not arrive until the second turn and the
 * melody until the third, so the piece builds the way the square does.
 */

const G = [55, 59, 62, 67];
const F = [53, 57, 60, 65];
const C = [55, 60, 64, 67];

const PROGRESSION = [G, F, C, G];
const ROOTS = [43, 41, 48, 43];

const BARS = 16;
const bars = Array.from({ length: BARS }, (_, index) => PROGRESSION[index % 4]!);

const pad = bars.flatMap((voicing, bar) => chord(bar * 4, voicing, 3.6, 0.4));

/** A skipping bass, root and fifth, with the octave on the last beat to pull the bar over. */
const bass = bars.flatMap((_, bar) => {
  const root = ROOTS[bar % 4]!;
  return [
    note(bar * 4, root, 0.9, 0.85),
    note(bar * 4 + 1.5, root + 7, 0.5, 0.55),
    note(bar * 4 + 2, root, 0.9, 0.7),
    note(bar * 4 + 3.5, root + 12, 0.4, 0.5),
  ];
});

const FIGURE = [0, 2, 3, 2, 1, 2, 3, 1];

const strings = bars.flatMap((voicing, bar) =>
  FIGURE.map((step, eighth) =>
    note(bar * 4 + eighth * 0.5, voicing[step]! + 12, 0.4, eighth % 2 === 0 ? 0.5 : 0.34),
  ),
);

/** Off the beat as often as on it — a market is not a parade. */
const drumBar = [note(0, 40, 0.2, 0.95), note(2.5, 40, 0.2, 0.7), note(3, 40, 0.2, 0.4)];
const clapBar = [note(1, 58, 0.15, 0.6), note(3, 58, 0.15, 0.65)];
const shakerBar = Array.from({ length: 8 }, (_, eighth) =>
  note(eighth * 0.5, 86, 0.1, eighth % 2 === 0 ? 0.35 : 0.2),
);

const drum = shift(repeat(drumBar, 12, 4), 16);
const clap = shift(repeat(clapBar, 12, 4), 16);
const shaker = shift(repeat(shakerBar, 10, 4), 24);

const phrase: Note[] = [
  note(0, 67, 1),
  note(1, 69, 1),
  note(2, 71, 1.5),
  note(3.5, 72, 0.5, 0.6),
  note(4, 74, 2),
  note(6, 71, 1.5),
  note(7.5, 69, 0.5, 0.6),
  note(8, 67, 1),
  note(9, 65, 1),
  note(10, 67, 2),
  note(12, 62, 1.5),
  note(13.5, 64, 0.5, 0.6),
  note(14, 67, 2),
];

const answer: Note[] = [
  note(0, 74, 1.5),
  note(1.5, 72, 0.5, 0.6),
  note(2, 71, 2),
  note(4, 69, 1),
  note(5, 67, 1),
  note(6, 69, 2),
  note(8, 71, 1.5),
  note(9.5, 72, 0.5, 0.6),
  note(10, 74, 3),
  note(14, 67, 2, 0.6),
];

const melody = [...shift(phrase, 32), ...shift(answer, 48)];

export const MARKET: Song = {
  name: 'market',
  tempo: 112,
  beatsPerBar: 4,
  bars: BARS,
  tracks: [
    { name: 'pad', patch: preset('pad'), gain: 0.7, muted: false, notes: ordered(pad) },
    { name: 'bass', patch: preset('bass'), gain: 0.7, muted: false, notes: ordered(bass) },
    { name: 'strings', patch: preset('pluck'), gain: 0.6, muted: false, notes: ordered(strings) },
    { name: 'melody', patch: preset('reed'), gain: 0.85, muted: false, notes: ordered(melody) },
    { name: 'drum', patch: preset('drum'), gain: 0.75, muted: false, notes: ordered(drum) },
    { name: 'clap', patch: preset('brush'), gain: 0.7, muted: false, notes: ordered(clap) },
    { name: 'shaker', patch: preset('shaker'), gain: 0.8, muted: false, notes: ordered(shaker) },
  ],
};
