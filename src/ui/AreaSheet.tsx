import { HEAD_SCALE, TEXT_SCALE } from '../pixel/ui/metrics.ts';
import type { TownStage } from '../render/townStage.ts';
import type { AreaHand, AreaView, Choice, Raise } from './areaView.ts';
import { PixelIcon, PixelText, itemIcon } from './pixel/Pixel.tsx';
import { GroundLine, GroundLines, Line } from './recipeRows.tsx';
import type { Drag } from './widgets.tsx';
import { Arrow, Cross, Fires, SLAB_PLATES, useDrag } from './widgets.tsx';

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
  const chosen = area.open === null ? undefined : area.slots[area.open];
  const lot = area.open !== null && area.open >= area.slots.length ? area.raise : null;

  return (
    <aside className={`se-rig se-dock ${SLAB_PLATES[stage]}`} aria-label="work area">
      <Frame label="work">
        <Slots area={area} hand={hand} />
      </Frame>
      {lot ? (
        <Frame label="open this lot">
          <LotPanel raise={lot} hand={hand} />
        </Frame>
      ) : area.open === null ? (
        <Frame label="production">
          {area.state ? (
            <p className="se-hint-line se-area-state">
              <PixelText scale={TEXT_SCALE}>{area.state}</PixelText>
            </p>
          ) : null}
          <ol className="se-queue">
            {area.grounds.map((ground) => (
              <GroundLine key={`ground:${ground.slot}`} ground={ground} />
            ))}
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
        </Frame>
      ) : (
        <Frame label={(chosen?.label ?? 'empty').toLowerCase()}>
          <Station key={area.open} area={area} open={area.open} hand={hand} drag={drag} />
        </Frame>
      )}
      <Frame label="stored">
        <Stored area={area} />
      </Frame>
    </aside>
  );
}

function Frame({ label, children }: { label?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="se-frame">
      <div className="se-frame-top">
        <i className="se-frame-stub" />
        {label ? (
          <span className="se-frame-label">
            <PixelText scale={TEXT_SCALE}>{label}</PixelText>
          </span>
        ) : null}
        <i className="se-frame-run" />
      </div>
      <div className="se-frame-body">{children}</div>
    </section>
  );
}

function Stored({ area }: { area: AreaView }): React.JSX.Element {
  if (area.shelf.length === 0) {
    return (
      <p className="se-empty">
        <PixelText scale={TEXT_SCALE}>empty</PixelText>
      </p>
    );
  }
  return (
    <ul className="se-goods">
      {area.shelf.map(([item, amount]) => (
        <li
          key={item}
          className={`se-hollow se-good${amount >= area.capacity ? ' se-full' : ''}`}
          title={`${amount} of ${area.capacity} ${item}`}
        >
          <PixelIcon name={itemIcon(item)} />
          <span className="se-good-count">
            <PixelText scale={TEXT_SCALE}>{`${amount}/${area.capacity}`}</PixelText>
          </span>
        </li>
      ))}
    </ul>
  );
}

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

function LotPanel({ raise, hand }: { raise: Raise; hand: AreaHand }): React.JSX.Element {
  const gathered = raise.cost.every(({ amount, have }) => have >= amount);
  return (
    <div className="se-lot">
      <PixelText scale={TEXT_SCALE}>{raise.name}</PixelText>
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
      <span className="se-lot-gives">
        <PixelText scale={TEXT_SCALE}>one more lot</PixelText>
      </span>
      {raise.takes ? (
        <span className="se-warn">
          <PixelText scale={TEXT_SCALE}>{raise.takes}</PixelText>
        </span>
      ) : null}
      <div className="se-lot-act">
        {raise.ordered ? (
          <span className={gathered ? undefined : 'se-back'}>
            <Arrow progress={gathered ? raise.progress : 0} />
          </span>
        ) : (
          <button
            type="button"
            className={`se-hollow se-lifted se-open${gathered ? ' se-ready' : ''}`}
            aria-label={`open the lot: ${raise.name}`}
            onClick={() => hand.raise()}
          >
            <PixelText scale={TEXT_SCALE}>open</PixelText>
          </button>
        )}
      </div>
    </div>
  );
}

function Slots({ area, hand }: { area: AreaView; hand: AreaHand }): React.JSX.Element {
  return (
    <div className="se-cells" role="radiogroup" aria-label="slots">
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
            className={`se-cell se-hollow${slot.icon ? '' : ' se-cell-vacant'}${open ? ' se-lifted' : ''}${slot.blocked ? ' se-slot-blocked' : ''}`}
            onClick={() => hand.open(index)}
          >
            <span className="se-slot-tile">
              {slot.icon ? <PixelIcon name={slot.icon} /> : null}
              {slot.busy && !open ? <Smoke /> : null}
              {slot.blocked ? <Cross /> : null}
            </span>
          </button>
        );
      })}
      {area.locked.map((locked, index) => {
        const at = area.slots.length + index;
        return (
          <button
            key={`locked:${index}`}
            type="button"
            role="radio"
            aria-checked={area.open === at}
            aria-label={`a lot to open: ${locked.stage}`}
            title={locked.stage}
            className={`se-cell se-hollow se-cell-vacant se-cell-locked${area.open === at ? ' se-lifted' : ''}`}
            onClick={() => hand.open(at)}
          >
            <span className="se-slot-tile">
              <Cut rows={CLOSED} className="se-closed" />
            </span>
          </button>
        );
      })}
    </div>
  );
}

const CLOSED = ['...#####...', '...#####...', '#.#######.#', '...#####...', '...#####...'];

function Smoke(): React.JSX.Element {
  return (
    <span className="se-smoke" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function Station({
  area,
  open,
  hand,
  drag,
}: {
  area: AreaView;
  open: number;
  hand: AreaHand;
  drag: Drag;
}): React.JSX.Element {
  const slot = area.slots[open];
  const removable = slot?.removable === true;
  const fires = area.panel;
  const ground = area.grounds.find((entry) => entry.slot === open);
  const lines = area.list.filter((line) => line.slot === open);

  return (
    <div className="se-station">
      {fires ? (
        <div className={fires.changingOver ? 'se-back' : undefined}>
          <Fires rig={fires} onPick={hand.charge} marked={false} compact />
        </div>
      ) : null}
      {ground || lines.length > 0 ? (
        <ol className="se-queue">
          {ground ? <GroundLines ground={ground} hand={hand} /> : null}
          {lines.map((line) => (
            <Line key={`${line.slot}:${line.id}`} line={line} many={lines.length > 1} hand={hand} drag={drag} />
          ))}
        </ol>
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
        <PixelText scale={TEXT_SCALE}>{choice.label}</PixelText>
        {choice.ok ? null : (
          <span className="se-choice-why">
            <PixelText scale={TEXT_SCALE}>{choice.reason}</PixelText>
          </span>
        )}
      </button>
    </li>
  );
}
