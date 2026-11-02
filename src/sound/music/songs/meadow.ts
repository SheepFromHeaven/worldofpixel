import { chord, note, ordered, repeat, shift } from '../compose.ts';
import { preset } from '../presets.ts';
import type { Note, Song } from '../types.ts';

/**
 * The piece a world opens on: a town waking up, four bars going round.
 *
 * D dorian, because the sixth is what keeps a minor key from sounding like a funeral — this is
 * a game about carrying buckets, and the music has to be able to go round forty times without
 * anyone noticing it is going round. The arrangement does the noticing instead: the first turn
 * is only pad and bass, the melody arrives on the second, and the fourth thins out again so the
 * seam back to the top lands somewhere quiet.
 */

const DM = [57, 62, 65, 69];
const BB = [58, 62, 65, 70];
const F = [57, 60, 65, 69];
const C = [55, 60, 64, 67];

const PROGRESSION = [DM, BB, F, C];
const ROOTS = [38, 46, 41, 48];

const BARS = 16;
const bars = Array.from({ length: BARS }, (_, index) => PROGRESSION[index % 4]!);

const pad = bars.flatMap((voicing, bar) => chord(bar * 4, voicing, 3.8, 0.55));

const bass = bars.flatMap((_, bar) => {
  const root = ROOTS[bar % 4]!;
  return [note(bar * 4, root, 2.4, 0.8), note(bar * 4 + 2.5, root + 7, 1.2, 0.5)];
});

/** Up and back down the chord, so the figure turns over rather than climbing out of the song. */
const FIGURE = [0, 2, 1, 3, 2, 1, 0, 2];

const bells = bars.flatMap((voicing, bar) => {
  const cycle = Math.floor(bar / 4);
  const level = cycle === 0 ? 0.3 : cycle === 3 ? 0.34 : 0.46;
  return FIGURE.map((step, eighth) =>
    note(bar * 4 + eighth * 0.5, voicing[step]! + 12, 0.45, eighth % 2 === 0 ? level : level * 0.7),
  );
});

const phraseA: Note[] = [
  note(0, 69, 1.5),
  note(1.5, 72, 0.5, 0.6),
  note(2, 74, 2),
  note(4, 70, 1.5),
  note(5.5, 69, 0.5, 0.6),
  note(6, 65, 2),
  note(8, 69, 1),
  note(9, 72, 1),
  note(10, 74, 1.5),
  note(11.5, 76, 0.5, 0.65),
  note(12, 74, 2),
  note(14, 72, 1.5, 0.7),
];

const phraseB: Note[] = [
  note(0, 74, 1),
  note(1, 76, 1),
  note(2, 77, 2),
  note(4, 74, 1.5),
  note(5.5, 72, 0.5, 0.6),
  note(6, 70, 2),
  note(8, 69, 1),
  note(9, 65, 1),
  note(10, 67, 2),
  note(12, 69, 3),
];

const tail: Note[] = [note(0, 69, 2, 0.6), note(4, 65, 2, 0.55), note(8, 62, 6, 0.5)];

const melody = [...shift(phraseA, 16), ...shift(phraseB, 32), ...shift(tail, 48)];

/** Nothing on the beat: the pad is already there, and a thump under it would be a drum kit. */
const brush = shift(
  repeat([note(1, 60, 0.1, 0.45), note(3, 60, 0.1, 0.5), note(3.5, 60, 0.1, 0.2)], 12, 4),
  16,
);

export const MEADOW: Song = {
  name: 'meadow',
  tempo: 92,
  beatsPerBar: 4,
  bars: BARS,
  tracks: [
    { name: 'pad', patch: preset('pad'), gain: 0.738, muted: false, notes: ordered(pad) },
    { name: 'bass', patch: preset('bass'), gain: 0.656, muted: false, notes: ordered(bass) },
    { name: 'bells', patch: preset('bell'), gain: 0.574, muted: false, notes: ordered(bells) },
    { name: 'melody', patch: preset('reed'), gain: 0.82, muted: false, notes: ordered(melody) },
    { name: 'brush', patch: preset('brush'), gain: 0.492, muted: false, notes: ordered(brush) },
  ],
};
