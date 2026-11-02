import type { Patch, Song, Track } from './types.ts';

/**
 * A song as the module that would produce it.
 *
 * The composer is a bench, not a storehouse: a piece that only exists in a browser tab is one
 * commit away from being lost, and the soundtrack has to be in the repository with everything
 * else that is drawn by hand. This is the paste that carries it back, in the shape the files in
 * `songs/` already use — explicit notes, because by the time a tune leaves the composer every
 * one of them has been moved by ear.
 */

const round = (value: number, places = 3): string => {
  const fixed = Number(value.toFixed(places));
  return Number.isInteger(fixed) ? fixed.toFixed(0) : String(fixed);
};

const quoted = (value: string): string => `'${value.replace(/'/g, "\\'")}'`;

function patchSource(patch: Patch, indent: string): string {
  const fields: [keyof Patch, string][] = [
    ['wave', quoted(patch.wave)],
    ['spread', round(patch.spread, 1)],
    ['attack', round(patch.attack)],
    ['decay', round(patch.decay)],
    ['sustain', round(patch.sustain)],
    ['release', round(patch.release)],
    ['cutoff', round(patch.cutoff, 0)],
    ['resonance', round(patch.resonance, 2)],
    ['tracking', round(patch.tracking, 2)],
    ['vibrato', round(patch.vibrato, 1)],
    ['vibratoRate', round(patch.vibratoRate, 2)],
    ['drop', round(patch.drop, 0)],
    ['dropTime', round(patch.dropTime)],
    ['gain', round(patch.gain, 2)],
    ['echo', round(patch.echo, 2)],
  ];

  const lines = fields.map(([name, value]) => `${indent}  ${name}: ${value},`);
  return `{\n${lines.join('\n')}\n${indent}}`;
}

function trackSource(track: Track): string {
  const notes = track.notes.map(
    (note) =>
      `      { at: ${round(note.at)}, length: ${round(note.length)},` +
      ` pitch: ${round(note.pitch, 0)}, velocity: ${round(note.velocity, 2)} },`,
  );

  return [
    '    {',
    `      name: ${quoted(track.name)},`,
    `      gain: ${round(track.gain, 2)},`,
    `      muted: ${track.muted},`,
    `      patch: ${patchSource(track.patch, '      ')},`,
    '      notes: [',
    ...notes,
    '      ],',
    '    },',
  ].join('\n');
}

export function songToSource(song: Song): string {
  const constant = song.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

  return [
    "import type { Song } from '../types.ts';",
    '',
    `export const ${constant || 'SONG'}: Song = {`,
    `  name: ${quoted(song.name)},`,
    `  tempo: ${round(song.tempo, 2)},`,
    `  beatsPerBar: ${round(song.beatsPerBar, 0)},`,
    `  bars: ${round(song.bars, 0)},`,
    '  tracks: [',
    ...song.tracks.map(trackSource),
    '  ],',
    '};',
    '',
  ].join('\n');
}
