import { useSyncExternalStore } from 'react';
import { game } from './game.ts';
import { PixelHeading, PixelIcon, PixelText, itemIcon } from './pixel/Pixel.tsx';

/**
 * One next move, picked from where the settlement actually is. A static tip is read once and
 * never again; this is the thing that makes the opening — found, dig, draw water, mix, road it —
 * legible without a tutorial sitting on top of the game.
 */
function hintFor(hud: ReturnType<typeof game.getSnapshot>): string {
  const { buildings, roads, drawsWater, combines, kept } = hud.progress;

  if (hud.designerOpen) return 'Blocks on the grid, then save it. The library keeps what you draw.';
  if (hud.openBuilding) return 'Watch the squares move. Click anywhere to close.';
  if (hud.openSettlement) return 'The town from far off. Zoom in to walk among it.';
  if (hud.detail === 'coarse') return 'Scroll to zoom in on the land. Drag to move across it.';
  if (hud.detail === 'medium') {
    return hud.settlementCount > 0
      ? 'Click a town to read its ledger, or keep zooming to walk among it.'
      : 'Keep zooming until the ground resolves into parcels.';
  }
  if (hud.settlementCount === 0) return 'Take the hearth and click open ground to settle it.';
  if (buildings < 2) return 'Raise a Dirt Dig beside the fire — earth is under every parcel.';
  if (roads === 0) return 'Click the dig with the dirt path tool to run a road out to it.';
  if (!drawsWater) {
    return hud.progress.water
      ? `Raise a Well on a tile the water runs through — the nearest is ${hud.progress.water}.`
      : 'Raise a Well on a tile a river or a lake runs through.';
  }
  if (!combines) return 'Raise a Mud Mixer on open ground; carriers will bring it water and earth.';
  if (kept === 0) return 'Click each building with the dirt path tool. What is made fills the store.';
  return 'Click a building to watch the work inside — or draw your own from the build menu.';
}

export function Ledger(): React.JSX.Element {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);

  return (
    <aside className="se-ledger">
      <h2>
        <PixelHeading>{hud.settlementName ?? 'Unsettled'}</PixelHeading>
      </h2>
      <p className="se-hint">
        <PixelIcon name="next" />
        <PixelText>{hintFor(hud)}</PixelText>
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

      {hud.settlementCount > 0 ? (
        <>
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
        </>
      ) : null}

      <p className="se-hovered">
        <PixelText>{hud.hovered ?? ''}</PixelText>
      </p>
    </aside>
  );
}
