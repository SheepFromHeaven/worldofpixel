import { useEffect, useMemo, useRef, useState } from 'react';
import type { Light } from '../pixel/light.ts';
import type { Sprite } from '../pixel/sprite.ts';
import { clipsOf } from '../pixel/sprite.ts';
import { villagerMan, villagerWoman } from '../pixel/sprites/villager.ts';
import { CARRIER_FEET } from '../render/carrier.ts';
import { HEADINGS, SOURCES, tilePieces } from '../render/sprites.ts';
import { TEXEL } from '../render/terrainPixels.ts';
import { toCanvas } from './paint.ts';
import { piecesToSource } from './serialize.ts';

/**
 * The depth bench: a villager you drag round a tile, drawn in the order the map draws them, with
 * every foot a line you can take hold of.
 *
 * Whether a drawing clips right is a question about two things at once — where the tile's foot is
 * and where the villager's feet are — and nothing in the game shows it on demand. On the map you
 * wait for a carrier to walk past a well, at a zoom you cannot hold still. Here the sort runs on
 * the painter's own numbers (`tilePieces`, `CARRIER_FEET`), so what reads wrong here reads wrong on
 * the map, and the foot that fixes it is the number to paste back.
 */

/** Screen pixels to a cell. Chunky, and small enough to leave room to walk about in. */
const SCALE = 10;

/** Cells of ground round the tile, for the villager to stand on. */
const MARGIN = 14;

/** How near the cursor has to come to a foot's line to take hold of it rather than the villager. */
const GRAB = 1.2;

/** The row a villager's feet are on, which is the row its line is drawn at. */
const FOOT = CARRIER_FEET;

const VILLAGER_CLIPS = [
  'idle',
  ...HEADINGS.map((heading) => `walk-${heading}`),
  ...HEADINGS.map((heading) => `carry-${heading}`),
];

interface Piece {
  clip?: string;
  foot: number;
}

/**
 * The pieces the painter would draw this sprite as. A drawing that declares none — a room tile, a
 * town mark — is one piece standing at its middle.
 */
function piecesOf(sprite: Sprite): Piece[] {
  if (!SOURCES[sprite.name]?.pieces) return [{ foot: sprite.cells / 2 }];
  return tilePieces(sprite.name).map((piece) => ({
    // Back from a depth in the world to the row it was read off, which is what the files hold.
    foot: sprite.cells / 2 + piece.depth / TEXEL,
    ...(piece.clip ? { clip: piece.clip } : {}),
  }));
}

