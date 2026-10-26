import { chord, note, ordered, shift } from '../compose.ts';
import { preset } from '../presets.ts';
import type { Note, Song } from '../types.ts';

/**
 * High ground in weather: slow, wide, and with nothing keeping time.
 *
 * C lydian — the sharpened fourth is the one interval that sounds like somewhere rather than
 * something, which is why every map of an enchanted wood ever drawn has been scored in it. The
 * chords are four bars long rather than one, so the piece has a pulse of about fifteen seconds
 * and the ear stops counting.
 */

const ONE = [55, 60, 64, 71];
const TWO = [57, 62, 66, 69];
const THREE = [55, 59, 62, 67];
const FOUR = [57, 60, 64, 69];

const PROGRESSION = [ONE, TWO, THREE, FOUR];

const BARS = 16;

/** One chord every four bars, held right across the join so nothing ever quite lands. */
const pad = PROGRESSION.flatMap((voicing, phrase) => chord(phrase * 16, voicing, 17, 0.46));

const ROOTS = [36, 38, 43, 33];
const bass = PROGRESSION.flatMap((_, phrase) => [
  note(phrase * 16, ROOTS[phrase]!, 9, 0.6),
  note(phrase * 16 + 10, ROOTS[phrase]! + 7, 5, 0.4),
]);

/** Drops: the only thing in the piece that moves, and never twice in the same place. */
const DROPS: [number, number][] = [
  [2.5, 3],
  [7, 2],
  [11.5, 1],
  [14, 3],
  [19, 2],
  [23.5, 3],
  [27, 0],
  [34.5, 2],
  [39, 3],
  [43.5, 1],
  [50, 2],
  [55.5, 3],
  [59, 1],
];

const drops = DROPS.map(([at, step]) => {
  const voicing = PROGRESSION[Math.floor(at / 16) % 4]!;
  return note(at, voicing[step]! + 12, 2.5, 0.3);
});

const air: Note[] = [
  note(0, 72, 4, 0.4),
  note(5, 76, 3, 0.36),
  note(9, 74, 6, 0.34),
  note(17, 71, 4, 0.36),
  note(22, 69, 7, 0.3),
];

export const MISTFELL: Song = {
  name: 'mistfell',
  tempo: 58,
  beatsPerBar: 4,
  bars: BARS,
  tracks: [
    { name: 'pad', patch: preset('pad'), gain: 1.3, muted: false, notes: ordered(pad) },
    { name: 'deep', patch: preset('bass'), gain: 0.85, muted: false, notes: ordered(bass) },
    { name: 'drops', patch: preset('bell'), gain: 0.8, muted: false, notes: ordered(drops) },
    { name: 'air', patch: preset('reed'), gain: 0.8, muted: false, notes: ordered(shift(air, 26)) },
  ],
};
