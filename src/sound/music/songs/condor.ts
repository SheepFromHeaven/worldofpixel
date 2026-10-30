import { chord, hits, note, ordered, repeat, shift } from '../compose.ts';
import { preset } from '../presets.ts';
import type { Note, Song } from '../types.ts';

/**
 * Thin air and a long way down: pipes over a charango, with a bombo keeping the lilt.
 *
 * A minor pentatonic and nothing else — no second and no sixth, so no phrase can land on a
 * note that wants resolving, and the tune can wander as long as it likes. The harmony is two
 * chords a tone apart (i and VII) rather than a progression, because a cadence would give the
 * piece an ending it is not supposed to have.
 *
 * The lilt is in the bombo: three, three, then two sixteenths, so the bar leans forward twice
 * and lands. Four square beats under this melody turn it into a march.
 */

const SCALE = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79];

const AM = [57, 60, 64];
const G = [55, 59, 62];
const C = [55, 60, 64];

const PROGRESSION = [AM, G, AM, C];

const BARS = 16;
const bars = Array.from({ length: BARS }, (_, index) => PROGRESSION[index % 4]!);

/** The drone is the mountain: A never leaves, whatever the chord above it is doing. */
const drone = Array.from({ length: BARS / 4 }, (_, phrase) => [
  note(phrase * 16, 33, 16.4, 0.55),
  note(phrase * 16 + 8, 45, 8.4, 0.3),
]).flat();

const bass = bars.flatMap((voicing, bar) => [
  note(bar * 4, voicing[0]! - 24, 1.4, 0.7),
  note(bar * 4 + 1.5, voicing[0]! - 12, 0.4, 0.45),
  note(bar * 4 + 2.5, voicing[0]! - 24, 1.2, 0.6),
]);

/** A charango is strummed, not picked: the whole chord, high up, on and off the beat. */
const STRUM = [0, 0.75, 1.5, 2, 2.75, 3.5];

const charango = bars.flatMap((voicing, bar) =>
  STRUM.flatMap((at, index) =>
    chord(
      bar * 4 + at,
      voicing.map((pitch) => pitch + 12),
      0.3,
      index % 2 === 0 ? 0.5 : 0.34,
    ),
  ),
);

const BOMBO = 'X..x..x.X..x..x.';
const RATTLE = 'x.o.x.o.x.o.x.oo';

const bombo = shift(repeat(hits(BOMBO, 36), 14, 4), 8);
const rattle = shift(repeat(hits(RATTLE, 80), 12, 4), 16);

/** Pipes: long notes with a flick of grace before them, the way a quena is actually played. */
const call: Note[] = [
  note(0, 76, 2.5),
  note(2.75, 74, 0.25, 0.5),
  note(3, 72, 1),
  note(4, 69, 3),
  note(7.75, 72, 0.25, 0.5),
  note(8, 74, 2),
  note(10, 72, 1),
  note(11, 69, 1),
  note(12, 67, 3.5),
];

const answer: Note[] = [
  note(0, 72, 1.5),
  note(1.5, 74, 0.5, 0.6),
  note(2, 76, 2),
  note(4, 79, 2.5),
  note(6.75, 76, 0.25, 0.5),
  note(7, 74, 1),
  note(8, 72, 1),
  note(9, 69, 1),
  note(10, 67, 2),
  note(12, 69, 4),
];

const pipes = [...shift(call, 16), ...shift(answer, 32), ...shift(call, 48)];

/** A second pipe a fourth under the first, which is how a pair of them is played up there. */
const under = pipes
  .filter((it) => it.length >= 1)
  .map((it) => {
    const step = SCALE.indexOf(it.pitch);
    const below = step >= 2 ? SCALE[step - 2]! : it.pitch - 5;
    return { ...it, pitch: below, velocity: it.velocity * 0.55 };
  });

export const CONDOR: Song = {
  name: 'condor',
  tempo: 100,
  beatsPerBar: 4,
  bars: BARS,
  tracks: [
    { name: 'drone', patch: preset('pad'), gain: 0.468, muted: false, notes: ordered(drone) },
    { name: 'bass', patch: preset('bass'), gain: 0.504, muted: false, notes: ordered(bass) },
    {
      name: 'charango',
      patch: preset('pluck'),
      gain: 0.396,
      muted: false,
      notes: ordered(charango),
    },
    { name: 'pipes', patch: preset('flute'), gain: 0.648, muted: false, notes: ordered(pipes) },
    { name: 'second', patch: preset('flute'), gain: 0.432, muted: false, notes: ordered(under) },
    { name: 'bombo', patch: preset('drum'), gain: 0.576, muted: false, notes: ordered(bombo) },
    { name: 'rattle', patch: preset('rattle'), gain: 0.36, muted: false, notes: ordered(rattle) },
  ],
};
