import { HEAD_SCALE } from '../pixel/ui/metrics.ts';
import type { TownStage } from '../render/townStage.ts';
import type { AreaHand, AreaView, Choice, ListLine, Raise, SlotView } from './areaView.ts';
import { PixelBody, PixelIcon, itemIcon } from './pixel/Pixel.tsx';
import { Arrow, Fires, Held, Modal, Pointer, Recipe, SLAB_PLATES, useDrag } from './RigSlab.tsx';
import type { Drag } from './RigSlab.tsx';
import { isStruck } from './rigView.ts';

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
        <SlotRow area={area} hand={hand} />
        <Stages area={area} hand={hand} />
        {area.open === null ? null : <SlotPanel key={area.open} area={area} open={area.open} hand={hand} />}
        {area.state ? (
          <p className="se-hint-line se-area-state">
            <PixelBody>{area.state}</PixelBody>
          </p>
        ) : null}
        <h4 className="se-region-sub">
          <PixelBody>Production</PixelBody>
        </h4>
        <ol className="se-queue">
          {area.ground ? (
            <li className={`se-entry se-single${area.ground.progress > 0 ? ' se-running' : ' se-back'}`}>
              <span className="se-line-icon">
                <PixelIcon name={area.ground.icon} />
              </span>
              <div className="se-entry-body">
                <Recipe entry={area.ground} />
              </div>
            </li>
          ) : null}
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

const TUFT = ['.#...#..', '.#.#.#.#', '#..#.#.#', '.#.#..#.', '########'];
const RING = ['..####..', '.#....#.', '#......#', '#......#', '#......#', '#......#', '.#....#.', '..####..'];
const RAISE = ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..'];

function emptyMark(kind: SlotView['kind']): React.JSX.Element {
  return kind === 'ground' ? <Cut rows={TUFT} className="se-slot-empty" /> : <Cut rows={RING} className="se-slot-empty" />;
}

/**
 * The slots as pictures, with the open one marked by the same arrow the chosen fire has. Every
 * tile keeps the arrow's room, so opening another moves nothing but the arrow.
 */
function SlotRow({ area, hand }: { area: AreaView; hand: AreaHand }): React.JSX.Element {
  return (
    <div className="se-slots" role="radiogroup" aria-label="slots">
      {area.slots.map((slot, index) => {
        const open = area.open === index;
        const name = slot.label ?? (slot.kind === 'ground' ? 'open ground' : 'empty');
        return (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={open}
            aria-label={name}
            title={name}
            className={`se-slot se-slot-${slot.kind}${slot.icon && !slot.busy && !open ? ' se-slot-idle' : ''}`}
            onClick={() => hand.open(index)}
          >
            <Pointer shown={open} />
            <span className="se-slot-tile">{slot.icon ? <PixelIcon name={slot.icon} /> : emptyMark(slot.kind)}</span>
          </button>
        );
      })}
      {area.locked.map((locked, index) => (
        <span key={`locked:${index}`} className="se-slot se-slot-locked" title={locked.stage}>
          <Pointer shown={false} />
          <span className="se-slot-tile">
            {emptyMark('work')}
            <span className="se-slot-strike">
              <PixelIcon name="strike" />
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}

/** How far the area has been built round, and the next stage if one can be ordered. */
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

function NextStage({ raise, hand }: { raise: Raise; hand: AreaHand }): React.JSX.Element {
  const gathered = raise.cost.every(({ amount, have }) => have >= amount);
  return (
    <span className="se-raise" title={raise.name}>
      {raise.cost.map(({ item, amount, have }) => (
        <span key={item} className={`se-part${have >= amount ? '' : ' se-back'}`} title={`${have} of ${amount} ${item}`}>
          <PixelIcon name={itemIcon(item)} />
          <PixelBody>{`${have}/${amount}`}</PixelBody>
        </span>
      ))}
      {raise.ordered ? (
        <span className={gathered ? undefined : 'se-back'}>
          <Arrow progress={gathered ? raise.progress : 0} />
        </span>
      ) : (
        <button
          type="button"
          className="se-raise-order"
          aria-label={`build it up to ${raise.name}`}
          title={`${raise.name}: ${raise.slots} slots`}
          onClick={() => hand.raise()}
        >
          <Cut rows={RAISE} className="se-raise-mark" />
        </button>
      )}
    </span>
  );
}

/**
 * The open slot's knobs, slid in under the row. Only knobs live here: the list is the area's,
 * one level up.
 */
function SlotPanel({ area, open, hand }: { area: AreaView; open: number; hand: AreaHand }): React.JSX.Element {
  const slot = area.slots[open];
  const removable = slot?.icon != null && slot.icon !== 'hearth' && slot.label !== 'Hearth';
  const fires = area.panel && area.panel.process !== 'hand' ? area.panel : null;

  return (
    <div className="se-slot-panel">
      {fires ? (
        <div className={fires.changingOver ? 'se-back' : undefined}>
          <Fires rig={fires} onPick={hand.charge} />
        </div>
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
          aria-label={`take the ${slot.label ?? 'station'} down`}
          title={`take the ${slot.label ?? 'station'} down`}
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
  const struck = isStruck(line);
  const held = drag.id === line.id;

  return (
    <li
      data-group={String(line.slot)}
      className={`se-entry${many ? '' : ' se-single'}${line.running ? ' se-running' : ' se-back'}${struck ? ' se-struck' : ''}${held ? ' se-held' : ''}`}
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
      <span className="se-line-icon">
        <PixelIcon name={line.icon} />
      </span>
      <div className="se-entry-body">
        <Recipe entry={line} />
      </div>
    </li>
  );
}
