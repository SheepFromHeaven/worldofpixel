import { useRef, useState } from 'react';
import { CHARGE_STEPS } from '../sim/book.ts';
import { BOX, GLYPH, HEAD_SCALE, TEXT_SCALE } from '../pixel/ui/metrics.ts';
import type { TownStage } from '../render/townStage.ts';
import type { RigView, Standing } from './rigView.ts';
import { PixelBody, PixelIcon, PixelText, itemIcon } from './pixel/Pixel.tsx';
import type { IconName } from './pixel/Pixel.tsx';

/** The town writes on what it has: sandstone, then a beaten sheet, then a board. */
export const SLAB_PLATES: Record<TownStage, string> = {
  fire: 'se-slab',
  huts: 'se-slab',
  village: 'se-parchment',
  stone: 'se-chalkboard',
};

/** The three bankings, as the three drawings of the fire they actually are. */
const BANKINGS: readonly IconName[] = ['fire-low', 'fire-mid', 'fire-high'];

/**
 * The strip. Pick the fire you want and the fire becomes it.
 *
 * The three differ in the height of the flame as well as in its colour, so the control still
 * works for somebody who cannot tell the colours apart — which fell out of drawing three real
 * bankings rather than three swatches, and is the argument for drawing the thing itself.
 */
export function Fires({
  rig,
  onPick,
  marked = true,
  compact = false,
}: {
  rig: RigView;
  onPick: (charge: number) => void;
  marked?: boolean;
  /** The docked rail's width: the words at the smaller size. */
  compact?: boolean;
}): React.JSX.Element {
  return (
    <div className="se-fires-block">
      <div className="se-fires" role="radiogroup" aria-label="how hard the fire is driven">
        {BANKINGS.map((name, index) => {
          const chosen = index === rig.charge;
          const word = CHARGE_STEPS[index]?.name ?? name;
          const dead = rig.affordable[index] === false;
          const reason = dead ? `${word}: needs more fuel here than is standing in it` : word;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-label={reason}
              title={reason}
              disabled={dead}
              className={`se-fire${chosen ? ' se-chosen' : dead ? ' se-dead' : ' se-back'}`}
              onClick={() => onPick(index)}
            >
              {marked ? <Pointer shown={chosen} /> : null}
              <PixelIcon name={name} />
              {compact ? <PixelText scale={TEXT_SCALE}>{word}</PixelText> : <PixelBody>{word}</PixelBody>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const POINTER = ['..###..', '..###..', '#######', '.#####.', '..###..', '...#...'];

/**
 * The mark over the chosen fire: an arrow cut into the slab like the letters, pointing down at
 * it. Every fire keeps the room for one, so choosing another moves nothing but the arrow.
 */
export function Pointer({ shown }: { shown: boolean }): React.JSX.Element {
  const width = POINTER[0]?.length ?? 0;
  return (
    <span
      className={`se-px-text se-pointer${shown ? '' : ' se-pointer-off'}`}
      style={{ '--se-px': `${HEAD_SCALE}px` } as React.CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox={`0 0 ${width} ${POINTER.length}`} shapeRendering="crispEdges" fill="currentColor">
        {POINTER.flatMap((row, y) =>
          [...row].map((mark, x) =>
            mark === '#' ? <rect key={`${x}:${y}`} x={x} y={y} width="1" height="1" /> : null,
          ),
        )}
      </svg>
    </span>
  );
}

/**
 * Picking an entry up and putting it down somewhere else in the list.
 *
 * The order of the queue is the whole of the rig's policy — a worker takes the first entry that
 * can run — so it has to read as an order and be changed the way an order is changed. A pair of
 * little arrows per row is a list-reorder widget from a settings screen; what a person does to
 * an ordered list is pick one of them up and put it further up. So the row itself is the grip,
 * and it swaps with its neighbour the moment the pointer passes that neighbour's middle: the
 * list under the hand is always the real order, because the slab *is* the state.
 *
 * The lift is kept in the hand rather than in the list: once a swap has happened the row has
 * moved under the pointer by the neighbour's own height, so the grab point moves with it and
 * the drawing stays exactly where the finger is.
 */
export interface Drag {
  id: string | null;
  lift: number;
  start: (event: React.PointerEvent<HTMLLIElement>, id: string) => void;
  move: (event: React.PointerEvent<HTMLLIElement>, id: string) => void;
  end: () => void;
}

/**
 * What is in the hand is a ref and not state, and that is not an optimisation.
 *
 * A pointer move is not a discrete event, so React is free to hold the render that would tell
 * the handler what it is holding until after several more moves have arrived — and a handler
 * reading the *rendered* grip then spends the first stretch of every drag believing nothing was
 * picked up. The ref is read; the state is only what the drawing needs.
 */
export function useDrag(move: (id: string, by: number) => void): Drag {
  const grip = useRef<{ id: string; at: number } | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [lift, setLift] = useState(0);

  return {
    id,
    lift,
    start: (event, entryId) => {
      // A shelf slot is a button inside the row; pressing one is a scratch on the shelf and
      // never the start of a drag.
      if ((event.target as HTMLElement).closest('button')) return;
      // Capture so the row goes on hearing the hand once the hand has run off the edge of it.
      // Guarded: a pointer that has already gone away throws, and losing the capture is only
      // losing the part of the drag that happens outside the list.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* nothing to capture */
      }
      grip.current = { id: entryId, at: event.clientY };
      setId(entryId);
      setLift(0);
    },
    move: (event, entryId) => {
      const held = grip.current;
      if (held?.id !== entryId) return;
      const row = event.currentTarget;
      const by = event.clientY - held.at;
      const next = by > 0 ? row.nextElementSibling : row.previousElementSibling;
      // A row only trades places with a row of its own group: an area's list is one order, but a
      // line is only ever moved among its own station's lines.
      const over = next instanceof HTMLElement && next.dataset.group === row.dataset.group ? next : null;
      if (over) {
        const box = over.getBoundingClientRect();
        const past =
          by > 0 ? event.clientY > box.top + box.height / 2 : event.clientY < box.bottom - box.height / 2;
        if (past) {
          move(entryId, by > 0 ? 1 : -1);
          held.at += by > 0 ? box.height : -box.height;
          setLift(event.clientY - held.at);
          return;
        }
      }
      setLift(by);
    },
    end: () => {
      grip.current = null;
      setId(null);
      setLift(0);
    },
  };
}
/** One side of a recipe: each thing as its own picture, with how many when it is more than one. */
export function Parts({ parts }: { parts: { item: string; amount: number }[] }): React.JSX.Element {
  return (
    <>
      {parts.map(({ item, amount }, index) => (
        <span className="se-part" key={item} title={`${amount} ${item}`}>
          {index > 0 ? <PixelBody>+</PixelBody> : null}
          <PixelIcon name={itemIcon(item)} />
          <span className="se-count">{amount > 1 ? <PixelBody>{`×${amount}`}</PixelBody> : null}</span>
        </span>
      ))}
    </>
  );
}
/** A duration to a tenth always, so "4.0s" and "2.5s" are the same width and nothing moves. */
const secondsOf = (seconds: number): string => `${seconds.toFixed(1)}s`;

const HEAD = 7;
const HEIGHT = BOX.h + 4;
const COLUMNS = 34;

/**
 * A long arrow cut in the font's own pixels: hollow while nothing is happening, and filled
 * from the tail a column at a time as the batch goes on, the way a furnace's arrow fills.
 *
 * The shaft is as tall as a letter and the head stands a little proud of the line, and the cell is the body
 * text's own, which is also the sandstone's: an arrow on any other grid reads as a picture laid
 * over the slab instead of cut into it.
 */
export function Arrow({ progress, seconds }: { progress: number; seconds?: number }): React.JSX.Element {
  const shaft = COLUMNS - HEAD;
  const filled = Math.floor(Math.max(0, Math.min(1, progress)) * shaft);
  const top = (HEIGHT - GLYPH.h) / 2;
  const bottom = top + GLYPH.h - 1;
  const cells: React.JSX.Element[] = [];
  const cell = (x: number, y: number, solid: boolean) =>
    cells.push(<rect key={`${x}:${y}`} x={x} y={y} width="1" height="1" opacity={solid ? 1 : 0.6} />);

  for (let x = 0; x < shaft; x += 1) {
    const solid = x < filled;
    cell(x, top, solid || x === 0);
    cell(x, bottom, solid || x === 0);
    for (let y = top + 1; y < bottom; y += 1) if (solid || x === 0) cell(x, y, true);
  }
  for (let d = 0; d < HEAD; d += 1) {
    cell(shaft + d, d, false);
    // The two sides of the head meet at the point, which is one cell and not two.
    if (HEIGHT - 1 - d !== d) cell(shaft + d, HEIGHT - 1 - d, false);
  }
  for (let y = 1; y < HEIGHT - 1; y += 1) if (y <= top || y >= bottom) cell(shaft, y, false);
  if (progress >= 1) {
    for (let d = 0; d < HEAD; d += 1) {
      for (let y = d + 1; y <= HEIGHT - 2 - d; y += 1) cell(shaft + d, y, true);
    }
  }

  return (
    <span
      className="se-px-text se-arrow"
      style={{ '--se-px': `${HEAD_SCALE}px` } as React.CSSProperties}
      role="img" aria-label={seconds === undefined ? 'under way' : `makes, takes ${secondsOf(seconds)}`}>
      {seconds === undefined ? null : (
        <span className="se-arrow-time">
          <PixelBody>{secondsOf(seconds)}</PixelBody>
        </span>
      )}
      <svg viewBox={`0 0 ${COLUMNS} ${HEIGHT}`} shapeRendering="crispEdges" fill="currentColor">
        {cells}
      </svg>
    </span>
  );
}
/**
 * Everything standing in a building, a row to the item: its picture, its name, and a scratch
 * for how many.
 *
 * A building holds a list rather than a floor of crates, and until this was drawn the goods
 * inside one were the one state in the game with nothing on screen saying so: a rig sat
 * refusing an entry for want of clay with eight loads of clay standing against its wall. The
 * name is beside every count because a bundle of strokes with nothing next to it is not a count
 * anyone can read; the tally stays, as the doctrine has it, and says *this many of this*.
 */
export function Held({ stock, capacity }: { stock: Standing; capacity: number }): React.JSX.Element {
  if (stock.length === 0) {
    return (
      <p className="se-empty">
        <PixelBody>Empty</PixelBody>
      </p>
    );
  }

  return (
    <ul className="se-holding">
      {stock.map(([item, amount]) => (
        <li key={item} title={`${amount} of ${capacity} ${item}`}>
          <PixelIcon name={itemIcon(item)} />
          <span className="se-holding-name">
            <PixelBody>{item}</PixelBody>
          </span>
          <span className="se-holding-count">
            <PixelBody>{`${amount}/${capacity}`}</PixelBody>
          </span>
        </li>
      ))}
    </ul>
  );
}
