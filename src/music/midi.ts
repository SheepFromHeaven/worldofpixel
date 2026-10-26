import { preset } from './presets.ts';
import type { Note, Song, Track } from './types.ts';
import { songBeats } from './types.ts';

/**
 * Standard MIDI files, in and out.
 *
 * The composer is the place a tune is written, but it must not be the only place one can come
 * from or go to: a melody hummed into any other tool arrives here as a file, and a piece worked
 * out here can be taken away and played on something with a real piano in it. A format of our
 * own would make the composer a room with one door.
 *
 * What travels is the notes and the tempo. A patch does not — there is no honest way to write
 * "this one is our pad with the corner at 620 hertz" into a MIDI file, so an imported track
 * lands on a preset guessed from where it sits on the keyboard and is tuned by ear afterwards.
 */

/** Ticks to a quarter note on the way out. Divides every length the composer can write. */
const DIVISION = 480;

const TEMPO = 0x51;
const TIME_SIGNATURE = 0x58;
const TRACK_NAME = 0x03;

/** The denominator of a time signature is written as its power of two; 2 is a quarter note. */
const QUARTER = 2;
const END_OF_TRACK = 0x2f;

function varint(value: number): number[] {
  const bytes = [value & 0x7f];
  let rest = value >>> 7;
  while (rest > 0) {
    bytes.unshift((rest & 0x7f) | 0x80);
    rest >>>= 7;
  }
  return bytes;
}

const text = (value: string): number[] => [...value].map((char) => char.charCodeAt(0) & 0x7f);

const chunk = (tag: string, body: readonly number[]): number[] => [
  ...text(tag),
  (body.length >>> 24) & 0xff,
  (body.length >>> 16) & 0xff,
  (body.length >>> 8) & 0xff,
  body.length & 0xff,
  ...body,
];

/** 9 is the drum channel in every other tool, so nothing of ours is put on it. */
const channelFor = (index: number): number => {
  const channel = index % 15;
  return channel < 9 ? channel : channel + 1;
};

type Event = { tick: number; order: number; bytes: readonly number[] };

function trackChunk(events: readonly Event[]): number[] {
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order);
  const body: number[] = [];
  let at = 0;

  for (const event of sorted) {
    body.push(...varint(event.tick - at), ...event.bytes);
    at = event.tick;
  }

  body.push(...varint(0), 0xff, END_OF_TRACK, 0x00);
  return chunk('MTrk', body);
}

/**
 * A note held past the next sounding of the same pitch, cut short at it.
 *
 * MIDI has nowhere to put two of one pitch at once on one channel — a note-off says which note
 * it is only by its number — so a pad whose chords overlap by a beat would come back out of any
 * other tool with half its notes swallowed. Shortening them here loses the overlap and keeps
 * the piece; the alternative is a file that is wrong everywhere except in this repository.
 */
function clipOverlaps(notes: readonly Note[]): Note[] {
  const next = new Map<number, number>();
  const out: Note[] = [];

  for (const note of [...notes].sort((a, b) => b.at - a.at)) {
    const after = next.get(note.pitch);
    const length =
      after === undefined ? note.length : Math.min(note.length, Math.max(1 / 64, after - note.at));
    out.push(length === note.length ? note : { ...note, length });
    next.set(note.pitch, note.at);
  }

  return out.reverse();
}

export function encodeMidi(song: Song): Uint8Array {
  const header = chunk('MThd', [
    0x00,
    0x01,
    (song.tracks.length + 1) >>> 8,
    (song.tracks.length + 1) & 0xff,
    (DIVISION >>> 8) & 0xff,
    DIVISION & 0xff,
  ]);

  const microseconds = Math.round(60_000_000 / song.tempo);
  const conductor = trackChunk([
    { tick: 0, order: 0, bytes: [0xff, TRACK_NAME, song.name.length, ...text(song.name)] },
    {
      tick: 0,
      order: 1,
      bytes: [
        0xff,
        TEMPO,
        0x03,
        (microseconds >>> 16) & 0xff,
        (microseconds >>> 8) & 0xff,
        microseconds & 0xff,
      ],
    },
    { tick: 0, order: 2, bytes: [0xff, TIME_SIGNATURE, 0x04, song.beatsPerBar, QUARTER, 24, 8] },
  ]);

  const tracks = song.tracks.map((track, index) => {
    const channel = channelFor(index);
    const events: Event[] = [
      { tick: 0, order: 0, bytes: [0xff, TRACK_NAME, track.name.length, ...text(track.name)] },
    ];

    for (const note of clipOverlaps(track.notes)) {
      const velocity = Math.max(1, Math.min(127, Math.round(note.velocity * 127)));
      const pitch = Math.max(0, Math.min(127, Math.round(note.pitch)));
      const on = Math.round(note.at * DIVISION);
      const off = Math.max(on + 1, Math.round((note.at + note.length) * DIVISION));
      // Offs before ons at the same tick, or a repeated note cuts its own successor short.
      events.push({ tick: on, order: 2, bytes: [0x90 | channel, pitch, velocity] });
      events.push({ tick: off, order: 1, bytes: [0x80 | channel, pitch, 0x40] });
    }

    return trackChunk(events);
  });

  return Uint8Array.from([...header, ...conductor, ...tracks.flat()]);
}

