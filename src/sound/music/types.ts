/**
 * What a piece of music is, in this game.
 *
 * A song is notes and the voice that plays them, never a recording: the whole soundtrack is a
 * few kilobytes of numbers that the browser's own oscillators turn into sound. That is the same
 * bargain the rest of the art makes — the sprites are drawn by code from a palette, and the
 * music is played by code from a handful of patches — and it is why a tune can be edited in the
 * composer and pasted back into a source file as the thing it already was.
 *
 * Time is in **beats** everywhere, never in seconds. The tempo belongs to the song, so a bar
 * that is a bar at ninety beats a minute is still a bar at sixty, and a pattern can be moved
 * between pieces without being rewritten. Pitch is a MIDI number, so middle C is 60 and a file
 * saved out of any other tool means the same thing here.
 */

export type Wave = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'noise';

/**
 * A voice: two oscillators, an envelope and a filter.
 *
 * Deliberately small. A synth with forty knobs is one nobody tunes by ear, and every one of
 * these is a thing you can hear move — `spread` is how wide it sits, `cutoff` how bright it is,
 * `release` how long the room holds it.
 */
export type Patch = {
  readonly wave: Wave;
  /** Cents between the pair of oscillators. Nothing sounds alive at zero. */
  readonly spread: number;
  readonly attack: number;
  readonly decay: number;
  /** The level held while the key is down, as a fraction of the peak. */
  readonly sustain: number;
  readonly release: number;
  /** The filter's corner at middle C, in hertz. */
  readonly cutoff: number;
  readonly resonance: number;
  /** How far the corner follows the note: 1 keeps the brightness even across the keyboard. */
  readonly tracking: number;
  /** Depth of the wobble, in cents, and how fast it wobbles. */
  readonly vibrato: number;
  readonly vibratoRate: number;
  /**
   * How far the pitch falls at the start of the note, in cents, and over how long.
   *
   * This is the whole difference between a thud and a kick drum. A struck thing is tight when
   * it is hit and slackens as it rings, so its pitch falls — a drum with a flat pitch is a sine
   * wave with the volume turned down. On a noise voice the filter's band falls instead, which
   * is what gives a snare its crack and a tom its note.
   */
  readonly drop: number;
  readonly dropTime: number;
  readonly gain: number;
  /** How much of the voice is sent to the echo. */
  readonly echo: number;
};

export type Note = {
  /** Where it starts, in beats from the top of the song. */
  readonly at: number;
  readonly length: number;
  /** MIDI number: 60 is middle C. */
  readonly pitch: number;
  readonly velocity: number;
};

export type Track = {
  readonly name: string;
  readonly patch: Patch;
  readonly gain: number;
  readonly muted: boolean;
  readonly notes: readonly Note[];
};

export type Song = {
  readonly name: string;
  readonly tempo: number;
  readonly beatsPerBar: number;
  readonly bars: number;
  readonly tracks: readonly Track[];
};

export const songBeats = (song: Song): number => song.bars * song.beatsPerBar;

export const secondsPerBeat = (tempo: number): number => 60 / tempo;
