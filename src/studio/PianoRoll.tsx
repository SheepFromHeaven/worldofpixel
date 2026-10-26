import { useEffect, useRef } from 'react';
import { isBlackKey, noteName } from '../music/theory.ts';
import type { Note, Song } from '../music/types.ts';
import { songBeats } from '../music/types.ts';

/**
 * The roll: time across, pitch down, one rectangle per note.
 *
 * Canvas rather than a few hundred divs, for the reason the designer is canvas — the layout is
 * arithmetic, and arithmetic shared by the drawing and the hit test cannot drift. Everything
 * here is a pure function of `BEAT_PX` and `ROW_PX`, so there is one place to look when a note
 * lands somewhere other than where it was dropped.
 *
 * The other tracks are drawn faintly underneath rather than hidden. A melody written against a
 * bass line you cannot see is a melody written twice.
 */

const LOW = 33;
const HIGH = 96;
const ROWS = HIGH - LOW + 1;
const ROW_PX = 11;
/** How near the right edge of a note counts as taking hold of its length. */
const EDGE_PX = 7;

const PAPER = '#f4f1ea';
const LINE = '#ded7c7';
const BAR = '#b9ad94';
const BLACK_ROW = '#e9e3d6';
const KEY_ROW = '#f7edd4';
const GHOST = 'rgba(90, 82, 66, 0.18)';
const NOTE = '#4c7f63';
const NOTE_EDGE = '#2b4f3c';
const PICKED = '#c8622f';
const HEAD = '#8c3b2f';

export type Picked = { track: number; note: number } | null;

type Drag =
  | { mode: 'move'; note: number; grabBeat: number; grabPitch: number }
  | { mode: 'length'; note: number }
  | null;