class Reader {
  private at = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get done(): boolean {
    return this.at >= this.bytes.length;
  }

  get position(): number {
    return this.at;
  }

  byte(): number {
    const value = this.bytes[this.at];
    if (value === undefined) throw new Error('midi: ran off the end of the file');
    this.at += 1;
    return value;
  }

  word(): number {
    return (this.byte() << 8) | this.byte();
  }

  long(): number {
    return ((this.byte() << 24) | (this.byte() << 16) | (this.byte() << 8) | this.byte()) >>> 0;
  }

  tag(): string {
    return String.fromCharCode(this.byte(), this.byte(), this.byte(), this.byte());
  }

  skip(count: number): void {
    this.at += count;
  }

  varint(): number {
    let value = 0;
    for (;;) {
      const byte = this.byte();
      value = (value << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) return value;
    }
  }
}

type Pending = { tick: number; velocity: number };

const patchFor = (channel: number, notes: readonly Note[]): string => {
  if (channel === 9) return 'brush';
  const average = notes.reduce((sum, note) => sum + note.pitch, 0) / Math.max(1, notes.length);
  if (average < 48) return 'bass';
  if (average > 76) return 'bell';
  return 'pluck';
};

export function decodeMidi(bytes: Uint8Array, name = 'imported'): Song {
  const reader = new Reader(bytes);
  if (reader.tag() !== 'MThd') throw new Error('midi: not a standard MIDI file');

  reader.long();
  reader.word();
  const count = reader.word();
  const division = reader.word();
  if ((division & 0x8000) !== 0) throw new Error('midi: SMPTE timing is not supported');

  let tempo = 120;
  let beatsPerBar = 4;
  const tracks: Track[] = [];

  for (let index = 0; index < count && !reader.done; index += 1) {
    const tag = reader.tag();
    const length = reader.long();
    const end = reader.position + length;
    if (tag !== 'MTrk') {
      reader.skip(length);
      continue;
    }

    const notes: Note[] = [];
    const pending = new Map<number, Pending>();
    let label = '';
    let channel = 0;
    let tick = 0;
    let status = 0;

    while (reader.position < end) {
      tick += reader.varint();
      let byte = reader.byte();
      if (byte < 0x80) {
        // Running status: a stream of note-ons writes the status byte once.
        reader.skip(-1);
        byte = status;
      } else if (byte < 0xf0) {
        status = byte;
      }

      if (byte === 0xff) {
        const kind = reader.byte();
        const size = reader.varint();
        const from = reader.position;
        if (kind === TEMPO && size === 3) {
          tempo = 60_000_000 / ((reader.byte() << 16) | (reader.byte() << 8) | reader.byte());
        } else if (kind === TIME_SIGNATURE && size >= 2) {
          beatsPerBar = Math.max(1, reader.byte());
        } else if (kind === TRACK_NAME) {
          for (let i = 0; i < size; i += 1) label += String.fromCharCode(reader.byte());
        }
        reader.skip(from + size - reader.position);
        continue;
      }

      if (byte === 0xf0 || byte === 0xf7) {
        reader.skip(reader.varint());
        continue;
      }

      const kind = byte & 0xf0;
      channel = byte & 0x0f;
      const first = reader.byte();
      const second = kind === 0xc0 || kind === 0xd0 ? 0 : reader.byte();

      if (kind === 0x90 && second > 0) {
        pending.set(first, { tick, velocity: second / 127 });
      } else if (kind === 0x80 || kind === 0x90) {
        const held = pending.get(first);
        if (held) {
          pending.delete(first);
          notes.push({
            at: held.tick / division,
            length: Math.max(1 / 16, (tick - held.tick) / division),
            pitch: first,
            velocity: held.velocity,
          });
        }
      }
    }

    reader.skip(end - reader.position);
    if (notes.length === 0) continue;

    notes.sort((a, b) => a.at - b.at || a.pitch - b.pitch);
    tracks.push({
      name: label || `track ${tracks.length + 1}`,
      patch: preset(patchFor(channel, notes)),
      gain: 0.8,
      muted: false,
      notes,
    });
  }

  const last = tracks.reduce(
    (far, track) =>
      track.notes.reduce((end, note) => Math.max(end, note.at + note.length), far),
    0,
  );

  const song: Song = {
    name,
    tempo: Math.round(tempo * 100) / 100,
    beatsPerBar,
    bars: Math.max(1, Math.ceil(last / beatsPerBar)),
    tracks,
  };

  // A file whose last note runs past the final bar line would be clipped by the loop.
  return songBeats(song) >= last ? song : { ...song, bars: song.bars + 1 };
}
