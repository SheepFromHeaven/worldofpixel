import { useSyncExternalStore } from 'react';
import { townStage } from '../render/townStage.ts';
import type { TownStage } from '../render/townStage.ts';
import { nextSteps } from '../sim/chapter.ts';
import { game } from './game.ts';
import type { Settlement } from '../sim/types.ts';
import { PixelHeading, PixelIcon, PixelText, itemIcon } from './pixel/Pixel.tsx';

function hintFor(hud: ReturnType<typeof game.getSnapshot>, settlement: Settlement | undefined): string {
  const next = settlement
    ? nextSteps(settlement).filter((step) => step.design !== undefined || step.work !== undefined)
    : [];
  const step = next[0];
  if (!step) return 'Zoom in to walk among it, or click anywhere to close.';

  if (step.work === 'well' && !hud.progress.drawsWater) {
    return hud.progress.water
      ? `Put a ${step.label} in a slot on a tile the water runs through — the nearest is ${hud.progress.water}.`
      : `Put a ${step.label} in a slot on a tile a river or a lake runs through.`;
  }

  const rest = next.slice(1).map((entry) => `a ${entry.label}`);
  return rest.length > 0
    ? `Put a ${step.label} in a slot, or ${rest.join(' or ')}.`
    : `Put a ${step.label} in a slot.`;
}

const PLATES: Record<TownStage, string> = {
  fire: 'se-slab',
  huts: 'se-slab',
  village: 'se-parchment',
  stone: 'se-chalkboard',
};

export function Ledger(): React.JSX.Element | null {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);

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
