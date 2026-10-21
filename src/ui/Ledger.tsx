import { useSyncExternalStore } from 'react';
import { townStage } from '../render/townStage.ts';
import type { TownStage } from '../render/townStage.ts';
import { nextSteps } from '../sim/chapter.ts';
import { game } from './game.ts';
import type { Budget } from '../sim/needs.ts';
import type { Settlement } from '../sim/types.ts';
import { Tally } from './pixel/Tally.tsx';
import { PixelHeading, PixelIcon, PixelText, itemIcon } from './pixel/Pixel.tsx';

/**
 * One next move, read off the chapter rather than written out again here (`chapter.ts`). A
 * sequence spelled out in the HUD is a second copy of the progression, and the two part company
 * the first time a step is added to one of them.
 *
 * Only steps with something to place: a method the town has earned is written into the book the
 * moment it is earned, so naming one here would be telling the player to do a thing that has
 * already happened.
 */
function hintFor(hud: ReturnType<typeof game.getSnapshot>, settlement: Settlement | undefined): string {
  const next = settlement
    ? nextSteps(settlement).filter((step) => step.design !== undefined || step.work !== undefined)
    : [];
  const step = next[0];
  if (!step) return 'Zoom in to walk among it, or click anywhere to close.';

  if (step.work === 'well' && !hud.progress.drawsWater) {
    return hud.progress.water
      ? `Site a ${step.label} on a tile the water runs through — the nearest is ${hud.progress.water}.`
      : `Site a ${step.label} on a tile a river or a lake runs through.`;
  }

  const verb = step.work === undefined ? 'Raise' : 'Site';
  const rest = next.slice(1).map((entry) => `a ${entry.label}`);
  return rest.length > 0
    ? `${verb} a ${step.label}, or ${rest.join(' or ')}.`
    : `${verb} a ${step.label}.`;
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
 * that is what a count looks like scratched into a slab.
 *
 * There is no breakdown here. The day split by what it goes on was drawn as a stacked bar, which
 * is a progress bar wearing another hat and a percentage drawn sideways; the breakdown belongs a
 * click away, as a picture of the things themselves, and until there is one the tally stands
 * alone rather than a chart standing in for it.
 */
function SpareHours({ surplus }: { surplus: Budget }): React.JSX.Element {
  return (
    <div className="se-spare">
      <h3>
        <PixelText>Spare hours a day</PixelText>
      </h3>
      <div className="se-spare-count">
        <Tally count={surplus.surplusHours} title={`${surplus.surplusHours} hours`} />
      </div>
    </div>
  );
}

export function Ledger(): React.JSX.Element | null {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);

  // The ledger is a town's own sheet, not a readout of whatever the camera is over: it opens
  // with the town and goes away with it.
  if (!hud.openSettlement) return null;
  const settlement = game.openSettlement();

  return (
    <aside className={`se-ledger ${PLATES[townStage(hud.progress.buildings)]}`}>
      <h2>
        <PixelHeading>{hud.settlementName ?? 'Unsettled'}</PixelHeading>
      </h2>
      <p className="se-hint">
        <PixelIcon name="next" />
        <PixelText>{hintFor(hud, settlement)}</PixelText>
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
