import { useRef, useState } from 'react';
import { CHARGE_STEPS } from '../sim/book.ts';
import type { TownStage } from '../render/townStage.ts';
import { SHELF_SLOTS, isStruck, shelfMark } from './rigView.ts';
import type { QueueEntry, RigHand, RigView } from './rigView.ts';
import { PixelIcon, PixelText, itemIcon } from './pixel/Pixel.tsx';
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
const PLATES: Record<TownStage, string> = {
  fire: 'se-slab',
  huts: 'se-slab',
  village: 'se-parchment',
  stone: 'se-chalkboard',
};

/** The three bankings, as the three drawings of the fire they actually are. */
const BANKINGS: readonly IconName[] = ['fire-low', 'fire-mid', 'fire-high'];

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
    <aside className={`se-rig ${PLATES[stage]}`}>
      {/* While the fire is down between two methods there is nothing for the knob to drive. */}
      <div className={rig.changingOver ? 'se-back' : undefined}>
        <Fires rig={rig} onPick={hand.charge} />
      </div>
      <ol className="se-queue">
        {rig.queue.map((entry, index) => (
          <Entry key={entry.id} entry={entry} rank={index + 1} hand={hand} drag={dragged} />
        ))}
      </ol>
    </aside>
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
    <div className="se-fires" role="radiogroup" aria-label="how hard the fire is driven">
      {BANKINGS.map((name, index) => {
        const chosen = index === rig.charge;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-label={CHARGE_STEPS[index]?.name ?? name}
            title={CHARGE_STEPS[index]?.name ?? name}
            className={`se-fire${chosen ? ' se-circled' : ' se-back'}`}
            onClick={() => onPick(index)}
          >
            <PixelIcon name={name} />
          </button>
        );
      })}
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
 * One entry of the queue: where it stands in the order, what it makes standing on a shelf, and
 * a scratch where the player wants it to stop.
 *
 * A stock target field would be a number in a box about goods somewhere else. A scratch on the
 * shelf is how it would really be kept, and it puts the count in the same place as the stuff.
 */
function Entry({
  entry,
  rank,
  hand,
  drag,
}: {
  entry: QueueEntry;
  rank: number;
  hand: RigHand;
  drag: Drag;
}): React.JSX.Element {
  const { item, stock, target } = entry;
  const struck = isStruck(entry);
  const held = drag.id === entry.id;

  return (
    <li
      className={`se-entry${entry.running ? ' se-running' : ' se-back'}${struck ? ' se-struck' : ''}${held ? ' se-held' : ''}`}
      style={held ? { transform: `translateY(${drag.lift}px)` } : undefined}
      // The whole row is the grip. Arrow keys do the same thing for a hand that is not a mouse.
      tabIndex={0}
      aria-label={`${rank}: ${entry.label}${entry.why ? `, ${entry.why}` : ''}`}
      onPointerDown={(event) => drag.start(event, entry.id)}
      onPointerMove={(event) => drag.move(event, entry.id)}
      onPointerUp={drag.end}
      onPointerCancel={drag.end}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        hand.move(entry.id, event.key === 'ArrowUp' ? -1 : 1);
      }}
    >
      {/*
       * Where it stands in the order, scratched in the margin. An ordered list that is only in
       * order says nothing about *why* the order matters; numbered, it reads as the policy it
       * is — the worker takes the first of these that can run.
       */}
      <span className="se-rank" aria-hidden="true">
        <Tally count={rank} />
        {/*
         * And a cross on what cannot run, which is the same mark the room draws on a square
         * with nowhere to hand its load on. It is the commonest reason a rig does nothing and
         * it was carried entirely by a sentence; now the sentence is the backup.
         */}
        {struck ? (
          <span className="se-cross" title={entry.why}>
            <i />
            <i />
          </span>
        ) : null}
      </span>

      <div className="se-entry-body">
        <span className="se-entry-name">
          <PixelText>{entry.label}</PixelText>
        </span>

        {item ? (
          <Shelf item={item} stock={stock} target={target} onMark={(n) => hand.stop(entry.id, n)} />
        ) : null}

        {/*
          * The words under the cross: what the book would say if asked, not the message itself.
          * Nothing is written under an entry that has simply finished — its goods standing level
          * with the scratch on the shelf is the whole sentence, and saying it twice makes a
          * satisfied entry look like a broken one.
          */}
        {struck && entry.why ? (
          <span className="se-entry-why">
            <PixelText>{entry.why}</PixelText>
          </span>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Stock as the stuff itself on a shelf, with a scratch across the boards where it is to stop.
 *
 * The scratch runs from above the goods to below the board on purpose: a tick inside one slot
 * is a highlighted cell, and a line cut across the shelf is a line cut across the shelf. It
 * sits *after* the slot it stops at, which is how anybody marks a fill line — you mark where
 * the goods are to reach, not the last one you want.
 *
 * Past the end of the shelf the goods are a texture, so the tally carries the rest — and a mark
 * set out past the end is written out in the same hand rather than quietly pulled back to the
 * last board, which would have the panel claiming a stop condition the book has never held.
 */
function Shelf({
  item,
  stock,
  target,
  onMark,
}: {
  item: string;
  stock: number;
  target: number | null;
  onMark: (n: number) => void;
}): React.JSX.Element {
  const marked = shelfMark(target);

  return (
    <div className="se-shelf-row">
      <div className="se-shelf">
        {Array.from({ length: SHELF_SLOTS }, (_, slot) => {
          const n = slot + 1;
          return (
            <button
              key={slot}
              type="button"
              className="se-slot"
              title={`fill to ${n}`}
              aria-label={`fill to ${n}`}
              onClick={() => onMark(n)}
            >
              {stock >= n ? <PixelIcon name={itemIcon(item)} /> : <i className="se-peg" />}
            </button>
          );
        })}
        {marked === null ? null : (
          <i
            className="se-mark"
            style={{ left: `calc(var(--se-slot) * ${marked.slot})` }}
            title={`fill to ${target}`}
            aria-hidden="true"
          />
        )}
      </div>
      {/* Only once the goods run off the end of the shelf: two readouts of one number otherwise. */}
      {stock > SHELF_SLOTS ? (
        <span title={`${stock} here`}>
          <Tally count={stock} />
        </span>
      ) : null}
      {marked?.beyond ? (
        <span title={`fill to ${target}`} aria-label={`fill to ${target}`}>
          <Tally count={target ?? 0} />
        </span>
      ) : null}
    </div>
  );
}
