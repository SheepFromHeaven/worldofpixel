import { TEXT_SCALE } from '../pixel/ui/metrics.ts';
import type { ItemType as Item } from '../sim/types.ts';
import type { AreaHand, AreaView, ListLine } from './areaView.ts';
import { PixelBody, PixelIcon, PixelText, itemIcon } from './pixel/Pixel.tsx';
import { Arrow, Cross, Parts } from './widgets.tsx';
import type { Drag } from './widgets.tsx';

interface RowProps {
  station: React.ReactNode;
  uses: { item: string; amount: number }[];
  makes: { item: string; amount: number }[];
  pool?: { item: Item; chance: number }[] | undefined;
  seconds: number;
  progress: number;
  short?: string | null;
  odds?: boolean;
}

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

export function GroundLines({ ground, hand }: { ground: AreaView['grounds'][number]; hand: AreaHand }): React.JSX.Element {
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

export function GroundLine({ ground }: { ground: AreaView['grounds'][number] }): React.JSX.Element {
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

export function Line({
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
