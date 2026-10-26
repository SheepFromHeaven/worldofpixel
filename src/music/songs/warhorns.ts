import { chord, hits, note, ordered, repeat, shift } from '../compose.ts';
import { preset } from '../presets.ts';
import type { Note, Song } from '../types.ts';

/**
 * Something is coming over the ridge: toms, horns in fifths, and a major chord in a minor key.
 *
 * D harmonic minor, which exists for this — the raised seventh turns the fifth chord major, and
 * an A major leaning on a D minor is the oldest sound of alarm there is. The horns are played
 * as bare fifths rather than triads, because a third in a low register turns to mud and because
 * a fifth is what a horn can actually sound.
 *
 * The toms carry it rather than a kit: a drum you can hear the pitch of is a drum being beaten
 * by somebody, where a four-on-the-floor would be a machine.
 */

const DM = [50, 57, 62];
const BB = [46, 53, 58];
const GM = [43, 50, 55];
const A = [45, 52, 57, 61];

const PROGRESSION = [DM, BB, GM, A];
const ROOTS = [38, 34, 31, 33];

const BARS = 16;
const bars = Array.from({ length: BARS }, (_, index) => PROGRESSION[index % 4]!);

/** Fifths, held a whole bar, with the top voice an octave up on the last turn. */
const horns = bars.flatMap((voicing, bar) =>
  chord(bar * 4, bar >= 12 ? [...voicing, voicing[0]! + 24] : voicing, 3.7, 0.5),
);

const pad = bars.flatMap((voicing, bar) => chord(bar * 4, [voicing[0]! + 12], 4, 0.3));

const bass = bars.flatMap((_, bar) => {
  const root = ROOTS[bar % 4]!;
  return [
    note(bar * 4, root, 1.4, 0.95),
    note(bar * 4 + 1.5, root, 0.4, 0.6),
    note(bar * 4 + 2, root, 1.4, 0.85),
    note(bar * 4 + 3.5, root + 7, 0.4, 0.55),
  ];
});

const LOW = 'X...x...X...x..x';
const MID = '..x...x...x...x.';
const HIGH = '............x.x.';
const KICK = 'X.......X.......';
const SNARE = '....X.......X..x';
const HAT = 'x.x.x.x.x.x.x.x.';
/** A roll across the last bar of each eight: the four beats before the thing arrives. */
const ROLL = 'xxxxxxxxXxXxXXXX';

const low = repeat(hits(LOW, 45), 16, 4);
const mid = shift(repeat(hits(MID, 52), 12, 4), 16);
const high = shift(repeat(hits(HIGH, 57), 8, 4), 32);
const kick = shift(repeat(hits(KICK, 36), 12, 4), 16);
const snare = shift(repeat(hits(SNARE, 62), 8, 4), 32);
const hat = shift(repeat(hits(HAT, 90), 8, 4), 32);
const roll = [...shift(hits(ROLL, 52), 28), ...shift(hits(ROLL, 57), 60)];

const horncall: Note[] = [
  note(0, 69, 1.5),
  note(1.5, 70, 0.5),
  note(2, 69, 1),
  note(3, 65, 1),
  note(4, 62, 2.5),
  note(7, 69, 1),
  note(8, 73, 1.5),
  note(9.5, 74, 2.5),
  note(12, 73, 1),
  note(13, 69, 3),
];

export const WARHORNS: Song = {
  name: 'warhorns',
  tempo: 150,
  beatsPerBar: 4,
  bars: BARS,
  tracks: [
    { name: 'horns', patch: preset('reed'), gain: 0.54, muted: false, notes: ordered(horns) },
    { name: 'pad', patch: preset('pad'), gain: 0.304, muted: false, notes: ordered(pad) },
    { name: 'bass', patch: preset('growl'), gain: 0.454, muted: false, notes: ordered(bass) },
    {
      name: 'call',
      patch: preset('blade'),
      gain: 0.507,
      muted: false,
      notes: ordered(shift(horncall, 32)),
    },
    { name: 'toms low', patch: preset('tom'), gain: 0.391, muted: false, notes: ordered(low) },
    { name: 'toms mid', patch: preset('tom'), gain: 0.406, muted: false, notes: ordered(mid) },
    { name: 'toms high', patch: preset('tom'), gain: 0.339, muted: false, notes: ordered(high) },
    { name: 'roll', patch: preset('tom'), gain: 0.3, muted: false, notes: ordered(roll) },
    { name: 'kick', patch: preset('kick'), gain: 0.404, muted: false, notes: ordered(kick) },
    { name: 'snare', patch: preset('snare'), gain: 0.439, muted: false, notes: ordered(snare) },
    { name: 'hat', patch: preset('hat'), gain: 0.372, muted: false, notes: ordered(hat) },
  ],
};
