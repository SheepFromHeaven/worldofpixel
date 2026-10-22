import { HEAD_SCALE, TEXT_SCALE } from '../pixel/ui/metrics.ts';
import type { ItemType as Item } from '../sim/types.ts';
import type { TownStage } from '../render/townStage.ts';
import type { AreaHand, AreaView, Choice, ListLine } from './areaView.ts';
import { PixelBody, PixelIcon, PixelText, itemIcon } from './pixel/Pixel.tsx';
import { Arrow, Fires, Held, Parts, SLAB_PLATES, useDrag } from './RigSlab.tsx';
import type { Drag } from './RigSlab.tsx';

/**
 * The area's inspector, docked to the right edge and never over the middle of the map
 * (`docs/methods.html` §3, "Nothing covers the middle"). Stacked sections, each a word and a
 * rule: `work` is the slots and the way about the rail, the middle one is `production` or the
 * chosen station by its own name, and `stored` stands on both. Only the middle one ever changes.
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
  const chosen = area.open === null ? undefined : area.slots[area.open];

  return (
    <aside className={`se-rig se-dock ${SLAB_PLATES[stage]}`} aria-label="work area">
      <Header area={area} hand={hand} />
      <Section label="work">
        <Slots area={area} hand={hand} />
      </Section>
      {area.open === null ? (
        <Section label="production">
          {area.state ? (
            <p className="se-hint-line se-area-state">
              <PixelBody>{area.state}</PixelBody>
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
        </Section>
      ) : (
        <Section label={chosen?.label ?? 'empty'}>
          <Station key={area.open} area={area} open={area.open} hand={hand} drag={drag} />
        </Section>
      )}
      <Section label="stored">
        <Held stock={area.shelf} capacity={area.capacity} />
      </Section>
    </aside>
  );
}

/** A word and a rule under it, and rows beneath: the only thing that tells two subjects apart. */
function Section({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="se-rsec">
      <h4 className="se-rsec-head">
        <PixelBody>{label}</PixelBody>
      </h4>
      {children}
    </section>
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
 * The header line: the yard mark, which puts the rail back to `production`; the five stage pips;
 * and the one control that spends materials. What the next stage costs sits under it as the item
 * and pips that fill as the goods arrive.
 */
function Header({ area, hand }: { area: AreaView; hand: AreaHand }): React.JSX.Element {
  const raise = area.raise;
  const gathered = raise ? raise.cost.every(({ amount, have }) => have >= amount) : false;
  return (
    <header className="se-header">
      <div className="se-header-row">
        <button
          type="button"
          className="se-yard"
          aria-label="the yard"
          title="the yard"
          onClick={() => hand.open(null)}
        >
          <Cut rows={YARD} className="se-yard-mark" />
        </button>
        <span className="se-pips" role="img" aria-label={`stage ${area.stage + 1} of ${area.stages}`}>
          {Array.from({ length: area.stages }, (_, index) => (
            <i key={index} className={`se-pip${index <= area.stage ? ' se-pip-on' : ''}`} />
          ))}
        </span>
        {raise && !raise.ordered ? (
          <button
            type="button"
            className={`se-raise-order${gathered ? ' se-ready' : ''}`}
            aria-label={`build it up to ${raise.name}`}
            title={`${raise.name}: ${raise.slots} slots`}
            onClick={() => hand.raise()}
          >
            <Cut rows={RAISE} className="se-raise-mark" />
          </button>
        ) : null}
      </div>
      {raise ? (
        <div className="se-header-row se-raise" title={raise.name}>
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
          {raise.ordered ? (
            <span className={gathered ? undefined : 'se-back'}>
              <Arrow progress={gathered ? raise.progress : 0} />
            </span>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

/**
 * What stands here, three to a row, as the things themselves. The chosen one is lifted out of the
 * grid, which is the only mark there is; pressing it again puts it back. An empty slot is a dashed
 * patch of ground and one not yet built the same patch with a small closed mark.
 */
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
            className={`se-cell${slot.icon ? '' : ' se-cell-vacant'}${open ? ' se-cell-on' : ''}${slot.blocked ? ' se-slot-blocked' : ''}`}
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
      {area.locked.map((locked, index) => (
        <span key={`locked:${index}`} className="se-cell se-cell-vacant se-cell-locked" title={locked.stage}>
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

/**
 * A station, and nothing else: what it is, how it is set, what it draws. It replaces the area's
 * list rather than standing under it, so the two subjects are never one column.
 */
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
  const fires = area.panel && area.panel.process !== 'hand' ? area.panel : null;
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
        <PixelBody>{choice.label}</PixelBody>
        {choice.ok ? null : (
          <span className="se-choice-why">
            <PixelText scale={TEXT_SCALE}>{choice.reason}</PixelText>
          </span>
        )}
      </button>
    </li>
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
  /** Write the chance under each find: for the station's own screen, never the overview. */
  odds?: boolean;
}

/** Station, inputs, time over arrow, outputs: the same four columns in every row. */
function Cells({ station, uses, makes, pool, seconds, progress, short, odds }: RowProps): React.JSX.Element {
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
      </span>
      <span className="se-col-out">
        {pool ? (
          <>
            <PixelBody>{`×${makes[0]?.amount ?? 1}`}</PixelBody>
            {pool.map(({ item, chance }) => (
              <span key={item} className="se-find" title={`${Math.round(chance * 100)}% ${item}`}>
                <PixelIcon name={itemIcon(item)} />
                {odds ? <PixelText scale={TEXT_SCALE}>{`${Math.round(chance * 100)}%`}</PixelText> : null}
              </span>
            ))}
            {odds && pool.reduce((sum, entry) => sum + entry.chance, 0) < 0.995 ? (
              <span className="se-find" title="nothing">
                <PixelText scale={TEXT_SCALE}>–</PixelText>
                <PixelText scale={TEXT_SCALE}>{`${Math.round((1 - pool.reduce((sum, entry) => sum + entry.chance, 0)) * 100)}%`}</PixelText>
              </span>
            ) : null}
          </>
        ) : (
          <Parts parts={makes} />
        )}
      </span>
    </>
  );
}

/**
 * The recipes of a land work on its own screen, with the chances written under each find. When it
 * has more than one they are the choice: press one to set the work to it, and the rest sit back.
 */
function GroundLines({ ground, hand }: { ground: AreaView['grounds'][number]; hand: AreaHand }): React.JSX.Element {
  if (ground.recipes.length < 2) {
    return (
      <li className="se-entry se-single">
        <Cells
          station={<PixelIcon name={ground.icon} />}
          uses={ground.uses}
          makes={ground.makes}
          pool={ground.pool}
          seconds={ground.seconds}
          progress={ground.progress}
          odds
        />
      </li>
    );
  }
  return (
    <>
      {ground.recipes.map((pool, index) => {
        const chosen = index === ground.recipe;
        return (
          <li key={index} className="se-recipe-li">
            <button
              type="button"
              role="radio"
              aria-checked={chosen}
              className={`se-entry se-single se-pick${chosen ? '' : ' se-back'}`}
              title={pool.map((entry) => `${Math.round(entry.chance * 100)}% ${entry.item}`).join(', ')}
              onClick={() => hand.recipe(ground.slot, index)}
            >
              <Cells
                station={<PixelIcon name={ground.icon} />}
                uses={[]}
                makes={[{ item: pool[0]?.item ?? '', amount: ground.makes[0]?.amount ?? 1 }]}
                pool={pool}
                seconds={ground.seconds}
                progress={chosen ? ground.progress : 0}
                odds
              />
            </button>
          </li>
        );
      })}
    </>
  );
}

function GroundLine({ ground }: { ground: AreaView['grounds'][number] }): React.JSX.Element {
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