export function ClipStage({
  sprite,
  lights,
  clip,
  frame,
  background,
}: {
  sprite: Sprite;
  lights: readonly Light[];
  clip: string;
  frame: number;
  background: string;
}): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [build, setBuild] = useState<'woman' | 'man'>('woman');
  const [pose, setPose] = useState('idle');
  const [held, setHeld] = useState<'villager' | number>('villager');
  const [down, setDown] = useState(false);
  const [copied, setCopied] = useState(false);

  const shipped = useMemo(() => piecesOf(sprite), [sprite]);
  const [pieces, setPieces] = useState<Piece[]>(shipped);
  const [feet, setFeet] = useState({ x: MARGIN + sprite.cells / 2, y: MARGIN + sprite.cells + 4 });

  // A different sprite brings its own feet and its own ground with it, like the lights bench.
  useEffect(() => {
    setPieces(shipped);
    setFeet({ x: MARGIN + sprite.cells / 2, y: MARGIN + sprite.cells + 4 });
    setCopied(false);
  }, [shipped, sprite]);

  const span = sprite.cells + MARGIN * 2;

  const parts = useMemo(
    () =>
      pieces.map((piece) => ({
        piece,
        canvas: toCanvas(sprite.draw(lights, piece.clip ?? clip, frame)),
      })),
    [pieces, sprite, lights, clip, frame],
  );

  const figure = useMemo(() => {
    const drawing = build === 'man' ? villagerMan : villagerWoman;
    const has = clipsOf(drawing).some((entry) => entry.name === pose);
    return toCanvas(drawing.draw(drawing.lights, has ? pose : 'idle', frame % 4));
  }, [build, pose, frame]);

  useEffect(() => {
    const stage = canvas.current;
    const ctx = stage?.getContext('2d');
    if (!stage || !ctx) return;

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, stage.width, stage.height);

    // Everything standing, sorted by foot, in the stage's own rows — the tile is laid a margin in
    // from the corner, so its pieces are measured from there.
    const standing = parts.map(({ piece, canvas: part }) => ({
      foot: MARGIN + piece.foot,
      draw: () => {
        const smoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          part,
          MARGIN * SCALE, MARGIN * SCALE,
          part.width * SCALE, part.height * SCALE,
        );
        ctx.imageSmoothingEnabled = smoothing;
      },
    }));

    standing.push({
      foot: feet.y,
      draw: () => {
        const smoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          figure,
          Math.round((feet.x - figure.width / 2) * SCALE),
          Math.round((feet.y - FOOT) * SCALE),
          figure.width * SCALE,
          figure.height * SCALE,
        );
        ctx.imageSmoothingEnabled = smoothing;
      },
    });

    standing.sort((a, b) => a.foot - b.foot);
    for (const thing of standing) thing.draw();

    // Every foot as a line across the ground, because the line *is* the thing being set: whoever's
    // line is lower is drawn in front. The tile's are draggable, so they are drawn with a handle.
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    parts.forEach(({ piece }, index) => {
      const y = Math.round((MARGIN + piece.foot) * SCALE) + 0.5;
      ctx.strokeStyle = held === index && down ? 'rgba(43, 37, 25, 0.95)' : 'rgba(43, 37, 25, 0.55)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(stage.width, y);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(10, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#2b2519';
      ctx.stroke();
      ctx.setLineDash([3, 3]);
    });

    ctx.strokeStyle = 'rgba(214, 69, 51, 0.85)';
    const feetLine = Math.round(feet.y * SCALE) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, feetLine);
    ctx.lineTo(stage.width, feetLine);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [parts, figure, feet, background, held, down]);

  const cellAt = (event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - box.left) / SCALE, y: (event.clientY - box.top) / SCALE };
  };

  const grab = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const point = cellAt(event);
    let nearest = -1;
    let closest = GRAB;
    for (const [index, piece] of pieces.entries()) {
      const gap = Math.abs(MARGIN + piece.foot - point.y);
      if (gap < closest) {
        nearest = index;
        closest = gap;
      }
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    setDown(true);
    if (nearest >= 0) {
      setHeld(nearest);
      return;
    }
    setHeld('villager');
    setFeet(point);
  };

  const setFoot = (index: number, foot: number): void => {
    setPieces((current) =>
      current.map((piece, at) =>
        at === index ? { ...piece, foot: Math.max(0, Math.min(sprite.cells, foot)) } : piece,
      ),
    );
    setCopied(false);
  };

  const drag = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!down) return;
    const point = cellAt(event);
    if (held === 'villager') setFeet(point);
    else setFoot(held, point.y - MARGIN);
  };

  const nudge = (event: React.KeyboardEvent<HTMLCanvasElement>): void => {
    const step = event.shiftKey ? 0.25 : 1;
    const by: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = by[event.key];
    if (!move) return;
    event.preventDefault();
    setFeet((at) => ({ x: at.x + move[0], y: at.y + move[1] }));
  };

  const source = useMemo(() => piecesToSource(pieces), [pieces]);
  const moved = useMemo(
    () => pieces.some((piece, index) => piece.foot !== shipped[index]?.foot),
    [pieces, shipped],
  );

  return (
    <div className="stage">
      <canvas
        ref={canvas}
        width={span * SCALE}
        height={span * SCALE}
        tabIndex={0}
        onPointerDown={grab}
        onPointerMove={drag}
        onPointerUp={() => setDown(false)}
        onPointerCancel={() => setDown(false)}
        onKeyDown={nudge}
      />
      <p className="hint">
        drag the villager, or take hold of a dashed line to move a foot · arrow keys step the
        villager a cell, with shift a quarter · whoever's line is lower is drawn in front
      </p>

      <div className="frames">
        <button onClick={() => setBuild(build === 'woman' ? 'man' : 'woman')}>{build}</button>
        <select value={pose} onChange={(event) => setPose(event.target.value)}>
          {VILLAGER_CLIPS.map((entry) => (
            <option key={entry} value={entry}>{entry}</option>
          ))}
        </select>
        <em>
          feet on row {Number((feet.y - MARGIN).toFixed(2))} of {sprite.cells}
        </em>
      </div>

      {pieces.map((piece, index) => (
        <label className="slider" key={`${piece.clip ?? 'tile'}-${index}`}>
          <span>{piece.clip ?? 'foot'}</span>
          <input
            type="range"
            min={0}
            max={sprite.cells}
            step={0.5}
            value={piece.foot}
            onChange={(event) => setFoot(index, Number(event.target.value))}
          />
          <em>
            {Number(piece.foot.toFixed(1))} · {feet.y - MARGIN > piece.foot ? 'behind' : 'in front of'} the villager
          </em>
        </label>
      ))}

      <section className="source">
        <h2>
          paste back
          <button onClick={() => setPieces(shipped)} disabled={!moved}>revert</button>
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
        <p className="hint">
          goes in the sprite and in <code>SOURCES['{sprite.name}']</code>, which the bake keeps in
          step — row{' '}
          {sprite.cells / 2} is the middle of the parcel, and a villager standing there is inside the
          building, which is why nothing walks over a built one
        </p>
      </section>
    </div>
  );
}
