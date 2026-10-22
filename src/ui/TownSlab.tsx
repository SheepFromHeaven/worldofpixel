import type { TownStage } from '../render/townStage.ts';
import { PixelBody, PixelHeading, PixelIcon } from './pixel/Pixel.tsx';
import { Tally } from './pixel/Tally.tsx';
import type { DayHours, TownView } from './townView.ts';
import { DAY_LABELS } from './townView.ts';
import { Held, SLAB_PLATES } from './widgets.tsx';

export function TownSlab({ town, stage }: { town: TownView; stage: TownStage }): React.JSX.Element {
  return (
    <aside className={`se-town ${SLAB_PLATES[stage]}`}>
      <h2>
        <PixelHeading>{town.name}</PixelHeading>
      </h2>

      <ul className="se-count-list">
        <Count label="people" count={town.people} />
        <Count label="with a roof" count={town.sheltered} />
        <Count label="water carriers" count={town.vessels} />
        <Count label="buildings" count={town.buildings} />
      </ul>

      <h3>
        <PixelBody>A day, for each of them</PixelBody>
      </h3>
      <Day day={town.day} />

      {/*
       * The score, circled the way anybody circles the figure they are actually after. It is
       * the one line on the slab that is about the whole band rather than about one of them,
       * which is why it stands outside the day and is named as such.
       */}
      <div className="se-day-spare">
        <span className="se-day-spare-name">
          <PixelBody>spare hours a day, between them all</PixelBody>
        </span>
        <span className="se-circled">
          <Tally count={town.spare} title={`${town.spare} hours`} />
        </span>
      </div>

      <h3>
        <PixelIcon name="crate" />
        <PixelBody>What is standing where</PixelBody>
      </h3>
      {town.standing.length === 0 ? (
        <p className="se-empty">
          <PixelBody>nothing is lying about</PixelBody>
        </p>
      ) : null}
      <ul className="se-standing">
        {town.standing.map((building) => (
          <li key={building.id}>
            <span className="se-standing-name">
              <PixelBody>{building.label}</PixelBody>
            </span>
            {building.stock.length > 0 ? <Held stock={building.stock} capacity={building.capacity} /> : null}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Count({ label, count }: { label: string; count: number }): React.JSX.Element {
  return (
    <li>
      <span className="se-row-name">
        <PixelBody>{label}</PixelBody>
      </span>
      <Tally count={count} title={`${count}`} />
    </li>
  );
}

function Day({ day }: { day: DayHours[] }): React.JSX.Element {
  return (
    <ul className="se-day">
      {day.map((part) => (
        <li key={part.part} className={part.part === 'work' ? 'se-day-work' : undefined}>
          <span className="se-row-name">
            <PixelBody>{DAY_LABELS[part.part]}</PixelBody>
          </span>
          <Tally count={part.hours} title={`${part.hours} hours`} />
        </li>
      ))}
    </ul>
  );
}
