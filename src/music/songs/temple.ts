import { chord, hits, note, ordered, repeat, shift } from '../compose.ts';
import { preset } from '../presets.ts';
import type { Note, Song } from '../types.ts';

/**
 * Stone steps in heat: log drums in three against the beat, rattles, and an ocarina over a
 * conch-shell drone.
 *
 * The rhythm is the piece. The low log falls three, three, two — the oldest asymmetric figure
 * there is — while the high one strikes every third sixteenth, so the two agree only once a
 * bar and the floor seems to turn under the beat. Written straight, with both on the quarter,
 * exactly the same drums read as a drum machine.
 *
 * D minor pentatonic for the melody, and the harmony is two notes: D and A, held. A chord
 * progression would be a European idea arriving by the back door, and the drone is what the
 * conch is actually doing.
 */

const BARS = 16;

/** A conch is one long breath, taken again when it runs out. */
const conch = Array.from({ length: BARS / 4 }, (_, phrase) => [
  ...chord(phrase * 16, [38, 45], 9, 0.5),
  ...chord(phrase * 16 + 9.5, [38, 45, 50], 6.9, 0.42),
]).flat();

/** Three, three, two — in sixteenths, so the bar leans twice and then settles. */
const LOW = 'X.....x.....X...';
const LOW_B = 'X.....x.....X.x.';
/** Every third sixteenth: it crosses the bar line and only agrees with the low drum at the top. */
const HIGH = '..x..x..x..x..x.';
const RATTLE = 'x.oox.oox.oox.oo';
const SHAKE = 'o.o.o.o.o.o.o.oo';

const low = [
  ...shift(repeat(hits(LOW, 45), 7, 4), 0),
  ...shift(repeat(hits(LOW_B, 45), 9, 4), 28),
];
const high = shift(repeat(hits(HIGH, 57), 12, 4), 16);
const rattle = shift(repeat(hits(RATTLE, 76), 14, 4), 8);
const shake = shift(repeat(hits(SHAKE, 84), 8, 4), 32);

/** One deep stroke a bar, on the one, and nothing else: it is a ceremony, not a groove. */
const deep = shift(repeat([note(0, 33, 0.4, 0.9)], 12, 4), 16);

const first: Note[] = [
  note(0, 74, 1.5),
  note(1.5, 72, 0.5, 0.55),
  note(2, 69, 2),
  note(4.5, 67, 1.5),
  note(6, 69, 2),
  note(8, 74, 1),
  note(9, 77, 3),
  note(13, 74, 2.5),
];

const second: Note[] = [
  note(0, 69, 1),
  note(1, 72, 1),
  note(2, 74, 1.5),
  note(3.5, 72, 0.5, 0.55),
  note(4, 69, 2.5),
  note(7, 65, 1),
  note(8, 67, 1.5),
  note(9.5, 69, 0.5, 0.55),
  note(10, 62, 4),
];

const ocarina = [...shift(first, 16), ...shift(second, 44)];

/** The answer a step down the same scale, a bar later, as if from across the court. */
const echoed = shift(ocarina, 4).map((it) => ({
  ...it,
  pitch: it.pitch - 12,
  velocity: it.velocity * 0.45,
}));

export const TEMPLE: Song = {
  name: 'temple',
  tempo: 84,
  beatsPerBar: 4,
  bars: BARS,
  tracks: [
    { name: 'conch', patch: preset('pad'), gain: 0.7, muted: false, notes: ordered(conch) },
    { name: 'ocarina', patch: preset('flute'), gain: 0.85, muted: false, notes: ordered(ocarina) },
    { name: 'across', patch: preset('flute'), gain: 0.45, muted: false, notes: ordered(echoed) },
    { name: 'log low', patch: preset('wood'), gain: 0.8, muted: false, notes: ordered(low) },
    { name: 'log high', patch: preset('wood'), gain: 0.5, muted: false, notes: ordered(high) },
    { name: 'deep', patch: preset('drum'), gain: 0.7, muted: false, notes: ordered(deep) },
    { name: 'rattle', patch: preset('rattle'), gain: 0.55, muted: false, notes: ordered(rattle) },
    { name: 'shake', patch: preset('rattle'), gain: 0.4, muted: false, notes: ordered(shake) },
  ],
};