export function PianoRoll({
  song,
  track,
  picked,
  beat,
  snap,
  beatPx,
  scale,
  onPick,
  onNotes,
  onAudition,
}: {
  song: Song;
  track: number;
  picked: Picked;
  /** Where the playhead is, in beats. */
  beat: number;
  snap: number;
  beatPx: number;
  /** Which pitch classes are shaded as being in the key. */
  scale: readonly number[];
  onPick: (picked: Picked) => void;
  onNotes: (notes: readonly Note[]) => void;
  onAudition: (pitch: number) => void;
}): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag>(null);
  const notes = song.tracks[track]?.notes ?? [];
  const beats = songBeats(song);
  const width = Math.max(1, Math.round(beats * beatPx));
  const height = ROWS * ROW_PX;

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, width, height);

    for (let row = 0; row < ROWS; row += 1) {
      const pitch = HIGH - row;
      const inKey = scale.includes(((pitch % 12) + 12) % 12);
      if (!inKey && isBlackKey(pitch)) ctx.fillStyle = BLACK_ROW;
      else if (inKey) ctx.fillStyle = KEY_ROW;
      else continue;
      ctx.fillRect(0, row * ROW_PX, width, ROW_PX);
    }

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    for (let row = 0; row <= ROWS; row += 1) {
      const y = Math.round(row * ROW_PX) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    for (let at = 0; at <= beats; at += snap) {
      const bar = Math.abs(at % song.beatsPerBar) < 1e-6;
      const whole = Math.abs(at % 1) < 1e-6;
      if (!bar && !whole && beatPx * snap < 10) continue;
      ctx.strokeStyle = bar ? BAR : LINE;
      ctx.lineWidth = bar ? 2 : 1;
      const x = Math.round(at * beatPx) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    song.tracks.forEach((other, index) => {
      if (index === track) return;
      ctx.fillStyle = GHOST;
      for (const note of other.notes) {
        ctx.fillRect(
          note.at * beatPx,
          (HIGH - note.pitch) * ROW_PX,
          Math.max(2, note.length * beatPx - 1),
          ROW_PX - 1,
        );
      }
    });

    notes.forEach((note, index) => {
      const chosen = picked?.track === track && picked.note === index;
      const x = note.at * beatPx;
      const y = (HIGH - note.pitch) * ROW_PX;
      const w = Math.max(3, note.length * beatPx - 1);
      // Velocity is the fill's weight, so a part's shape is visible without opening anything.
      ctx.globalAlpha = 0.35 + 0.65 * note.velocity;
      ctx.fillStyle = chosen ? PICKED : NOTE;
      ctx.fillRect(x, y, w, ROW_PX - 1);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = chosen ? PICKED : NOTE_EDGE;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), ROW_PX - 2);
    });

    const x = Math.round(beat * beatPx) + 0.5;
    ctx.strokeStyle = HEAD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }, [song, track, notes, picked, beat, snap, beatPx, scale, width, height]);

  const place = (event: React.PointerEvent<HTMLCanvasElement>): { beat: number; pitch: number } => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      beat: (event.clientX - box.left) / beatPx,
      pitch: HIGH - Math.floor((event.clientY - box.top) / ROW_PX),
    };
  };

  const quantise = (value: number): number => Math.max(0, Math.round(value / snap) * snap);

  const under = (at: number, pitch: number): number =>
    notes.findIndex(
      (note) => note.pitch === pitch && at >= note.at && at <= note.at + note.length,
    );

  const down = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (event.button === 2) return;
    const point = place(event);
    const index = under(point.beat, point.pitch);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (index >= 0) {
      const note = notes[index]!;
      const edge = (note.at + note.length) * beatPx - point.beat * beatPx < EDGE_PX;
      drag.current = edge
        ? { mode: 'length', note: index }
        : { mode: 'move', note: index, grabBeat: point.beat - note.at, grabPitch: point.pitch };
      onPick({ track, note: index });
      return;
    }

    // A fresh note is as long as the grid is fine, which is what the grid is being set for.
    const made: Note = {
      at: quantise(point.beat),
      length: snap,
      pitch: point.pitch,
      velocity: picked ? (notes[picked.note]?.velocity ?? 0.8) : 0.8,
    };
    onNotes([...notes, made]);
    onPick({ track, note: notes.length });
    onAudition(made.pitch);
    drag.current = { mode: 'length', note: notes.length };
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const held = drag.current;
    if (!held) return;
    const note = notes[held.note];
    if (!note) return;
    const point = place(event);

    const next =
      held.mode === 'length'
        ? { ...note, length: Math.max(snap, quantise(point.beat - note.at)) }
        : {
            ...note,
            at: quantise(point.beat - held.grabBeat),
            pitch: Math.max(LOW, Math.min(HIGH, point.pitch)),
          };

    if (next.at === note.at && next.pitch === note.pitch && next.length === note.length) return;
    if (held.mode === 'move' && next.pitch !== note.pitch) onAudition(next.pitch);
    onNotes(notes.map((it, index) => (index === held.note ? next : it)));
  };

  const up = (): void => {
    drag.current = null;
  };

  const erase = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    const index = under(
      (event.clientX - box.left) / beatPx,
      HIGH - Math.floor((event.clientY - box.top) / ROW_PX),
    );
    if (index < 0) return;
    onNotes(notes.filter((_, at) => at !== index));
    onPick(null);
  };

  return (
    <div className="roll">
      <Keys onAudition={onAudition} />
      <canvas
        ref={canvas}
        width={width}
        height={height}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onContextMenu={erase}
      />
    </div>
  );
}

/** The keyboard down the side: the only thing in the composer that says which row is which. */
function Keys({ onAudition }: { onAudition: (pitch: number) => void }): React.JSX.Element {
  return (
    <div className="keys" style={{ height: ROWS * ROW_PX }}>
      {Array.from({ length: ROWS }, (_, row) => {
        const pitch = HIGH - row;
        const black = isBlackKey(pitch);
        return (
          <button
            key={pitch}
            className={black ? 'key black' : 'key'}
            style={{ height: ROW_PX }}
            onPointerDown={() => onAudition(pitch)}
          >
            {pitch % 12 === 0 ? noteName(pitch) : ''}
          </button>
        );
      })}
    </div>
  );
}
