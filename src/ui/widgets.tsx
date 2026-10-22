import { useRef, useState } from 'react';
import { CHARGE_STEPS } from '../sim/book.ts';
import { BOX, GLYPH, HEAD_SCALE, TEXT_SCALE } from '../pixel/ui/metrics.ts';
import type { TownStage } from '../render/townStage.ts';
import type { FireView, Standing } from './rigView.ts';
import { PixelBody, PixelIcon, PixelText, itemIcon } from './pixel/Pixel.tsx';
import type { IconName } from './pixel/Pixel.tsx';

export const SLAB_PLATES: Record<TownStage, string> = {
  fire: 'se-slab',
  huts: 'se-slab',
  village: 'se-parchment',
  stone: 'se-chalkboard',
};

const BANKINGS: readonly IconName[] = ['fire-low', 'fire-mid', 'fire-high'];

export function Fires({
  rig,
  onPick,
  marked = true,
  compact = false,
}: {
  rig: FireView;
  onPick: (charge: number) => void;
  marked?: boolean;
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

export interface Drag {
  id: string | null;
  lift: number;
  start: (event: React.PointerEvent<HTMLLIElement>, id: string) => void;
  move: (event: React.PointerEvent<HTMLLIElement>, id: string) => void;
  end: () => void;
}

export function useDrag(move: (id: string, by: number) => void): Drag {
  const grip = useRef<{ id: string; at: number } | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [lift, setLift] = useState(0);

  return {
    id,
    lift,
    start: (event, entryId) => {
      if ((event.target as HTMLElement).closest('button')) return;
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
const secondsOf = (seconds: number): string => `${seconds.toFixed(1)}s`;

const HEAD = 7;
const HEIGHT = BOX.h + 4;
const COLUMNS = 34;

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

export function Cross(): React.JSX.Element {
  return (
    <span className="se-cross" aria-hidden="true">
      <PixelIcon name="strike" />
    </span>
  );
}
