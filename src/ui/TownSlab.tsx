import type { TownStage } from '../render/townStage.ts';
import { SLAB_PLATES, Held } from './RigParts.tsx';
import { DAY_LABELS } from './townView.ts';
import type { DayHours, TownView } from './townView.ts';
import { PixelBody, PixelHeading, PixelIcon } from './pixel/Pixel.tsx';
import { Tally } from './pixel/Tally.tsx';

/**
 * What the town can see of itself.
 *
 * The player's complaint this answers is "I have no idea how the day of my people looks", and
 * the hard part is answering it without handing over an instrument nobody has built. So every
 * mark on this slab is something a person standing in the town could count: how many of them
 * there are, how many have a roof, what is standing in which building, and where the hours of
 * a day go. No rate, no share, no curve — section 10's fog rule covers the whole panel, not
 * only the fires, and a line between two settings nobody can tell apart is a lie whether it is
 * drawn under a damper or under a day.
 *
 * It is cut into the same stone as the ledger and the rig's slab, and it ages with the town for
 * the same reason.
 */
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

/**
 * Where a waking day goes, as the hours themselves.
 *
 * A stacked bar was here and had to come out: it is a progress bar wearing another hat and a
 * percentage drawn sideways, and a share of a day is arithmetic over a total nobody in this
 * town has counted. What a person would scratch instead is the day itself — fourteen notches,
 * cut in fives, grouped by what each stretch of them went on and laid out in the order they
 * were spent. Sleeping first, because that is where a day starts.
 *
 * Whole hours, and they come to fourteen exactly (`game.ts` shares out the remainders), so the
 * column is a day and not six roundings standing near each other. The sun is the instrument
 * this town owns and it reads to about an hour; a figure of 1.6 would be claiming a clock.
 */
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
