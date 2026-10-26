import { fallAt, softClip } from '../../../src/audio/synth.ts';
import { hits } from '../../../src/music/compose.ts';
import { PRESETS } from '../../../src/music/presets.ts';
import { SONGS } from '../../../src/music/songs/index.ts';
import { hertz, noteName } from '../../../src/music/theory.ts';
import type { Song } from '../../../src/music/types.ts';
import { secondsPerBeat, songBeats } from '../../../src/music/types.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, grid, SERIES, table } from '../page.ts';
import { lineChart, samples } from '../svg.ts';

const ROLL_WIDTH = 760;
const ROLL_HEIGHT = 170;

const TRACK_COLOURS = [
  SERIES.ink,
  SERIES.red,
  SERIES.blue,
  SERIES.green,
  SERIES.gold,
  SERIES.violet,
  SERIES.grey,
];

const seconds = (song: Song): number => songBeats(song) * secondsPerBeat(song.tempo);

/** Enabled by `music.js` once it has loaded, so a page without it offers nothing that is dead. */
const listen = (what: 'song' | 'voice', name: string): string =>
  `<button type="button" class="play" data-${what}="${name}" disabled>play</button>`;

const noteCount = (song: Song): number =>
  song.tracks.reduce((sum, track) => sum + track.notes.length, 0);

