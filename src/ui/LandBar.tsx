import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { LAND_WORKS, landWorkById } from '../sim/landWorks.ts';
import { designIdOfTool, game, placeTool } from './game.ts';
import { PixelIcon, PixelText } from './pixel/Pixel.tsx';
import type { IconName } from './pixel/Pixel.tsx';

const LAND_ICONS: Record<string, IconName> = {
  well: 'well',
  digging: 'dig',
};

const iconFor = (id: string): IconName => LAND_ICONS[id] ?? 'design';

/**
 * The land works, apart from the library: they are not drawn, they are sited. A parcel can hold
 * several items, so the player picks which work to raise and the ghost on the map says whether
 * the ground under it holds that item.
 */
export function LandBar(): React.JSX.Element {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const [picking, setPicking] = useState(false);
  const pickerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!picking) return;

    const onPointerDown = (event: PointerEvent): void => {
      if (!pickerRef.current?.contains(event.target as Node)) setPicking(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setPicking(false);
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [picking]);

  const heldId = designIdOfTool(hud.tool);
  const held = heldId === null ? undefined : landWorkById(heldId);

  return (
    <span className="se-picker-wrap" ref={pickerRef}>
      {picking ? (
        <div className="se-picker">
          <span className="se-picker-title">
            <PixelText>land</PixelText>
          </span>
          {LAND_WORKS.map(({ design, item }) => (
            <span key={design.id} className="se-picker-row">
              <button
                type="button"
                className="se-tool"
                title={`Draws ${item} out of any parcel that holds it`}
                onClick={() => {
                  game.setTool(placeTool(design.id));
                  setPicking(false);
                }}
              >
                <PixelIcon name={iconFor(design.id)} />
                <PixelText>{design.label}</PixelText>
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        className={held ? 'se-tool se-build se-on' : 'se-tool se-build'}
        title={
          held
            ? `Holding a ${held.design.label} — click ground that holds ${held.item}, shift to keep it in hand`
            : 'Open the ground: a well, a dig site, a woodcutter'
        }
        onClick={() => setPicking(!picking)}
      >
        <PixelIcon name={held ? iconFor(held.design.id) : 'dig'} />
        <PixelText>{held ? held.design.label : 'Land'}</PixelText>
      </button>
    </span>
  );
}
