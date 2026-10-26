import type { Note } from './types.ts';

/**
 * Small pure helpers for writing a part down.
 *
 * The songs in `songs/` are code rather than a dump of a hundred note literals, for the reason
 * the ground's textures are code: a progression played four times with the last bar changed is
 * one idea, and written out in full it is four places to get it wrong. What comes *out* of the
 * composer is the opposite — explicit notes, because by then every one of them has been moved
 * by hand.
 */

export const note = (at: number, pitch: number, length: number, velocity = 0.8): Note => ({
  at,
  length,
  pitch,
  velocity,
});

/** A chord: one start, one length, several pitches. */
export const chord = (
  at: number,
  pitches: readonly number[],
  length: number,
  velocity = 0.7,
): Note[] => pitches.map((pitch) => note(at, pitch, length, velocity));

/**
 * A run of even steps, `null` for a rest.
 *
 * `length` defaults to the step, which is how a line is nearly always written; pass something
 * shorter for a part that wants air between its notes.
 */
export const line = (
  at: number,
  step: number,
  pitches: readonly (number | null)[],
  length = step,
  velocity = 0.8,
): Note[] =>
  pitches.flatMap((pitch, index) =>
    pitch === null ? [] : [note(at + index * step, pitch, length, velocity)],
  );

/**
 * A bar of drums, written as a row of characters.
 *
 * `X` hard, `x` soft, `o` a ghost, `.` a rest, one character to a sixteenth. Marks are rows
 * here for the same reason the HUD's icons are: a kick pattern is a *shape in time*, and read
 * as a list of beat numbers nobody can see the shape — written as a row, the backbeat and the
 * syncopation are visible in the diff.
 */
export function hits(row: string, pitch: number, step = 0.25, length = 0.12): Note[] {
  const WEIGHT: Record<string, number> = { X: 1, x: 0.62, o: 0.32 };
  return [...row].flatMap((mark, index) => {
    const velocity = WEIGHT[mark];
    return velocity === undefined ? [] : [note(index * step, pitch, length, velocity)];
  });
}

export const shift = (notes: readonly Note[], beats: number): Note[] =>
  notes.map((it) => ({ ...it, at: it.at + beats }));

export const transpose = (notes: readonly Note[], semitones: number): Note[] =>
  notes.map((it) => ({ ...it, pitch: it.pitch + semitones }));

export const louder = (notes: readonly Note[], by: number): Note[] =>
  notes.map((it) => ({ ...it, velocity: Math.max(0, Math.min(1, it.velocity * by)) }));

/** The same bar again, `times` over, every `every` beats. */
export const repeat = (notes: readonly Note[], times: number, every: number): Note[] =>
  Array.from({ length: times }, (_, index) => shift(notes, index * every)).flat();

/** Sorted by start, then by pitch: a song's notes are read in time order everywhere else. */
export const ordered = (notes: readonly Note[]): Note[] =>
  [...notes].sort((a, b) => a.at - b.at || a.pitch - b.pitch);
