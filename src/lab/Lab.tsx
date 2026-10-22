import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Glow, Light, Rings } from '../pixel/light.ts';
import { normalize } from '../pixel/light.ts';
import { clipsOf } from '../pixel/sprite.ts';
import { SPRITES } from '../pixel/sprites/index.ts';
import { BIOME_COLORS, PAPER } from '../render/palette.ts';
import { FRAMES_PER_SECOND } from '../render/sprites.ts';
import { Biome } from '../sim/types.ts';
import { ClipStage } from './Clip.tsx';
import { blit, toCanvas } from './paint.ts';
import { lightsToSource } from './serialize.ts';

const SCALE = 18;

const IN_GAME = [38, 64, 128];

const BACKGROUNDS: [string, string][] = [
  ['meadow', BIOME_COLORS[Biome.Meadow]],
  ['forest', BIOME_COLORS[Biome.Forest]],
  ['highland', BIOME_COLORS[Biome.Highland]],
  ['marsh', BIOME_COLORS[Biome.Marsh]],
  ['paper', PAPER],
];

type Placed = Glow | Rings;

const isPlaced = (light: Light): light is Placed => light.kind !== 'sun';

export function Lab(): React.JSX.Element {
  const [name, setName] = useState(SPRITES[0]?.name ?? '');
  const sprite = useMemo(() => SPRITES.find((entry) => entry.name === name), [name]);

  const [lights, setLights] = useState<Light[]>(() => (sprite ? [...sprite.lights] : []));
  const [background, setBackground] = useState(BACKGROUNDS[0]?.[1] ?? PAPER);
  const [dragging, setDragging] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [clip, setClip] = useState('');
  const [bench, setBench] = useState<'lights' | 'depth'>('lights');

  useEffect(() => {
    setLights(sprite ? [...sprite.lights] : []);
    setFrame(0);
    setPlaying(false);
    setClip(sprite ? (clipsOf(sprite)[0]?.name ?? '') : '');
  }, [sprite]);

  const clips = sprite ? clipsOf(sprite) : [];
  const current = clips.find((entry) => entry.name === clip) ?? clips[0];
  const frames = current?.frames ?? 1;
  const fps = current?.fps ?? FRAMES_PER_SECOND;
  useEffect(() => {
    if (!playing || frames < 2) return;
    const ticking = window.setInterval(
      () => setFrame((at) => (at + 1) % frames),
      1000 / fps,
    );
    return () => window.clearInterval(ticking);
  }, [playing, frames, fps]);

  const stage = useRef<HTMLCanvasElement>(null);
  const strip = useRef<HTMLCanvasElement>(null);

  const grid = useMemo(
    () => sprite?.draw(lights, current?.name ?? 'default', frame),
    [sprite, lights, current, frame],
  );

  const update = useCallback((index: number, change: Partial<Light>): void => {
    setLights((current) =>
      current.map((light, i) => (i === index ? ({ ...light, ...change } as Light) : light)),
    );
    setCopied(false);
  }, []);

  useEffect(() => {
    const canvas = stage.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !grid) return;

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    blit(ctx, toCanvas(grid), 0, 0, grid.size * SCALE);

    for (const light of lights) {
      if (!isPlaced(light)) continue;
      const x = (light.x + 0.5) * SCALE;
      const y = (light.y + 0.5) * SCALE;

      ctx.beginPath();
      ctx.arc(x, y, light.reach * SCALE, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = light.kind === 'glow' ? '#ffd166' : '#8fd4e4';
      ctx.fill();
      ctx.strokeStyle = '#2b2519';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [grid, lights, background]);

  useEffect(() => {
    const canvas = strip.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !grid) return;

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const source = toCanvas(grid);
    let x = 8;
    for (const size of IN_GAME) {
      blit(ctx, source, x, (canvas.height - size) / 2, size);
      x += size + 16;
    }
  }, [grid, background]);

  const cellAt = (event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - box.left) / SCALE - 0.5,
      y: (event.clientY - box.top) / SCALE - 0.5,
    };
  };

  const grab = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const point = cellAt(event);
    let best: { index: number; gap: number } | null = null;

    for (const [index, light] of lights.entries()) {
      if (!isPlaced(light)) continue;
      const gap = Math.hypot(light.x - point.x, light.y - point.y);
      if (gap < 2 && (!best || gap < best.gap)) best = { index, gap };
    }

    if (!best) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(best.index);
  };

  const drag = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (dragging === null) return;
    const point = cellAt(event);
    update(dragging, { x: point.x, y: point.y } as Partial<Light>);
  };

  const source = useMemo(
    () => lightsToSource(lights, `${sprite?.name.toUpperCase() ?? 'SPRITE'}_LIGHTS`),
    [lights, sprite],
  );

  if (!sprite || !grid) return <main className="lab">No sprites are defined.</main>;

  return (
    <main className="lab">
      <header>
        <h1>sprite lab</h1>
        <select value={name} onChange={(event) => setName(event.target.value)}>
          {SPRITES.map((entry) => (
            <option key={entry.name} value={entry.name}>
              {entry.name} · {entry.cells}×{entry.cells}
            </option>
          ))}
        </select>
        <div className="swatches">
          {BACKGROUNDS.map(([label, color]) => (
            <button
              key={label}
              title={label}
              className={color === background ? 'on' : ''}
              style={{ background: color }}
              onClick={() => setBackground(color)}
            />
          ))}
        </div>
        <div className="benches">
          <button className={bench === 'lights' ? 'on' : ''} onClick={() => setBench('lights')}>lights</button>
          <button className={bench === 'depth' ? 'on' : ''} onClick={() => setBench('depth')}>depth</button>
        </div>
        <button onClick={() => setLights([...sprite.lights])}>revert</button>
      </header>

      {bench === 'depth' ? (
        <ClipStage
          sprite={sprite}
          lights={lights}
          clip={current?.name ?? 'default'}
          frame={frame}
          background={background}
        />
      ) : (
      <div className="stage">
        <canvas
          ref={stage}
          width={grid.size * SCALE}
          height={grid.size * SCALE}
          onPointerDown={grab}
          onPointerMove={drag}
          onPointerUp={() => setDragging(null)}
          onPointerCancel={() => setDragging(null)}
        />
        <canvas ref={strip} width={grid.size * SCALE} height={144} className="strip" />
        <p className="hint">drag the coloured handles · the dashed ring is the light's reach</p>
        {frames > 1 ? (
          <div className="frames">
            {clips.length > 1 ? (
              <select value={current?.name ?? ''} onChange={(event) => { setClip(event.target.value); setFrame(0); }}>
                {clips.map((entry) => (
                  <option key={entry.name} value={entry.name}>{entry.name}</option>
                ))}
              </select>
            ) : null}
            <button onClick={() => setPlaying(!playing)}>{playing ? '❚❚ pause' : '▶ play'}</button>
            <Slider label="frame" value={frame} min={0} max={frames - 1} step={1}
              onChange={(next) => {
                setPlaying(false);
                setFrame(Math.round(next));
              }} />
            <em>{fps}fps</em>
          </div>
        ) : null}
      </div>
      )}

      <aside>
        {lights.map((light, index) => (
          <section key={index}>
            <h2>{light.kind}</h2>

            {light.kind === 'sun' ? (
              <SunPuck light={light} onChange={(toward) => update(index, { toward } as Partial<Light>)} />
            ) : null}

            <Slider label="strength" value={light.strength} min={0} max={3} step={0.05}
              onChange={(strength) => update(index, { strength } as Partial<Light>)} />

            {isPlaced(light) ? (
              <Slider label="reach" value={light.reach} min={1} max={32} step={0.5}
                onChange={(reach) => update(index, { reach } as Partial<Light>)} />
            ) : null}

            {isPlaced(light) ? (
              <Slider label="flatten" value={light.flatten ?? 1} min={0.4} max={2.5} step={0.02}
                onChange={(flatten) => update(index, { flatten } as Partial<Light>)} />
            ) : null}

            {light.kind === 'rings' ? (
              <>
                <Slider label="spacing" value={light.spacing} min={1} max={12} step={0.1}
                  onChange={(spacing) => update(index, { spacing } as Partial<Light>)} />
                <Slider label="breaks" value={light.breaks} min={0} max={6} step={1}
                  onChange={(breaks) => update(index, { breaks } as Partial<Light>)} />
                <Slider label="rotation" value={light.rotation} min={-3.14} max={3.14} step={0.05}
                  onChange={(rotation) => update(index, { rotation } as Partial<Light>)} />
              </>
            ) : null}
          </section>
        ))}

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
      </aside>
    </main>
  );
}

function SunPuck({
  light,
  onChange,
}: {
  light: { toward: readonly [number, number, number] };
  onChange: (toward: readonly [number, number, number]) => void;
}): React.JSX.Element {
  const SIZE = 118;
  const [x, y] = normalize(light.toward);
  const [held, setHeld] = useState(false);

  const move = (event: React.PointerEvent<HTMLDivElement>): void => {
    const box = event.currentTarget.getBoundingClientRect();
    let nx = ((event.clientX - box.left) / SIZE) * 2 - 1;
    let ny = ((event.clientY - box.top) / SIZE) * 2 - 1;

    const length = Math.hypot(nx, ny);
    if (length > 1) {
      nx /= length;
      ny /= length;
    }

    onChange([nx, ny, Math.sqrt(Math.max(0, 1 - Math.min(1, length) ** 2))]);
  };

  return (
    <div
      className="puck"
      style={{ width: SIZE, height: SIZE }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setHeld(true);
        move(event);
      }}
      onPointerMove={(event) => held && move(event)}
      onPointerUp={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
    >
      <span style={{ left: `${(x + 1) * 50}%`, top: `${(y + 1) * 50}%` }} />
    </div>
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
      <em>{Number(value.toFixed(2))}</em>
    </label>
  );
}
