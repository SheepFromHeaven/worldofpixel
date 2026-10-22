import { HEAD_SCALE } from '../pixel/ui/metrics.ts';
import { ITEM_COLORS } from '../render/palette.ts';
import type { ItemType as Item } from '../sim/types.ts';
import type { TownStage } from '../render/townStage.ts';
import type { AreaHand, AreaView, Choice, ListLine, Raise, SlotView } from './areaView.ts';
import { PixelBody, PixelIcon, itemIcon } from './pixel/Pixel.tsx';
import { Arrow, Fires, Held, Modal, Parts, Pointer, SLAB_PLATES, useDrag } from './RigSlab.tsx';
import type { Drag } from './RigSlab.tsx';

/**
 * The area opened (`docs/methods.html` §3, the second view): the slots as pictures, the knobs of
 * the one that is open, one list of what is made here and one shelf. No title and no name — the
 * row of slots says what the place is.
 */
export function AreaSheet({
  area,
  stage,
  hand,
}: {
  area: AreaView;
  stage: TownStage;
  hand: AreaHand;
}): React.JSX.Element {
  const drag = useDrag((id, by) => {
    const line = area.list.find((entry) => entry.id === id);
    if (line) hand.move(id, line.slot, by);
  });

  return (
    <Modal plate={SLAB_PLATES[stage]} label="work area" onClose={hand.close}>
      <section className="se-region se-region-set">
        <Rail area={area} hand={hand} />
        {area.open === null ? (
          <div className="se-screen se-screen-area">
            {area.state ? (
              <p className="se-hint-line se-area-state">
                <PixelBody>{area.state}</PixelBody>
              </p>
            ) : null}
            <ol className="se-queue">
              {area.ground ? <GroundLine ground={area.ground} /> : null}
              {area.list.map((line) => (
                <Line
                  key={`${line.slot}:${line.id}`}
                  line={line}
                  many={area.list.filter((other) => other.slot === line.slot).length > 1}
                  hand={hand}
                  drag={drag}
                />
              ))}
            </ol>
            <hr className="se-rule" />
            <Stages area={area} hand={hand} />
          </div>
        ) : (
          <Station key={area.open} area={area} open={area.open} hand={hand} />
        )}
      </section>

      <section className="se-region se-region-held">
        <h3 className="se-region-head">
          <PixelIcon name="crate" />
          <PixelBody>Stored</PixelBody>
        </h3>
        <Held stock={area.shelf} capacity={area.capacity} />
      </section>
    </Modal>
  );
}

/** Pixel marks cut into the slab like the letters: rows of `#`, one cell to a font pixel. */
function Cut({ rows, className }: { rows: readonly string[]; className: string }): React.JSX.Element {
  const width = rows[0]?.length ?? 0;
  return (
    <span className={`se-cut ${className}`} aria-hidden="true">
      <svg
        viewBox={`0 0 ${width} ${rows.length}`}
        width={width * HEAD_SCALE}
        height={rows.length * HEAD_SCALE}
        shapeRendering="crispEdges"
        fill="currentColor"
      >
        {rows.flatMap((row, y) =>
          [...row].map((mark, x) => (mark === '#' ? <rect key={`${x}:${y}`} x={x} y={y} width="1" height="1" /> : null)),
        )}
      </svg>
    </span>
  );
}

const RING = ['..####..', '.#....#.', '#......#', '#......#', '#......#', '#......#', '.#....#.', '..####..'];
const RAISE = ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..'];

function emptyMark(): React.JSX.Element {
  return <Cut rows={RING} className="se-slot-empty" />;
}

/**
 * The rail: the one row that is both what stands here and the only way about the sheet. The yard
 * comes first, then a position per slot, and exactly one of them is marked, because what is
 * marked is what the body is showing.
 */
function Rail({ area, hand }: { area: AreaView; hand: AreaHand }): React.JSX.Element {
  return (
    <div className="se-slots" role="radiogroup" aria-label="this place">
      <button
        type="button"
        role="radio"
        aria-checked={area.open === null}
        aria-label="the yard"
        title="the yard"
        className="se-slot se-yard"
        onClick={() => hand.open(null)}
      >
        <Pointer shown={area.open === null} />
        <span className="se-slot-tile">
          <Cut rows={YARD} className="se-yard-mark" />
        </span>
      </button>
      <span className="se-rail-cut" aria-hidden="true" />
      {area.slots.map((slot, index) => {
        const open = area.open === index;
        const name = slot.label ?? 'empty';
        return (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={open}
            aria-label={name}
            title={name}
            className={`se-slot${slot.icon ? '' : ' se-slot-vacant'}${slot.blocked ? ' se-slot-blocked' : ''}${open ? '' : ' se-slot-off'}`}
            onClick={() => hand.open(index)}
          >
            <Pointer shown={open} />
            <span className="se-slot-tile">
              {slot.icon ? <PixelIcon name={slot.icon} /> : null}
              {slot.busy && !open ? <Smoke /> : null}
              {slot.blocked ? <Cross /> : null}
            </span>
          </button>
        );
      })}
      {area.locked.map((locked, index) => (
        <span key={`locked:${index}`} className="se-slot se-slot-locked se-slot-vacant" title={locked.stage}>
          <Pointer shown={false} />
          <span className="se-slot-tile">
            <Cut rows={CLOSED} className="se-closed" />
          </span>
        </span>
      ))}
    </div>
  );
}

