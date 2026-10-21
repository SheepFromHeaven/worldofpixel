import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { STEPS, workOpen } from '../sim/chapter.ts';
import { landWorkById } from '../sim/landWorks.ts';
import type { LandWork } from '../sim/landWorks.ts';
import { designIdOfTool, game, placeTool } from './game.ts';
import type { IconName } from './pixel/Pixel.tsx';
import { PixelSection, PixelTile } from './pixel/Tile.tsx';

const LAND_ICONS: Record<string, IconName> = {
  well: 'well',
  digging: 'dig',
  woodcutter: 'woodcutter',
  'bank-dig': 'mud',
  'clay-pit': 'clay',
  'reed-bed': 'fibre',
};

const iconFor = (id: string): IconName => LAND_ICONS[id] ?? 'land';

/**
 * The resource buildings. They are not drawn and have no interior to fit out — they are
 * *sited*, and the ground says yes or no. A parcel can hold several items, so the player picks
 * which one to open and the ghost on the map says whether the ground under it holds that item.
 *
 * Only the ones the chapter has reached are on it, in the chapter's own order (`chapter.ts`):
 * the band gathers deadwood and cuts a bank before anything wants earth or clay, and the water
 * hole is a step the town earns rather than a tile it has always had.
 */
export function LandBar(): React.JSX.Element | null {
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

  const town = game.townAt(game.camera.centre);
  const reached: LandWork[] = [];
  for (const step of STEPS) {
    if (step.work === undefined || town === undefined) continue;
    if (!workOpen(town, step.work)) continue;
    const work = landWorkById(step.work);
    if (work) reached.push(work);
  }
  if (reached.length === 0) return null;

  const heldId = designIdOfTool(hud.tool);
  const held = heldId === null ? undefined : landWorkById(heldId);

  return (
    <span className="se-picker-wrap" ref={pickerRef}>
      {picking ? (
        <div className="se-picker">
          <PixelSection icon="land" label="resources" />
          {reached.map(({ design, item }) => (
            <span key={design.id} className="se-picker-row">
              <PixelTile
                icon={iconFor(design.id)}
                label={design.label}
                reason={`draws ${item.toLowerCase()}`}
                title={`Draws ${item} out of any parcel that holds it`}
                held={heldId === design.id}
                onClick={() => {
                  game.setTool(placeTool(design.id));
                  setPicking(false);
                }}
              />
            </span>
          ))}
        </div>
      ) : null}

      <PixelTile
        wide
        icon={held ? iconFor(held.design.id) : 'land'}
        label={held ? held.design.label : 'Resources'}
        title={
          held
            ? `Holding a ${held.design.label} — click ground that holds ${held.item}, shift to keep it in hand`
            : 'Open the ground: what a parcel holds is what can be drawn out of it'
        }
        held={held !== undefined}
        onClick={() => setPicking(!picking)}
      />
    </span>
  );
}