function roll(song: Song): string {
  const beats = songBeats(song);
  const pitches = song.tracks.flatMap((track) => track.notes.map((note) => note.pitch));
  const low = Math.min(...pitches);
  const span = Math.max(12, Math.max(...pitches) - low);

  const bars = Array.from({ length: song.bars + 1 }, (_, bar) => {
    const x = ((bar * song.beatsPerBar) / beats) * ROLL_WIDTH;
    return `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${ROLL_HEIGHT}" stroke="${SERIES.grey}" stroke-width="0.5" opacity="0.5" />`;
  }).join('');

  const notes = song.tracks
    .map((track, index) => {
      const colour = TRACK_COLOURS[index % TRACK_COLOURS.length]!;
      const rects = track.notes
        .map((note) => {
          const x = (note.at / beats) * ROLL_WIDTH;
          const width = Math.max(1.5, (note.length / beats) * ROLL_WIDTH);
          const y = ROLL_HEIGHT - 4 - ((note.pitch - low) / span) * (ROLL_HEIGHT - 8);
          return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="2.5" fill="${colour}" opacity="${(0.35 + 0.55 * note.velocity).toFixed(2)}" />`;
        })
        .join('');
      return `<g>${rects}</g>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${ROLL_WIDTH} ${ROLL_HEIGHT}" width="100%" role="img" aria-label="${song.name} as a piano roll">${bars}${notes}</svg>`;
}

function pieces(): string {
  return table(
    ['', 'piece', 'tempo', 'bars', 'length', 'tracks', 'notes'],
    SONGS.map((song) => [
      listen('song', song.name),
      song.name,
      `${Math.round(song.tempo)} bpm`,
      String(song.bars),
      `${seconds(song).toFixed(0)} s`,
      String(song.tracks.length),
      String(noteCount(song)),
    ]),
  );
}

function voices(): string {
  return table(
    ['', 'voice', 'wave', 'attack', 'decay', 'sustain', 'release', 'corner', 'fall'],
    Object.entries(PRESETS).map(([name, patch]) => [
      listen('voice', name),
      name,
      patch.wave,
      `${(patch.attack * 1000).toFixed(0)} ms`,
      `${(patch.decay * 1000).toFixed(0)} ms`,
      patch.sustain.toFixed(2),
      `${(patch.release * 1000).toFixed(0)} ms`,
      `${patch.cutoff} Hz`,
      patch.drop > 0 ? `${patch.drop} cents in ${(patch.dropTime * 1000).toFixed(0)} ms` : '—',
    ]),
  );
}

function pitchFall(): string {
  const kick = PRESETS.kick!;
  const tom = PRESETS.tom!;
  const snare = PRESETS.snare!;

  return figure(
    lineChart({
      label: 'the pitch envelope of the kit',
      x: { label: 'milliseconds after the stroke', domain: [0, 120] },
      y: { label: 'hertz', domain: [0, 1200] },
      series: [
        {
          name: 'kick, note 36',
          colour: SERIES.ink,
          points: samples(0, 120, 120, (ms) => fallAt(kick, hertz(36), ms / 1000)),
        },
        {
          name: 'tom, note 45',
          colour: SERIES.red,
          points: samples(0, 120, 120, (ms) => fallAt(tom, hertz(45), ms / 1000)),
        },
        {
          name: 'snare band, note 62',
          colour: SERIES.blue,
          points: samples(0, 120, 120, (ms) => fallAt(snare, hertz(62) * 8, ms / 1000) / 4),
        },
      ],
      legend: true,
    }),
    'A struck head is tight when it is hit and slackens as it rings. The kick falls from about 290 Hz to its 65 Hz note in fifty milliseconds; the snare sweeps its noise band down instead (drawn at a quarter scale to fit). Flat, every one of them is a sine wave somebody turned off quickly.',
    true,
  );
}

function clipping(): string {
  const curve = softClip();
  const at = (x: number): number => {
    const index = Math.round(((x + 2) / 4) * (curve.length - 1));
    return curve[Math.min(curve.length - 1, Math.max(0, index))] ?? 0;
  };

  return figure(
    lineChart({
      label: 'the soft clipper',
      x: { label: 'in', domain: [0, 2] },
      y: { label: 'out', domain: [0, 1.2] },
      series: [
        { name: 'the curve', colour: SERIES.ink, points: samples(0, 2, 200, at) },
        { name: 'no shaping', colour: SERIES.grey, dashed: true, points: samples(0, 2, 2, (x) => x) },
      ],
      horizontals: [{ at: 1, label: 'the ceiling' }],
      legend: true,
    }),
    'Below the knee the curve is the line y = x and nothing is touched. Above it the output rounds off towards one, so a kick transient saturates instead of being sliced flat.',
    true,
  );
}

const ROW_EXAMPLE = 'X.....x.....X...';

function rows(): string {
  const beats = hits(ROW_EXAMPLE, 45)
    .map((note) => `${note.at.toFixed(2)} (${note.velocity.toFixed(2)})`)
    .join(', ');

  return callout(
    `<p>A drum pattern is a row of characters, one to a sixteenth: <code>X</code> hard, <code>x</code> soft, <code>o</code> a ghost, <code>.</code> a rest. <code>hits('${ROW_EXAMPLE}', 45)</code> is the three-three-two of <em>temple</em>, and comes out as beats ${beats}. Read as a list of beat numbers nobody can see the shape; written as a row, the backbeat and the syncopation are visible in the diff.</p>`,
  );
}

export const LINK: PageLink = {
  slug: 'music',
  title: 'Music',
  summary: 'Eleven pieces played by an oscillator synth: the score, the voices, the kit and the mix.',
};

export function build(): Page {
  const longest = SONGS.reduce((far, song) => Math.max(far, noteCount(song)), 0);
  const total = SONGS.reduce((sum, song) => sum + seconds(song), 0);

  return {
    ...LINK,
    script: 'music.js',
    lede: `The soundtrack is played, not loaded. A piece is notes, a tempo and a handful of oscillator settings — ${SONGS.length} of them, ${(total / 60).toFixed(0)} minutes of music, a few kilobytes each — and the browser's own oscillators make the sound. The same bargain the sprites make: drawn by code out of a shared palette, rather than shipped as pictures.`,
    sections: [
      {
        id: 'pieces',
        title: 'The pieces',
        html: `<p>Press play on any row: the page runs the game's own synth, so what you hear is what the game plays, not a recording of it. Every piece is sixteen bars and loops. Time is in beats and pitch is a MIDI number, so a figure can be moved between pieces without being rewritten and a tune can leave through a MIDI file and come back. The largest here is ${longest} notes.</p>
${pieces()}
<p>They are played in order with a rest between them rather than looped end to end, and the order is a shape: the town wakes, the square fills, the work starts and gets going, evening, high ground and far country, and something coming over the ridge. No two quiet pieces follow each other and no two that drive.</p>
${grid(
  figure(
    roll(SONGS.find((song) => song.name === 'meadow')!),
    `${listen('song', 'meadow')}meadow: pad, bass and bells, the melody arriving on the second turn`,
    true,
  ),
  figure(
    roll(SONGS.find((song) => song.name === 'ramparts')!),
    `${listen('song', 'ramparts')}ramparts: the same sixteen bars with a kit under them, and a sixteenth arpeggio across the middle`,
    true,
  ),
)}</p>`,
      },
      {
        id: 'voices',
        title: 'The voices',
        html: `<p>Each one plays a short figure, or a bar of its own pattern if it is part of the kit. A voice is two oscillators, an envelope and a filter whose corner follows the note. Deliberately small: a synth with forty knobs is one nobody tunes by ear, and every one of these is a thing you can hear move. A track carries its own copy of its patch, so retuning the pad in one piece does not retune it in every other.</p>
${voices()}
<p>The echo is one send for the whole piece rather than a delay per voice, because a room is a property of the room.</p>`,
      },
      {
        id: 'kit',
        title: 'The kit is a pitch envelope',
        html: `<p>Without a falling pitch a drum is a sine wave with the volume turned down fast, and no amount of mixing makes it read as a drum. On a noise voice the band falls instead, which is what gives a snare its crack.</p>
${pitchFall()}
<p>The noise the kit is built from is mostly white, and has to be: every noise voice puts a band filter in front of it, so the source must carry energy wherever that band might sit. Rolled off towards brown, a hi-hat at twelve kilohertz filters a part of the spectrum that is not there and comes out silent.</p>
${rows()}`,
      },
      {
        id: 'mix',
        title: 'The mix',
        html: `<p>Notes are handed to the audio clock a quarter of a second before they sound, in steps of a sixteenth of a beat. The main thread bakes chunks of ground; a tune following it would stutter every time it did.</p>
<p>The whole mix is trimmed before the master, because a patch is tuned on one note and a bar lands eight at once. The limiter is there for the one chord that slips past — and because a compressor has no lookahead, a kick's first millisecond goes straight past it however short the attack. That is what the soft clipper at the end of the chain is for.</p>
${clipping()}
${callout('<p>Measure a change with an <code>OfflineAudioContext</code> render over the <em>whole</em> piece, not a window of one: a window has to schedule the notes that started before it somewhere, and piling them on its first sample invents a peak that is not in the music. End to end, at full volume: peak under 1, nothing at the ceiling, saturation under about one percent of samples, and the pieces within a few decibels of each other.</p>')}`,
      },
      {
        id: 'bench',
        title: 'Where a piece is written',
        html: `<p><code>/studio</code> is the composer, the sprite lab's opposite number. It opens on a shelf of every piece with a thumbnail of its parts, and opening one gives a piano roll, the voice's knobs beside it, and the module to paste back into <code>src/music/songs/</code>. It plays through the game's own synth, so what is tuned there is what is heard in the game.</p>
<p>It reads and writes standard MIDI files, which lose two things on the way: a patch cannot be written into one, so an imported track lands on a preset guessed from where it sits on the keyboard; and one channel has nowhere to put two of the same pitch at once, so a note held past the next sounding of its own pitch is cut short at it. Middle C is ${noteName(60)} here because it is ${noteName(60)} in every other tool.</p>`,
      },
    ],
  };
}
