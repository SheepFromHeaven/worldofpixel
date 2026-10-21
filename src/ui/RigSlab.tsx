import { CHARGE_STEPS } from '../sim/book.ts';
import type { TownStage } from '../render/townStage.ts';
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
  return (
    <aside className={`se-rig ${PLATES[stage]}`}>
      {/* While the fire is down between two methods there is nothing for the knob to drive. */}
      <div className={rig.changingOver ? 'se-back' : undefined}>
        <Fires rig={rig} onPick={hand.charge} />
      </div>
      <ol className="se-queue">
        {rig.queue.map((entry, index) => (
          <Entry
            key={entry.id}
            entry={entry}
            first={index === 0}
            last={index === rig.queue.length - 1}
            hand={hand}
          />
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
 * One entry of the queue: what it makes, standing on a shelf, with a scratch where the player
 * wants it to stop.
 *
 * A stock target field would be a number in a box about goods somewhere else. A scratch on the
 * shelf is how it would really be kept, and it puts the count in the same place as the stuff.
 */
function Entry({
  entry,
  first,
  last,
  hand,
}: {
  entry: QueueEntry;
  first: boolean;
  last: boolean;
  hand: RigHand;
}): React.JSX.Element {
  const { item, stock, target } = entry;

  return (
    <li className={`se-entry${entry.running ? ' se-running' : ' se-back'}`}>
      <div className="se-entry-order">
        <button type="button" aria-label="earlier in the queue" disabled={first} onClick={() => hand.move(entry.id, -1)}>
          <PixelIcon name="arrow-n" />
        </button>
        <button type="button" aria-label="later in the queue" disabled={last} onClick={() => hand.move(entry.id, 1)}>
          <PixelIcon name="arrow-s" />
        </button>
      </div>

      <div className="se-entry-body">
        <span className="se-entry-name">
          <PixelText>{entry.label}</PixelText>
        </span>

        {item ? (
          <Shelf item={item} stock={stock} target={target} onMark={(n) => hand.stop(entry.id, n)} />
        ) : null}

        {/* The whole reason the rig and the book are kept apart: a refusal in plain words. */}
        {entry.why ? (
          <span className="se-entry-why">
            <PixelText>{entry.why}</PixelText>
          </span>
        ) : null}
      </div>
    </li>
  );
}

/** How many slots a shelf shows. Past this the goods are a texture, so the tally carries it. */
const SHELF_SLOTS = 8;

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
  return (
    <div className="se-shelf-row">
      <div className="se-shelf">
        {Array.from({ length: SHELF_SLOTS }, (_, slot) => {
          const n = slot + 1;
          return (
            <button
              key={slot}
              type="button"
              className={`se-slot${stock >= n ? ' se-full' : ''}${target === n ? ' se-mark' : ''}`}
              title={`fill to ${n}`}
              aria-label={`fill to ${n}`}
              onClick={() => onMark(n)}
            >
              {stock >= n ? <PixelIcon name={itemIcon(item)} /> : null}
            </button>
          );
        })}
      </div>
      <Tally count={stock} />
    </div>
  );
}
