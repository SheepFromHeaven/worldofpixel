/** Names and numbers. Everything else about a pitch is arithmetic on its MIDI number. */

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** The black keys of an octave, by semitone. The piano roll stripes itself off this. */
const BLACK = new Set([1, 3, 6, 8, 10]);

export const noteName = (pitch: number): string => {
  const step = ((pitch % 12) + 12) % 12;
  return `${NAMES[step] ?? '?'}${Math.floor(pitch / 12) - 1}`;
};

export const isBlackKey = (pitch: number): boolean => BLACK.has(((pitch % 12) + 12) % 12);

export const hertz = (pitch: number): number => 440 * 2 ** ((pitch - 69) / 12);

/**
 * The scales the composer offers to shade the roll with.
 *
 * A piano roll with every semitone the same colour is a grid of two hundred identical rows, and
 * the first thing anyone does on one is write a wrong note. Shading the key turns the grid into
 * a ladder you can read.
 */
export const SCALES: Record<string, readonly number[]> = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
  'minor pentatonic': [0, 3, 5, 7, 10],
};

export const inScale = (pitch: number, root: number, scale: readonly number[]): boolean =>
  scale.includes((((pitch - root) % 12) + 12) % 12);
