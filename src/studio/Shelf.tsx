import { useEffect, useRef } from 'react';
import type { Song } from '../music/types.ts';
import { songBeats } from '../music/types.ts';

/**
 * The shelf: every piece in the game, and a way into each of them.
 *
 * The composer opened straight into one song and a dropdown, which is the shape of a tool that
 * has one piece in it. With six it is a library, so the library is the front page and the roll
 * is what you get when you pick something up — and a thumbnail says more about which piece is
 * which than its name does, since the shape of a part is what you remember about it.
 */

const CARD_WIDTH = 248;
const CARD_HEIGHT = 72;

const PAPER = '#fffdf7';
const GRID = '#e7e0cf';
const NOTE = '#4c7f63';
const QUIET = 'rgba(76, 127, 99, 0.4)';

export function Shelf({
  songs,
  playing,
  onOpen,
  onPreview,
  onNew,
  onImport,
}: {
  songs: readonly Song[];
  /** The name of the piece the transport is on, if any. */
  playing: string | null;
  onOpen: (index: number) => void;
  onPreview: (index: number) => void;
  onNew: () => void;
  onImport: (file: File) => void;
}): React.JSX.Element {
  return (
    <main className="shelf">
      <header>
        <h1>composer</h1>
        <div className="files">
          <button onClick={onNew}>new song</button>
          <label className="file">
            import midi
            <input
              type="file"
              accept=".mid,.midi,audio/midi"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
                event.target.value = '';
              }}
            />
          </label>
        </div>
      </header>

      <div className="cards">
        {songs.map((song, index) => (
          <article key={song.name} className="card" onClick={() => onOpen(index)}>
            <Thumbnail song={song} />
            <h2>{song.name}</h2>
            <p>
              {Math.round(song.tempo)}bpm · {song.bars} bars · {song.tracks.length} tracks ·{' '}
              {song.tracks.reduce((sum, track) => sum + track.notes.length, 0)} notes
            </p>
            <footer>
              <button
                className={playing === song.name ? 'on' : ''}
                onClick={(event) => {
                  event.stopPropagation();
                  onPreview(index);
                }}
              >
                {playing === song.name ? '❚❚ stop' : '▶ play'}
              </button>
              <button onClick={() => onOpen(index)}>open</button>
            </footer>
          </article>
        ))}
      </div>

      <p className="hint">
        a piece is a module in src/music/songs — open one, work on it, and paste it back
      </p>
    </main>
  );
}

/** Every track at once, in the shape they make: which piece is which, before the name is read. */
function Thumbnail({ song }: { song: Song }): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    const beats = songBeats(song);
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    for (let bar = 0; bar <= song.bars; bar += 1) {
      const x = Math.round((bar * song.beatsPerBar * CARD_WIDTH) / beats) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CARD_HEIGHT);
      ctx.stroke();
    }

    const notes = song.tracks.flatMap((track) => track.notes);
    if (notes.length === 0) return;
    const low = notes.reduce((at, note) => Math.min(at, note.pitch), 127);
    const high = notes.reduce((at, note) => Math.max(at, note.pitch), 0);
    const span = Math.max(12, high - low);

    for (const track of song.tracks) {
      ctx.fillStyle = track.muted ? QUIET : NOTE;
      for (const note of track.notes) {
        const x = (note.at / beats) * CARD_WIDTH;
        const y = CARD_HEIGHT - 3 - ((note.pitch - low) / span) * (CARD_HEIGHT - 6);
        ctx.globalAlpha = 0.3 + 0.5 * note.velocity;
        ctx.fillRect(x, y, Math.max(1.5, (note.length / beats) * CARD_WIDTH), 2);
      }
    }
    ctx.globalAlpha = 1;
  }, [song]);

  return <canvas ref={canvas} width={CARD_WIDTH} height={CARD_HEIGHT} />;
}
