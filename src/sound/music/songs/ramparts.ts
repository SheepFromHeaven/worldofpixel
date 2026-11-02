import { chord, hits, note, ordered, repeat, shift } from '../compose.ts';
import { preset } from '../presets.ts';
import type { Note, Song } from '../types.ts';

/**
 * The walls going up: four on the floor, a backbeat, and a sixteenth arpeggio over the top.
 *
 * A minor over i–VI–III–VII, which is the progression every piece of music written for walking
 * towards something has used, and it is that because it never resolves — the last chord wants
 * the first one back. At 140 the arpeggio is the engine and the bass only has to pump.
 *
 * It builds in four-bar steps: arpeggio and hats, then the kick and the bass, then the lead,
 * then the lead answered — so a piece that is the same sixteen bars twice does not sound it.
 */

const AM = [57, 60, 64];
const F = [53, 57, 60, 65];
const C = [55, 60, 64, 67];
const G = [55, 59, 62, 67];

const PROGRESSION = [AM, F, C, G];
const ROOTS = [33, 29, 36, 31];

const BARS = 16;
const bars = Array.from({ length: BARS }, (_, index) => PROGRESSION[index % 4]!);

const pad = bars.flatMap((voicing, bar) => chord(bar * 4, voicing, 3.9, 0.4));

/** Eighths on the root with the octave thrown in: the pump is the point, not the line. */
const PUMP = [0, 0, 12, 0, 0, 12, 0, 7];

const bass = bars.flatMap((_, bar) => {
  const root = ROOTS[bar % 4]!;
  return PUMP.map((step, eighth) =>
    note(bar * 4 + eighth * 0.5, root + step, 0.42, eighth % 2 === 0 ? 0.9 : 0.6),
  );
});

const CLIMB = [0, 1, 2, 1, 2, 1, 0, 1, 2, 3, 2, 1, 2, 1, 0, 1];

const arp = bars.flatMap((voicing, bar) =>
  CLIMB.map((step, sixteenth) =>
    note(
      bar * 4 + sixteenth * 0.25,
      voicing[step % voicing.length]! + 12,
      0.22,
      sixteenth % 4 === 0 ? 0.55 : 0.34,
    ),
  ),
);

const KICK = 'X...X...X...X...';
const SNARE = '....X.......X...';
const GHOST = '..o....o..o....o';
const HAT = 'x.x.x.x.x.x.x.x.';
const OPEN = '..............x.';

const kick = shift(repeat(hits(KICK, 36), 12, 4), 16);
const snare = shift(repeat([...hits(SNARE, 62), ...hits(GHOST, 62)], 12, 4), 16);
const rim = shift(repeat(hits(SNARE, 64), 12, 4), 16);
const hat = repeat(hits(HAT, 90), 16, 4);
const open = shift(repeat(hits(OPEN, 88, 0.25, 0.3), 6, 8), 16);

const call: Note[] = [
  note(0, 69, 1),
  note(1, 72, 0.5),
  note(1.5, 74, 1.5),
  note(3, 72, 1),
  note(4, 69, 2),
  note(6.5, 67, 1.5),
  note(8, 65, 1),
  note(9, 67, 1),
  note(10, 69, 2),
  note(12, 74, 1.5),
  note(13.5, 72, 0.5),
  note(14, 71, 2),
];

const answer: Note[] = [
  note(0, 76, 1),
  note(1, 74, 0.5),
  note(1.5, 72, 1.5),
  note(3, 74, 1),
  note(4, 77, 2),
  note(6.5, 76, 1.5),
  note(8, 74, 1),
  note(9, 72, 1),
  note(10, 69, 1.5),
  note(11.5, 72, 0.5),
  note(12, 74, 4),
];

const lead = [...shift(call, 32), ...shift(answer, 48)];

export const RAMPARTS: Song = {
  name: 'ramparts',
  tempo: 140,
  beatsPerBar: 4,
  bars: BARS,
  tracks: [
    { name: 'pad', patch: preset('pad'), gain: 0.362, muted: false, notes: ordered(pad) },
    { name: 'bass', patch: preset('growl'), gain: 0.431, muted: false, notes: ordered(bass) },
    { name: 'arp', patch: preset('pluck'), gain: 0.33, muted: false, notes: ordered(arp) },
    { name: 'lead', patch: preset('blade'), gain: 0.527, muted: false, notes: ordered(lead) },
    { name: 'kick', patch: preset('kick'), gain: 0.417, muted: false, notes: ordered(kick) },
    { name: 'snare', patch: preset('snare'), gain: 0.417, muted: false, notes: ordered(snare) },
    { name: 'body', patch: preset('rim'), gain: 0.33, muted: false, notes: ordered(rim) },
    { name: 'hat', patch: preset('hat'), gain: 0.461, muted: false, notes: ordered(hat) },
    { name: 'open', patch: preset('openhat'), gain: 0.396, muted: false, notes: ordered(open) },
  ],
};
