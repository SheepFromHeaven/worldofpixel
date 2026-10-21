import { useRef, useState } from 'react';
import { CHARGE_STEPS } from '../sim/book.ts';
import { BOX, HEAD_SCALE } from '../pixel/ui/metrics.ts';
import type { TownStage } from '../render/townStage.ts';
import { isStruck } from './rigView.ts';
import type { HoldingView, QueueEntry, RigHand, RigView, Standing } from './rigView.ts';
import { PixelBody, PixelIcon, itemIcon } from './pixel/Pixel.tsx';
import type { IconName } from './pixel/Pixel.tsx';
import { Tally } from './pixel/Tally.tsx';

/**
 * The hand that sets a rig.
 *
 * A setting is a picture of the state you are choosing, scratched on the same stone the ledger
 * is cut into. There are no sliders here, no percentages and no panel with a title bar, and
 * that is not decoration: a damper at 55% is a number *about* a fire rather than a fire, and
 * nobody in this town can measure anything. What they can do is point at a fire and say "like
 * that".
 *
 * So the control and the readout are the same drawing. The strip is three fires; the chosen one
 * is circled, the way anyone circles a choice, and the others sit back toward the colour of the
 * stone. Dimming is the only other state cue there is.
 */

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
 * Whether this rig has a knob to point at, and whether the knob is a fire.
 *
 * A cord walk, a weaving frame and a daub pit are cold work done with the hands: `batchTicks`
 * returns the method's own ticks for them and `costOf` hands the inputs back unscaled, so a
 * strip of fires over one is both the wrong picture and a control that drives nothing. The
 * document's whole rule for this layer is that the control and the readout are the same
 * drawing; a strip that changes nothing is the "number about a fire" one layer out, so there is
 * nothing where it stood until the cord walk's own knobs — twist, plies, splice overlap — exist
 * to be pointed at.
 *
 * A clamp is the other way round: its three vents are real and they set yield and grade against
 * each other, so the knob stays. Three *flames* are still the wrong drawing for a smouldering
 * earth mound — it wants three clamps, shut, half and open, differing in the smoke off the top
 * — and that art is not baked, so it keeps the fires meanwhile rather than losing its one
 * decision.
 */
function knobOf(rig: RigView): 'fires' | null {
  return rig.process === 'hand' ? null : 'fires';
}

/**
 * The slab on its own, with no world under it.
 *
 * Split out from the connected panel below so `/lab#hud` can stand it on the bench: the game
 * spends several seconds raising a world before a rig can be opened, which is a slow loop to
 * look at a scratched ring through — the same reason the designer's sheet is on that bench.
 */
export function RigSlab({
  rig,
  stage,
  hand,
}: {
  rig: RigView;
  stage: TownStage;
  hand: RigHand;
}): React.JSX.Element {
  const dragged = useDrag(hand);

  return (
    <Modal plate={SLAB_PLATES[stage]} label={rig.label} onClose={hand.close}>
      <section className="se-region se-region-set">
        <h3 className="se-region-head">
          <PixelBody>{rig.label}</PixelBody>
        </h3>
        {/* While the fire is down between two methods there is nothing for the knob to drive. */}
        {knobOf(rig) === null ? null : (
          <div className={rig.changingOver ? 'se-back' : undefined}>
            <Fires rig={rig} onPick={hand.charge} />
          </div>
        )}
        <h4 className="se-region-sub">
          <PixelBody>Production</PixelBody>
        </h4>
        <ol className="se-queue">
          {rig.queue.map((entry, index) => (
            <Entry key={entry.id} entry={entry} rank={index + 1} many={rig.queue.length > 1} hand={hand} drag={dragged} />
          ))}
        </ol>
      </section>

      {/*
       * Beside the policy, what the rig actually has to hand. It is what the queue is read
       * against: an entry crossed through for want of clay is answered by there being no clay
       * in the list next to it.
       */}
      <section className="se-region se-region-held">
        <h3 className="se-region-head">
          <PixelIcon name="crate" />
          <PixelBody>Stored</PixelBody>
        </h3>
        <Held stock={rig.stock} capacity={rig.capacity} />
      </section>
    </Modal>
  );
}

