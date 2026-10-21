import { useSyncExternalStore } from 'react';
import { townStage } from '../render/townStage.ts';
import type { TownStage } from '../render/townStage.ts';
import { game } from './game.ts';
import type { Budget } from '../sim/needs.ts';
import { Tally } from './pixel/Tally.tsx';
import { PixelHeading, PixelIcon, PixelText, itemIcon } from './pixel/Pixel.tsx';

/**
 * One next move, picked from where the settlement actually is. A static tip is read once and
 * never again; this is the thing that makes the opening — found, dig, draw water, mix —
 * legible without a tutorial sitting on top of the game.
 */
function hintFor(hud: ReturnType<typeof game.getSnapshot>): string {
  const { buildings, drawsWater, combines, kept } = hud.progress;

  if (buildings < 2) return 'Raise a Dirt Dig beside the fire — earth is under every parcel.';
  if (!drawsWater) {
    return hud.progress.water
      ? `Raise a Well on a tile the water runs through — the nearest is ${hud.progress.water}.`
      : 'Raise a Well on a tile a river or a lake runs through.';
  }
  if (!combines) {
    return 'Raise a Works on open ground, then click it: fit it out while the site is being dug.';
  }
  if (kept === 0) return 'The villagers wear paths between the buildings as they work. What is made fills the store.';
  return 'Zoom in to walk among it, or click anywhere to close.';
}

/**
 * What the town keeps its books on. A fire and a few works have no chalk and no mill to beat a
 * sheet out of, so the ledger is scratched into sandstone until the town can do better — which
 * says how far it has got before a word on it is read.
 */
const PLATES: Record<TownStage, string> = {
  fire: 'se-slab',
  huts: 'se-slab',
  village: 'se-parchment',
  stone: 'se-chalkboard',
};

/**
 * The score, and the only one: the share of the town's whole day that is not survival.
 *
 * Drawn as the hours themselves rather than as a percentage, because a percentage is arithmetic
 * over a total nobody in this town has counted — and as a tally rather than a numeral, because
 * that is what a count looks like scratched into a slab. The bar underneath is the same day
 * split by what it goes on, in the goods' own colours, which is the one place the breakdown is
 * worth having: a player who can see that food is half the day knows what to go and fix.
 */
function SpareHours({ surplus }: { surplus: Budget }): React.JSX.Element {
  const { hours, shares } = surplus;
  const parts: [string, number, string][] = [
    ['water', shares.water, 'var(--se-need-water)'],
    ['food', shares.food, 'var(--se-need-food)'],
    ['prep', shares.prep, 'var(--se-need-prep)'],
    ['fuel', shares.fuel, 'var(--se-need-fuel)'],
    ['rest', shares.rest, 'var(--se-need-rest)'],
    ['work', shares.work, 'var(--se-need-work)'],
  ];

  return (
    <div className="se-spare">
      <h3>
        <PixelText>Spare hours a day</PixelText>
      </h3>
      <div className="se-spare-count">
        <Tally count={surplus.surplusHours} title={`${surplus.surplusHours} hours`} />
      </div>
      <div className="se-day" title={parts.map(([name, , ]) => name).join(' · ')}>
        {parts.map(([name, share, color]) => (
          <i
            key={name}
            className={`se-day-part${name === 'work' ? ' se-day-work' : ''}`}
            title={`${name} ${hours[name as keyof typeof hours]}h`}
            style={{ flexGrow: Math.max(0.0001, share), background: color }}
          />
        ))}
      </div>
    </div>
  );
}

export function Ledger(): React.JSX.Element | null {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);

  // The ledger is a town's own sheet, not a readout of whatever the camera is over: it opens
  // with the town and goes away with it.
  if (!hud.openSettlement) return null;

  return (
    <aside className={`se-ledger ${PLATES[townStage(hud.progress.buildings)]}`}>
      <h2>
        <PixelHeading>{hud.settlementName ?? 'Unsettled'}</PixelHeading>
      </h2>
      <p className="se-hint">
        <PixelIcon name="next" />
        <PixelText>{hintFor(hud)}</PixelText>
      </p>

      <SpareHours surplus={hud.progress.surplus} />

      {hud.carriers.length > 0 ? (
        <h3>
          <PixelText>Carriers</PixelText>
        </h3>
      ) : null}
      <ul className="se-list">
        {hud.carriers.map((carrier) => (
          <li key={carrier.id}>
            <span className="se-name">
              <PixelText>{carrier.id.split('/').pop() ?? carrier.id}</PixelText>
            </span>
            <span className="se-state">
              <PixelText>{carrier.state.toLowerCase().replace(/_/g, ' ')}</PixelText>
            </span>
            <span className="se-cargo">
              {carrier.carrying ? <PixelIcon name={itemIcon(carrier.carrying)} /> : null}
              <PixelText>{carrier.carrying ?? '-'}</PixelText>
            </span>
          </li>
        ))}
      </ul>

      <h3>
        <PixelIcon name="crate" />
        <PixelText>In the town store</PixelText>
      </h3>
      <ul className="se-list">
        {hud.delivered.length === 0 ? (
          <li className="se-empty">
            <PixelText>empty</PixelText>
          </li>
        ) : null}
        {hud.delivered.map(([item, amount]) => (
          <li key={item}>
            <span className="se-name">
              <PixelIcon name={itemIcon(item)} />
              <PixelText>{item}</PixelText>
            </span>
            <span className="se-cargo">
              <PixelText>{`x${amount}`}</PixelText>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
