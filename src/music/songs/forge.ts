import { chord, note, ordered, repeat, shift } from '../compose.ts';
import { preset } from '../presets.ts';
import type { Note, Song } from '../types.ts';

/**
 * Work: a drone, an ostinato, and a hammer falling on the beat.
 *
 * The hammer is two voices a hair apart — the drum is the blow landing and the bell an octave
 * and a half above it is the ring that comes off the anvil. One drawing of a hammer blow never
 * sounds like one; the thud and the ring are two different things arriving together.
 */

const AM = [57, 60, 64];
const FM = [53, 57, 60, 65];
const GM = [55, 59, 62, 67];

const PROGRESSION = [AM, AM, FM, GM];

const BARS = 16;
const bars = Array.from({ length: BARS }, (_, index) => PROGRESSION[index % 4]!);

const pad = bars.flatMap((voicing, bar) => chord(bar * 4, voicing, 4, 0.42));

/** A pedal: the low A never leaves, which is what makes the F and the G lean. */
const bass = bars.flatMap((_, bar) => [
  note(bar * 4, 33, 2.2, 0.8),
  note(bar * 4 + 2, 45, 0.8, 0.5),
  note(bar * 4 + 3, 45, 0.6, 0.42),
]);

const RIFF = [57, 60, 62, 64, 62, 60, 57, 55];

const riff = bars.flatMap((_, bar) =>
  RIFF.map((pitch, eighth) =>
    note(
      bar * 4 + eighth * 0.5,
      bar % 4 === 2 ? pitch - 4 : bar % 4 === 3 ? pitch - 2 : pitch,
      0.42,
      eighth % 2 === 0 ? 0.55 : 0.38,
    ),
  ),
);

const blowBar = [note(0, 36, 0.3, 1), note(2, 36, 0.3, 0.85)];
const ringBar = [note(0, 81, 0.6, 0.3), note(2, 84, 0.5, 0.24)];
/** The off-beat tap is the smith turning the iron between blows. */
const tapBar = [note(1.5, 62, 0.1, 0.3), note(3.5, 62, 0.1, 0.22)];

const blow = shift(repeat(blowBar, 12, 4), 16);
const ring = shift(repeat(ringBar, 12, 4), 16);
const tap = shift(repeat(tapBar, 8, 4), 32);

const call: Note[] = [
  note(0, 69, 2),
  note(2, 72, 1.5),
  note(3.5, 71, 0.5, 0.6),
  note(4, 69, 3),
  note(8, 65, 2),
  note(10, 67, 1.5),
  note(11.5, 69, 0.5, 0.6),
  note(12, 72, 3.5),
];

export const FORGE: Song = {
  name: 'forge',
  tempo: 96,
  beatsPerBar: 4,
  bars: BARS,
  tracks: [
    { name: 'pad', patch: preset('pad'), gain: 0.7, muted: false, notes: ordered(pad) },
    { name: 'drone', patch: preset('bass'), gain: 0.75, muted: false, notes: ordered(bass) },
    { name: 'riff', patch: preset('pluck'), gain: 0.6, muted: false, notes: ordered(riff) },
    { name: 'call', patch: preset('reed'), gain: 0.8, muted: false, notes: ordered(shift(call, 32)) },
    { name: 'hammer', patch: preset('drum'), gain: 0.8, muted: false, notes: ordered(blow) },
    { name: 'anvil', patch: preset('bell'), gain: 0.6, muted: false, notes: ordered(ring) },
    { name: 'tongs', patch: preset('shaker'), gain: 0.7, muted: false, notes: ordered(tap) },
  ],
};
