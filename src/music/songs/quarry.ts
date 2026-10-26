import { chord, hits, note, ordered, repeat, shift } from '../compose.ts';
import { preset } from '../presets.ts';
import type { Note, Song } from '../types.ts';

/**
 * Stone coming out of the ground: a broken beat, a bass that bites, and chords thrown in off
 * the beat.
 *
 * D dorian, and nothing in the piece lands squarely on three — the kick skips it, the stabs sit
 * on the "and", and the only thing holding the middle of the bar is the hat. A straight four
 * here read as a march; the work this is about is people swinging at different times.
 */

const DM = [57, 62, 65, 69];
const GM = [55, 59, 62, 67];
const BB = [58, 62, 65, 70];

const PROGRESSION = [DM, DM, BB, GM];
const ROOTS = [38, 38, 34, 43];

const BARS = 16;
const bars = Array.from({ length: BARS }, (_, index) => PROGRESSION[index % 4]!);

const pad = bars.flatMap((voicing, bar) => chord(bar * 4, voicing, 3.7, 0.3));

/** Sixteenths, mostly rests: a bass riff is as much where it stops as where it plays. */
const RIFF: [number, number][] = [
  [0, 0],
  [0.75, 0],
  [1.5, 0],
  [2, 12],
  [2.5, 0],
  [3, 10],
  [3.5, 12],
];

const bass = bars.flatMap((_, bar) => {
  const root = ROOTS[bar % 4]!;
  return RIFF.map(([at, step]) =>
    note(bar * 4 + at, root + step, 0.4, at === 0 ? 0.95 : 0.65),
  );
});

/** The chord, off the beat, short — a stab is a rhythm part that happens to have notes in it. */
const STABS = [1.5, 2.75, 3.5];

const stabs = bars.flatMap((voicing, bar) =>
  bar % 4 === 1 || bar % 4 === 3
    ? STABS.flatMap((at) => chord(bar * 4 + at, voicing, 0.22, 0.55))
    : chord(bar * 4 + 1.5, voicing, 0.22, 0.5),
);

const KICK = 'X.....x.X.......';
const KICK_B = 'X.....x.X...x...';
const SNARE = '....X.......X...';
const GHOST = '...o..o....o..o.';
const HAT = 'x.xoxox.x.xoxox.';

const kick = [
  ...shift(repeat(hits(KICK, 36), 7, 8), 8),
  ...shift(repeat(hits(KICK_B, 36), 7, 8), 12),
];
const snare = shift(repeat(hits(SNARE, 62), 14, 4), 8);
const ghost = shift(repeat(hits(GHOST, 62), 12, 4), 16);
const body = shift(repeat(hits(SNARE, 64), 14, 4), 8);
const hat = repeat(hits(HAT, 90), 16, 4);

const motif: Note[] = [
  note(0, 74, 0.5),
  note(0.75, 77, 0.5),
  note(1.5, 81, 1),
  note(3, 79, 1),
  note(4.5, 77, 0.5),
  note(5.25, 74, 0.5),
  note(6, 72, 1.5),
  note(8, 77, 0.5),
  note(8.75, 79, 0.5),
  note(9.5, 81, 1.5),
  note(11.5, 79, 0.5),
  note(12, 74, 3),
];

const figure = [...shift(motif, 16), ...shift(motif, 48)];

export const QUARRY: Song = {
  name: 'quarry',
  tempo: 128,
  beatsPerBar: 4,
  bars: BARS,
  tracks: [
    { name: 'pad', patch: preset('pad'), gain: 0.316, muted: false, notes: ordered(pad) },
    { name: 'bass', patch: preset('growl'), gain: 0.505, muted: false, notes: ordered(bass) },
    { name: 'stabs', patch: preset('blade'), gain: 0.38, muted: false, notes: ordered(stabs) },
    { name: 'figure', patch: preset('bell'), gain: 0.348, muted: false, notes: ordered(figure) },
    { name: 'kick', patch: preset('kick'), gain: 0.505, muted: false, notes: ordered(kick) },
    { name: 'snare', patch: preset('snare'), gain: 0.442, muted: false, notes: ordered(snare) },
    { name: 'ghost', patch: preset('snare'), gain: 0.286, muted: false, notes: ordered(ghost) },
    { name: 'body', patch: preset('rim'), gain: 0.348, muted: false, notes: ordered(body) },
    { name: 'hat', patch: preset('hat'), gain: 0.442, muted: false, notes: ordered(hat) },
  ],
};
