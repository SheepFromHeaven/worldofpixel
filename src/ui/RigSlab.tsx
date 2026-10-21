import { useRef, useState } from 'react';
import { CHARGE_STEPS } from '../sim/book.ts';
import type { TownStage } from '../render/townStage.ts';
import { SHELF_SLOTS, isStruck, shelfMark } from './rigView.ts';
import type { HoldingView, QueueEntry, RigHand, RigView, Standing } from './rigView.ts';
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
    <aside className={`se-rig ${SLAB_PLATES[stage]}`}>
      {/* While the fire is down between two methods there is nothing for the knob to drive. */}
      {knobOf(rig) === null ? null : (
        <div className={rig.changingOver ? 'se-back' : undefined}>
          <Fires rig={rig} onPick={hand.charge} />
        </div>
      )}
      <ol className="se-queue">
        {rig.queue.map((entry, index) => (
          <Entry key={entry.id} entry={entry} rank={index + 1} hand={hand} drag={dragged} />
        ))}
      </ol>
      {/*
       * And under the policy, what the rig actually has to hand. It goes below the queue
       * because it is what the queue is read against: an entry crossed through for want of
       * clay is answered by the clay shelf standing empty right under it.
       */}
      <Held stock={rig.stock} />
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

/**
 * Goods standing on a shelf, with nothing to set.
 *
 * The same boards the queue's shelf is cut into, and deliberately: what a rig is filling up to
 * and what a shed happens to be holding are the same kind of fact, so they are the same
 * drawing. The difference is only that there is no scratch on this one and nothing to press —
 * a stop condition is policy, and a pile of mud is not.
 *
 * Past the end of the boards the goods stop being countable and become a texture, so the rest
 * is carried by the tally. That is the one place a count is written here, and it is written in
 * the only numerals this town has.
 */
function Goods({ item, count }: { item: string; count: number }): React.JSX.Element {
  return (
    <div className="se-shelf-row">
      <div className="se-shelf se-shelf-read" title={`${count} ${item}`}>
        {Array.from({ length: SHELF_SLOTS }, (_, slot) => (
          <span key={slot} className="se-slot">
            {count > slot ? <PixelIcon name={itemIcon(item)} /> : <i className="se-peg" />}
          </span>
        ))}
      </div>
      {count > SHELF_SLOTS ? (
        <span title={`${count} ${item}`}>
          <Tally count={count} />
        </span>
      ) : null}
    </div>
  );
}

/**
 * Everything standing in a building, a shelf to the item.
 *
 * A building holds a list now rather than a floor of crates, and until this was drawn the
 * goods inside one were the one state in the game with nothing on screen saying so: a rig sat
 * refusing an entry for want of clay with eight loads of clay standing against its wall.
 */
export function Held({ stock }: { stock: Standing }): React.JSX.Element | null {
  if (stock.length === 0) return null;

  return (
    <ul className="se-holding">
      {stock.map(([item, amount]) => (
        <li key={item}>
          <Goods item={item} count={amount} />
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
 * is lying in it, and stops there. A slab with nothing written on it is the honest drawing of
 * a shed that has nothing in it yet.
 */
export function HoldingSlab({ holding, stage }: { holding: HoldingView; stage: TownStage }): React.JSX.Element {
  return (
    <aside className={`se-rig ${SLAB_PLATES[stage]}`}>
      <PixelText>{holding.label}</PixelText>
      <div className="se-back">
        <PixelText>{holding.state}</PixelText>
      </div>
      <Held stock={holding.stock} />
    </aside>
  );
}