/**
 * A slab raised in the middle of the screen over a map dimmed right down.
 *
 * The backdrop is the one way a click outside closes it (Escape is `GameCanvas`'s), and it
 * covers the whole stage, bars included: a tool picked up while a building is open would act on
 * a map nobody can see. The test is on the target rather than a stopped event so that a drag
 * which ends outside the slab, with the pointer captured, does not close it.
 */
function Modal({
  plate,
  label,
  onClose,
  children,
}: {
  plate: string;
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className="se-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className={`se-rig ${plate}`} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </aside>
    </div>
  );
}

/**
 * The strip. Pick the fire you want and the fire becomes it.
 *
 * The three differ in the height of the flame as well as in its colour, so the control still
 * works for somebody who cannot tell the colours apart — which fell out of drawing three real
 * bankings rather than three swatches, and is the argument for drawing the thing itself.
 */
function Fires({ rig, onPick }: { rig: RigView; onPick: (charge: number) => void }): React.JSX.Element {
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
              className={`se-fire${chosen ? ' se-circled' : dead ? ' se-dead' : ' se-back'}`}
              onClick={() => onPick(index)}
            >
              <PixelIcon name={name} />
              <PixelBody>{word}</PixelBody>
            </button>
          );
        })}
      </div>
    </div>
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
interface Drag {
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
function useDrag(hand: RigHand): Drag {
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
      const over = by > 0 ? row.nextElementSibling : row.previousElementSibling;
      if (over) {
        const box = over.getBoundingClientRect();
        const past =
          by > 0 ? event.clientY > box.top + box.height / 2 : event.clientY < box.bottom - box.height / 2;
        if (past) {
          hand.move(entryId, by > 0 ? 1 : -1);
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

/**
 * One entry of the queue: its name, and its recipe — what a batch eats, an arrow, what it
 * makes, and how long it takes.
 *
 * There is nothing to set on an entry. It runs until what it makes has nowhere to be put,
 * which is the building's capacity, so the row says what the recipe *is* and the fire's banking
 * above it changes the row: a hotter fire eats more and finishes sooner, and the figures move.
 */
function Entry({
  entry,
  rank,
  many,
  hand,
  drag,
}: {
  entry: QueueEntry;
  rank: number;
  many: boolean;
  hand: RigHand;
  drag: Drag;
}): React.JSX.Element {
  const struck = isStruck(entry);
  const held = drag.id === entry.id;

  return (
    <li
      className={`se-entry${many ? '' : ' se-single'}${entry.running ? ' se-running' : ' se-back'}${struck ? ' se-struck' : ''}${held ? ' se-held' : ''}`}
      style={held ? { transform: `translateY(${drag.lift}px)` } : undefined}
      // The whole row is the grip. Arrow keys do the same thing for a hand that is not a mouse.
      tabIndex={many ? 0 : undefined}
      aria-label={`${rank}: ${entry.label}${entry.why ? `, ${entry.why}` : ''}`}
      title={entry.why || undefined}
      onPointerDown={many ? (event) => drag.start(event, entry.id) : undefined}
      onPointerMove={(event) => drag.move(event, entry.id)}
      onPointerUp={drag.end}
      onPointerCancel={drag.end}
      onKeyDown={(event) => {
        if (!many || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
        event.preventDefault();
        hand.move(entry.id, event.key === 'ArrowUp' ? -1 : 1);
      }}
    >
      {/*
       * Where it stands in the order, scratched in the margin. An ordered list that is only in
       * order says nothing about *why* the order matters; numbered, it reads as the policy it
       * is — the worker takes the first of these that can run.
       */}
      <span className="se-rank" aria-hidden="true" hidden={!many}>
        {many ? <PixelBody>{String(rank)}</PixelBody> : null}
      </span>

      <div className="se-entry-body">
        <Recipe entry={entry} />
      </div>
    </li>
  );
}

/** One side of a recipe: each thing as its own picture, with how many when it is more than one. */
function Parts({ parts }: { parts: { item: string; amount: number }[] }): React.JSX.Element {
  return (
    <>
      {parts.map(({ item, amount }, index) => (
        <span className="se-part" key={item} title={`${amount} ${item}`}>
          {index > 0 ? <PixelBody>+</PixelBody> : null}
          <PixelIcon name={itemIcon(item)} />
          {amount > 1 ? <PixelBody>{`×${amount}`}</PixelBody> : null}
        </span>
      ))}
    </>
  );
}

/** A duration the way anyone says one: whole seconds, or a half when it is a half. */
const secondsOf = (seconds: number): string => `${Math.round(seconds * 10) / 10}s`;

const HEAD = 5;
const HEIGHT = BOX.h;
const COLUMNS = 32;

/**
 * A long arrow cut in the font's own pixels: hollow while nothing is happening, and filled
 * from the tail a column at a time as the batch goes on, the way a furnace's arrow fills.
 *
 * The shaft is as tall as a letter and the head as tall as the line, and the cell is the body
 * text's own, which is also the sandstone's: an arrow on any other grid reads as a picture laid
 * over the slab instead of cut into it.
 */
function Arrow({ progress, seconds }: { progress: number; seconds: number }): React.JSX.Element {
  const shaft = COLUMNS - HEAD;
  const filled = Math.floor(Math.max(0, Math.min(1, progress)) * shaft);
  const top = 1;
  const bottom = HEIGHT - 2;
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
    cell(shaft + d, HEIGHT - 1 - d, false);
  }
  for (const y of [top, bottom]) cell(shaft, y, false);
  if (progress >= 1) {
    for (let d = 0; d < HEAD; d += 1) {
      for (let y = d + 1; y <= HEIGHT - 2 - d; y += 1) cell(shaft + d, y, true);
    }
  }

  return (
    <span
      className="se-px-text se-arrow"
      style={{ '--se-px': `${HEAD_SCALE}px` } as React.CSSProperties}
      role="img" aria-label={`makes, takes ${secondsOf(seconds)}`}>
      <span className="se-arrow-time">
        <PixelBody>{secondsOf(seconds)}</PixelBody>
      </span>
      <svg viewBox={`0 0 ${COLUMNS} ${HEIGHT}`} shapeRendering="crispEdges" fill="currentColor">
        {cells}
      </svg>
    </span>
  );
}

/**
 * A recipe as a sentence in pictures across the whole width: what goes in, an arrow that fills as
 * the batch runs, what comes out, and how long a batch takes in brackets. The arrow is cut like the letters are.
 */
function Recipe({ entry }: { entry: QueueEntry }): React.JSX.Element {
  return (
    <div className="se-recipe">
      <div className="se-side se-side-in">
        <Parts parts={entry.uses} />
      </div>
      <Arrow progress={entry.progress} seconds={entry.seconds} />
      <div className="se-side se-side-out">
        <Parts parts={entry.makes} />
      </div>
    </div>
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

/**
 * A building with no knobs on it, opened anyway.
 *
 * A well is the ground opened and there is nothing in one to set, but looking in and seeing
 * what is standing in the crate is worth having — so it says its name, how it stands and what
 * is lying in it, in the same popup a rig opens in so the two read as one thing.
 */
export function HoldingSlab({
  holding,
  stage,
  onClose,
}: {
  holding: HoldingView;
  stage: TownStage;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <Modal plate={SLAB_PLATES[stage]} label={holding.label} onClose={onClose}>
      <section className="se-region se-region-set">
        <h3 className="se-region-head">
          <PixelBody>{holding.label}</PixelBody>
        </h3>
        <p className="se-hint-line">
          <PixelBody>{holding.state}</PixelBody>
        </p>
      </section>
      <section className="se-region se-region-held">
        <h3 className="se-region-head">
          <PixelIcon name="crate" />
          <PixelBody>Stored</PixelBody>
        </h3>
        <Held stock={holding.stock} capacity={holding.capacity} />
      </section>
    </Modal>
  );
}
