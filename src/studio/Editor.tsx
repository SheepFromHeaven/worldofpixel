import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playVoice } from '../audio/synth.ts';
import { encodeMidi } from '../music/midi.ts';
import { PRESET_NAMES, preset } from '../music/presets.ts';
import { songToSource } from '../music/source.ts';
import { SCALES, noteName } from '../music/theory.ts';
import type { Note, Patch, Song, Track, Wave } from '../music/types.ts';
import { songBeats } from '../music/types.ts';
import { PianoRoll } from './PianoRoll.tsx';
import type { Picked } from './PianoRoll.tsx';
import { setVolume, transport, volume } from './transport.ts';

/**
 * One piece, open: the roll in the middle, the voice down one side, and the module to paste
 * back into `src/music/songs/` at the bottom.
 *
 * It is the sprite lab's opposite number and deliberately the same shape — the thing itself in
 * the middle, its knobs beside it, the source under it. A tune that can only be heard in a
 * browser tab is a tune that is lost on the next reload.
 *
 * It plays through exactly the synth the game plays through, so what is tuned here is what is
 * heard there. There is no second renderer to keep in step.
 */

const SNAPS: [string, number][] = [
  ['1/1', 1],
  ['1/2', 0.5],
  ['1/3', 1 / 3],
  ['1/4', 0.25],
  ['1/8', 0.125],
];

const ZOOMS = [24, 36, 48, 72, 96];

const WAVES: Wave[] = ['sine', 'triangle', 'sawtooth', 'square', 'noise'];

const KNOBS: [keyof Patch, number, number, number][] = [
  ['spread', 0, 40, 0.5],
  ['attack', 0, 3, 0.002],
  ['decay', 0.01, 4, 0.01],
  ['sustain', 0, 1, 0.01],
  ['release', 0.01, 5, 0.01],
  ['cutoff', 80, 9000, 20],
  ['resonance', 0.1, 14, 0.1],
  ['tracking', 0, 1.5, 0.05],
  ['vibrato', 0, 60, 1],
  ['vibratoRate', 0, 12, 0.1],
  ['drop', 0, 4000, 25],
  ['dropTime', 0, 0.4, 0.005],
  ['gain', 0, 1, 0.01],
  ['echo', 0, 1, 0.01],
];

export const emptyTrack = (name: string): Track => ({
  name,
  patch: preset('pluck'),
  gain: 0.8,
  muted: false,
  notes: [],
});

