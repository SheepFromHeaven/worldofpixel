import { chord, note, ordered, shift } from '../compose.ts';
import { preset } from '../presets.ts';
import type { Note, Song } from '../types.ts';

/**
 * The second piece, for when the first has been round enough times.
 *
 * Slower, lower, and with no melody to speak of — a soundtrack that is always singing at you is
 * one the player turns off. Two pieces and a gap between them is most of what keeps the music
 * from becoming a noise in the room.
 */

const AM = [57, 60, 64, 69];
const FM = [53, 57, 60, 65];
const CM = [55, 60, 64, 67];
const GM = [55, 59, 62, 67];

const PROGRESSION = [AM, FM, CM, GM];
const ROOTS = [33, 41, 36, 43];

const BARS = 16;
const bars = Array.from({ length: BARS }, (_, index) => PROGRESSION[index % 4]!);

const pad = bars.flatMap((voicing, bar) => chord(bar * 4, voicing, 4.4, 0.5));

const bass = bars.flatMap((_, bar) => [note(bar * 4, ROOTS[bar % 4]!, 3.4, 0.7)]);

/** One note a bar at the top, moved about inside the chord — a drip, not a tune. */
const DROPS = [3, 2, 3, 1, 2, 3, 1, 2];

const drops = bars.flatMap((voicing, bar) => {
  if (bar % 2 === 1) return [];
  const step = DROPS[(bar / 2) % DROPS.length]!;
  return [note(bar * 4 + 2.5, voicing[step]! + 12, 2, 0.34)];
});

const answer: Note[] = [note(0, 69, 3, 0.4), note(4, 67, 3, 0.36), note(8, 64, 5, 0.33)];

export const DUSK: Song = {
  name: 'dusk',
  tempo: 66,
  beatsPerBar: 4,
  bars: BARS,
  tracks: [
    { name: 'pad', patch: preset('pad'), gain: 1.05, muted: false, notes: ordered(pad) },
    { name: 'bass', patch: preset('bass'), gain: 0.75, muted: false, notes: ordered(bass) },
    { name: 'drops', patch: preset('bell'), gain: 0.75, muted: false, notes: ordered(drops) },
    {
      name: 'answer',
      patch: preset('pluck'),
      gain: 0.85,
      muted: false,
      notes: ordered(shift(answer, 32)),
    },
  ],
};
