import { useCallback, useEffect, useState } from 'react';
import { decodeMidi } from '../music/midi.ts';
import { SONGS } from '../music/songs/index.ts';
import type { Song } from '../music/types.ts';
import { Editor, emptyTrack } from './Editor.tsx';
import { Shelf } from './Shelf.tsx';
import { transport } from './transport.ts';

/**
 * The bench: a shelf of pieces, and one of them open.
 *
 * Which piece is open lives in the hash rather than in state alone, so a reload comes back to
 * the same roll and a link points at a tune — the same bargain `?seed=` makes for a map. It is
 * read and written without reloading, because the editor and the shelf share a transport and a
 * reload would drop the audio context between them.
 *
 * Edits live for the session only, and that is deliberate: the repository is where a song is
 * kept, and "paste back" is how it gets there. A composer that quietly saved to `localStorage`
 * would be a second copy of the soundtrack, out of step with the one the game ships.
 */

const BLANK: Song = {
  name: 'untitled',
  tempo: 96,
  beatsPerBar: 4,
  bars: 8,
  tracks: [emptyTrack('lead')],
};

const nameFromHash = (): string | null => {
  const hash = window.location.hash.replace(/^#/, '');
  return hash ? decodeURIComponent(hash) : null;
};

const uniqueName = (songs: readonly Song[], wanted: string): string => {
  if (!songs.some((song) => song.name === wanted)) return wanted;
  for (let suffix = 2; ; suffix += 1) {
    const tried = `${wanted} ${suffix}`;
    if (!songs.some((song) => song.name === tried)) return tried;
  }
};

export function Studio(): React.JSX.Element {
  const [songs, setSongs] = useState<readonly Song[]>(SONGS);
  const [open, setOpen] = useState<string | null>(nameFromHash);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const follow = (): void => setOpen(nameFromHash());
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, []);

  const show = useCallback((name: string | null): void => {
    window.location.hash = name === null ? '' : encodeURIComponent(name);
    setOpen(name);
  }, []);

  const add = useCallback(
    (song: Song): void => {
      const named = { ...song, name: uniqueName(songs, song.name) };
      setSongs([...songs, named]);
      show(named.name);
    },
    [songs, show],
  );

  const index = songs.findIndex((song) => song.name === open);
  const current = index < 0 ? undefined : songs[index];

  const change = useCallback(
    (song: Song): void => {
      setSongs((current) => current.map((it, at) => (at === index ? song : it)));
      if (song.name !== open) {
        window.location.hash = encodeURIComponent(song.name);
        setOpen(song.name);
      }
    },
    [index, open],
  );

  if (current) {
    return <Editor song={current} onChange={change} onBack={() => show(null)} />;
  }

  return (
    <Shelf
      songs={songs}
      playing={preview}
      onOpen={(at) => show(songs[at]?.name ?? null)}
      onPreview={(at) => {
        const song = songs[at];
        if (!song) return;
        const player = transport();
        if (preview === song.name) {
          player.silence();
          setPreview(null);
          return;
        }
        player.setSong(song);
        player.play(0);
        setPreview(song.name);
      }}
      onNew={() => add(BLANK)}
      onImport={(file) => {
        void file.arrayBuffer().then((bytes) => {
          try {
            add(decodeMidi(new Uint8Array(bytes), file.name.replace(/\.midi?$/i, '')));
          } catch (error) {
            window.alert(`That file could not be read: ${String(error)}`);
          }
        });
      }}
    />
  );
}