export function Editor({
  song,
  onChange,
  onBack,
}: {
  song: Song;
  onChange: (song: Song) => void;
  onBack: () => void;
}): React.JSX.Element {
  const [track, setTrack] = useState(0);
  const [picked, setPicked] = useState<Picked>(null);
  const [snap, setSnap] = useState(0.25);
  const [beatPx, setBeatPx] = useState(48);
  const [key, setKey] = useState<{ root: number; scale: string }>({ root: 2, scale: 'dorian' });
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const [level, setLevel] = useState(volume());
  const [copied, setCopied] = useState(false);

  const live = useRef(song);
  live.current = song;

  useEffect(() => {
    transport().setSong(song);
  }, [song]);

  // Whatever the shelf was previewing is not this piece, and two at once is nobody's intent.
  useEffect(() => {
    const player = transport();
    player.silence();
    player.setSong(live.current);
    return () => player.silence();
  }, []);

  // The playhead is the renderer's clock, not the scheduler's: the transport is asked where it
  // is once a frame, and nothing about the sound depends on this loop running.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const follow = (): void => {
      setBeat(transport().beat);
      frame = window.requestAnimationFrame(follow);
    };
    frame = window.requestAnimationFrame(follow);
    return () => window.cancelAnimationFrame(frame);
  }, [playing]);

  const start = useCallback((from?: number) => {
    const player = transport();
    player.setSong(live.current);
    player.play(from ?? player.beat);
    setPlaying(true);
  }, []);

  const halt = useCallback(() => {
    const player = transport();
    player.pause();
    setBeat(player.beat);
    setPlaying(false);
  }, []);

  const audition = useCallback(
    (pitch: number) => {
      const player = transport();
      const patch = live.current.tracks[track]?.patch;
      if (!patch) return;
      player.wake();
      playVoice(player.bus, patch, pitch, 0.9, player.bus.ctx.currentTime + 0.02, 0.35);
    },
    [track],
  );

  const changeTrack = useCallback(
    (index: number, change: Partial<Track>): void => {
      onChange({
        ...live.current,
        tracks: live.current.tracks.map((it, at) => (at === index ? { ...it, ...change } : it)),
      });
      setCopied(false);
    },
    [onChange],
  );

  const changePatch = (change: Partial<Patch>): void => {
    const current = song.tracks[track];
    if (!current) return;
    changeTrack(track, { patch: { ...current.patch, ...change } });
  };

  const changeNote = (change: Partial<Note>): void => {
    if (!picked) return;
    const notes = song.tracks[picked.track]?.notes;
    if (!notes) return;
    changeTrack(picked.track, {
      notes: notes.map((it, at) => (at === picked.note ? { ...it, ...change } : it)),
    });
  };

  useEffect(() => {
    const press = (event: KeyboardEvent): void => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (playing) halt();
        else start();
      }

      if ((event.key === 'Backspace' || event.key === 'Delete') && picked) {
        const notes = live.current.tracks[picked.track]?.notes;
        if (!notes) return;
        changeTrack(picked.track, { notes: notes.filter((_, at) => at !== picked.note) });
        setPicked(null);
      }
    };

    window.addEventListener('keydown', press);
    return () => window.removeEventListener('keydown', press);
  }, [playing, picked, start, halt, changeTrack]);

  const source = useMemo(() => songToSource(song), [song]);
  const current = song.tracks[track];
  const chosen = picked ? song.tracks[picked.track]?.notes[picked.note] : undefined;
  const scale = SCALES[key.scale] ?? SCALES.chromatic!;
  const shaded = useMemo(() => scale.map((step) => (step + key.root) % 12), [scale, key.root]);

  const save = (): void => {
    const blob = new Blob([encodeMidi(song) as BlobPart], { type: 'audio/midi' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${song.name}.mid`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <main className="studio">
      <header>
        <button onClick={onBack}>← shelf</button>

        <input
          className="title"
          value={song.name}
          aria-label="song name"
          onChange={(event) => onChange({ ...song, name: event.target.value })}
        />

        <button onClick={() => (playing ? halt() : start())}>
          {playing ? '❚❚ stop' : '▶ play'}
        </button>
        <button onClick={() => (playing ? start(0) : setBeat(0))}>↻ top</button>

        <label className="field">
          <span>tempo</span>
          <input
            type="number"
            min={30}
            max={240}
            value={Math.round(song.tempo)}
            onChange={(event) => onChange({ ...song, tempo: Number(event.target.value) || 96 })}
          />
        </label>

        <label className="field">
          <span>bars</span>
          <input
            type="number"
            min={1}
            max={64}
            value={song.bars}
            onChange={(event) =>
              onChange({ ...song, bars: Math.max(1, Number(event.target.value) || 1) })
            }
          />
        </label>

        <label className="field">
          <span>snap</span>
          <select value={snap} onChange={(event) => setSnap(Number(event.target.value))}>
            {SNAPS.map(([label, value]) => (
              <option key={label} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>zoom</span>
          <select value={beatPx} onChange={(event) => setBeatPx(Number(event.target.value))}>
            {ZOOMS.map((value) => (
              <option key={value} value={value}>
                {value}px
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>key</span>
          <select
            value={key.root}
            onChange={(event) => setKey({ ...key, root: Number(event.target.value) })}
          >
            {Array.from({ length: 12 }, (_, step) => (
              <option key={step} value={step}>
                {noteName(60 + step).slice(0, -1)}
              </option>
            ))}
          </select>
          <select
            value={key.scale}
            onChange={(event) => setKey({ ...key, scale: event.target.value })}
          >
            {Object.keys(SCALES).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={level}
            onChange={(event) => {
              setLevel(Number(event.target.value));
              setVolume(Number(event.target.value));
            }}
          />
        </label>

        <div className="files">
          <button onClick={save}>export midi</button>
        </div>
      </header>

      <aside className="tracks">
        <h2>
          tracks
          <button
            onClick={() => {
              onChange({
                ...song,
                tracks: [...song.tracks, emptyTrack(`track ${song.tracks.length + 1}`)],
              });
              setTrack(song.tracks.length);
            }}
          >
            add
          </button>
        </h2>

        {song.tracks.map((it, index) => (
          <section key={index} className={index === track ? 'track on' : 'track'}>
            <header onPointerDown={() => setTrack(index)}>
              <input
                value={it.name}
                onChange={(event) => changeTrack(index, { name: event.target.value })}
              />
              <button
                className={it.muted ? 'on' : ''}
                title="mute"
                onClick={() => changeTrack(index, { muted: !it.muted })}
              >
                {it.muted ? 'off' : 'on'}
              </button>
              <button
                title="remove this track"
                onClick={() => {
                  onChange({ ...song, tracks: song.tracks.filter((_, at) => at !== index) });
                  setTrack((at) => Math.max(0, at - (index <= at ? 1 : 0)));
                  setPicked(null);
                }}
              >
                ×
              </button>
            </header>

            <select
              value=""
              onChange={(event) => changeTrack(index, { patch: preset(event.target.value) })}
            >
              <option value="">preset…</option>
              {PRESET_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <Slider
              label="gain"
              value={it.gain}
              min={0}
              max={1.5}
              step={0.02}
              onChange={(gain) => changeTrack(index, { gain })}
            />
            <em>{it.notes.length} notes</em>
          </section>
        ))}
      </aside>

      <div className="sheet">
        <PianoRoll
          song={song}
          track={track}
          picked={picked}
          beat={beat}
          snap={snap}
          beatPx={beatPx}
          scale={shaded}
          onPick={setPicked}
          onNotes={(notes) => changeTrack(track, { notes })}
          onAudition={audition}
        />
        <p className="hint">
          drag to draw · drag a note's right edge for its length · right-click to rub out ·
          space plays · {songBeats(song)} beats
        </p>
      </div>

      <aside className="voice">
        <h2>{current ? `${current.name} · voice` : 'voice'}</h2>

        {current ? (
          <>
            <label className="field">
              <span>wave</span>
              <select
                value={current.patch.wave}
                onChange={(event) => changePatch({ wave: event.target.value as Wave })}
              >
                {WAVES.map((wave) => (
                  <option key={wave} value={wave}>
                    {wave}
                  </option>
                ))}
              </select>
            </label>

            {KNOBS.map(([name, min, max, step]) => (
              <Slider
                key={name}
                label={name}
                value={current.patch[name] as number}
                min={min}
                max={max}
                step={step}
                onChange={(value) => changePatch({ [name]: value } as Partial<Patch>)}
              />
            ))}
          </>
        ) : null}

        <h2>note</h2>
        {chosen ? (
          <>
            <em>
              {noteName(chosen.pitch)} · {chosen.at} + {chosen.length}
            </em>
            <Slider
              label="velocity"
              value={chosen.velocity}
              min={0.05}
              max={1}
              step={0.01}
              onChange={(velocity) => changeNote({ velocity })}
            />
            <Slider
              label="length"
              value={chosen.length}
              min={snap}
              max={16}
              step={snap}
              onChange={(length) => changeNote({ length })}
            />
          </>
        ) : (
          <em>nothing picked</em>
        )}
      </aside>

      <section className="source">
        <h2>
          paste back
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(source);
              setCopied(true);
            }}
          >
            {copied ? 'copied' : 'copy'}
          </button>
        </h2>
        <pre>{source}</pre>
      </section>
    </main>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}): React.JSX.Element {
  return (
    <label className="slider">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <em>{Number(value.toFixed(3))}</em>
    </label>
  );
}