const YARD = [
  '.....##..##..##.....',
  '..##............##..',
  '.##..............##.',
  '.##..............##.',
  '..##............##..',
  '.....##..##..##.....',
];

const CLOSED = ['...#####...', '...#####...', '#.#######.#', '...#####...', '...#####...'];

/** Three puffs climbing a step at a time, over a station that is working. */
function Smoke(): React.JSX.Element {
  return (
    <span className="se-smoke" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/** The red cross, the one mark that asks somebody to act. Never an item's shape. */
function Cross(): React.JSX.Element {
  return (
    <span className="se-cross" aria-hidden="true">
      <PixelIcon name="strike" />
    </span>
  );
}

/** Stage and the next raise, quiet and last: five pips, an arrow, what it costs as pips, the button. */
function Stages({ area, hand }: { area: AreaView; hand: AreaHand }): React.JSX.Element {
  return (
    <div className="se-stages">
      <span className="se-pips" role="img" aria-label={`stage ${area.stage + 1} of ${area.stages}`}>
        {Array.from({ length: area.stages }, (_, index) => (
          <i key={index} className={`se-pip${index <= area.stage ? ' se-pip-on' : ''}`} />
        ))}
      </span>
      {area.raise ? <NextStage raise={area.raise} hand={hand} /> : null}
    </div>
  );
}

const NEXT = ['#....', '##...', '###..', '####.', '###..', '##...', '#....'];

function NextStage({ raise, hand }: { raise: Raise; hand: AreaHand }): React.JSX.Element {
  const gathered = raise.cost.every(({ amount, have }) => have >= amount);
  return (
    <>
      <Cut rows={NEXT} className="se-next" />
      <span className="se-raise" title={raise.name}>
        {raise.cost.map(({ item, amount, have }) => (
          <span key={item} className="se-part" title={`${have} of ${amount} ${item}`}>
            <PixelIcon name={itemIcon(item)} />
            <span className="se-cost" aria-hidden="true">
              {Array.from({ length: amount }, (_, index) => (
                <i key={index} className={`se-cost-pip${index < have ? ' se-cost-on' : ''}`} />
              ))}
            </span>
          </span>
        ))}
      </span>
      {raise.ordered ? (
        <span className={gathered ? undefined : 'se-back'}>
          <Arrow progress={gathered ? raise.progress : 0} />
        </span>
      ) : (
        <button
          type="button"
          className={`se-raise-order${gathered ? ' se-ready' : ''}`}
          aria-label={`build it up to ${raise.name}`}
          title={`${raise.name}: ${raise.slots} slots`}
          onClick={() => hand.raise()}
        >
          <Cut rows={RAISE} className="se-raise-mark" />
        </button>
      )}
    </>
  );
}

/**
 * A station, and nothing else: what it is, how it is set, what it draws. It replaces the area's
 * list rather than standing under it, so the two subjects are never one column.
 */
function Station({ area, open, hand }: { area: AreaView; open: number; hand: AreaHand }): React.JSX.Element {
  const slot = area.slots[open];
  const removable = slot?.removable === true;
  const fires = area.panel && area.panel.process !== 'hand' ? area.panel : null;
  const draws = area.ground && area.ground.slot === open && !area.odds ? area.ground : null;

  return (
    <div className="se-screen se-screen-station">
      <h3 className="se-station-name">
        <PixelBody>{slot?.label ?? 'Empty'}</PixelBody>
      </h3>
      <hr className="se-rule" />
      {fires ? (
        <div className={fires.changingOver ? 'se-back' : undefined}>
          <Fires rig={fires} onPick={hand.charge} marked={false} />
        </div>
      ) : null}
      {draws ? (
        <div className="se-station-draws">
          <Parts parts={draws.makes} />
        </div>
      ) : null}
      {area.odds ? (
        <ul className="se-odds">
          {area.odds.map(({ item, chance }) => (
            <li key={item} className="se-part" title={`${Math.round(chance * 100)}% ${item}`}>
              <PixelIcon name={itemIcon(item)} />
              <span className="se-chance">
                <PixelBody>{`${Math.round(chance * 100)}%`}</PixelBody>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {area.choices ? (
        <ul className="se-choices">
          {area.choices.map((choice) => (
            <ChoiceRow key={choice.designId} choice={choice} hand={hand} />
          ))}
        </ul>
      ) : null}
      {removable ? (
        <button
          type="button"
          className="se-slot-remove se-back"
          aria-label={`take the ${slot?.label ?? 'station'} down`}
          title={`take the ${slot?.label ?? 'station'} down`}
          onClick={() => hand.remove(open)}
        >
          <PixelIcon name="raze" />
        </button>
      ) : null}
    </div>
  );
}

function ChoiceRow({ choice, hand }: { choice: Choice; hand: AreaHand }): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        className={`se-choice${choice.ok ? '' : ' se-dead'}`}
        disabled={!choice.ok}
        title={choice.ok ? choice.label : choice.reason}
        onClick={() => hand.place(choice.designId)}
      >
        <PixelIcon name={choice.icon} />
        <PixelBody>{choice.label}</PixelBody>
      </button>
    </li>
  );
}

/** Ten pips in the items' own colours, in proportion: what ten finds look like, not four percentages. */
function PoolStrip({ pool }: { pool: { item: Item; chance: number }[] }): React.JSX.Element {
  const cells: Item[] = [];
  const shares = pool.map((entry) => ({ ...entry, n: Math.floor(entry.chance * 10), rest: (entry.chance * 10) % 1 }));
  let left = 10 - shares.reduce((sum, entry) => sum + entry.n, 0);
  for (const entry of [...shares].sort((a, b) => b.rest - a.rest)) {
    if (left <= 0) break;
    entry.n += 1;
    left -= 1;
  }
  for (const entry of shares) for (let k = 0; k < entry.n; k += 1) cells.push(entry.item);
  return (
    <span className="se-strip" aria-hidden="true">
      {cells.map((item, index) => (
        <i key={index} style={{ background: ITEM_COLORS[item] }} />
      ))}
    </span>
  );
}

interface RowProps {
  station: React.ReactNode;
  uses: { item: string; amount: number }[];
  makes: { item: string; amount: number }[];
  pool?: { item: Item; chance: number }[] | undefined;
  seconds: number;
  progress: number;
  /** The input the row is short of: it gets the red cross, and the whole row goes quiet. */
  short?: string | null;
}

/** Station, inputs, time over arrow, outputs: the same four columns in every row. */
function Cells({ station, uses, makes, pool, seconds, progress, short }: RowProps): React.JSX.Element {
  const top = pool?.reduce((best, entry) => (entry.chance > best.chance ? entry : best));
  return (
    <>
      <span className="se-col-station">{station}</span>
      <span className="se-col-in">
        {uses.map(({ item, amount }, index) => (
          <span key={item} className="se-short-wrap">
            {index > 0 ? <PixelBody>+</PixelBody> : null}
            <Parts parts={[{ item, amount }]} />
            {item === short ? <Cross /> : null}
          </span>
        ))}
      </span>
      <span className="se-col-lane">
        <Arrow progress={progress} seconds={seconds} />
        {pool ? <PoolStrip pool={pool} /> : null}
      </span>
      <span className="se-col-out">
        {top ? <Parts parts={[{ item: top.item, amount: makes[0]?.amount ?? 1 }]} /> : <Parts parts={makes} />}
      </span>
    </>
  );
}

function GroundLine({ ground }: { ground: NonNullable<AreaView['ground']> }): React.JSX.Element {
  return (
    <li className="se-entry se-single">
      <Cells
        station={<PixelIcon name={ground.icon} />}
        uses={ground.uses}
        makes={ground.makes}
        pool={ground.pool}
        seconds={ground.seconds}
        progress={ground.progress}
      />
    </li>
  );
}

/** One line of the area's list: the station that makes it, and the recipe. */
function Line({
  line,
  many,
  hand,
  drag,
}: {
  line: ListLine;
  many: boolean;
  hand: AreaHand;
  drag: Drag;
}): React.JSX.Element {
  const held = drag.id === line.id;
  const stuck = line.short !== null;

  return (
    <li
      data-group={String(line.slot)}
      className={`se-entry${many ? '' : ' se-single'}${stuck ? ' se-stuck' : ''}${held ? ' se-held' : ''}`}
      style={held ? { transform: `translateY(${drag.lift}px)` } : undefined}
      tabIndex={many ? 0 : undefined}
      aria-label={`${line.label}${line.why ? `, ${line.why}` : ''}`}
      title={line.why || undefined}
      onPointerDown={many ? (event) => drag.start(event, line.id) : undefined}
      onPointerMove={(event) => drag.move(event, line.id)}
      onPointerUp={drag.end}
      onPointerCancel={drag.end}
      onKeyDown={(event) => {
        if (!many || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
        event.preventDefault();
        hand.move(line.id, line.slot, event.key === 'ArrowUp' ? -1 : 1);
      }}
    >
      <Cells
        station={<PixelIcon name={line.icon} />}
        uses={line.uses}
        makes={line.makes}
        seconds={line.seconds}
        progress={line.progress}
        short={line.short}
      />
    </li>
  );
}
