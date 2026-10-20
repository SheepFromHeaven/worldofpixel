import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { describeDesign } from '../sim/blocks.ts';
import { WORKS_DESIGN_ID } from '../sim/works.ts';
import { designIdOfTool, game, placeTool } from './game.ts';
import { LandBar } from './LandBar.tsx';
import type { Tool } from './game.ts';
import { PixelIcon, PixelText } from './pixel/Pixel.tsx';
import type { IconName } from './pixel/Pixel.tsx';
import { PixelSection, PixelTile } from './pixel/Tile.tsx';

/**
 * The starters have drawings; a pattern the player kept gets the blueprint.
 *
 * A pattern is a copy of a works somebody got working, and the library is open-ended, so there
 * is no icon to be had for a machine nobody has invented yet — and a blank plate beside a
 * picture says, correctly, that this one is the player's own.
 */
const DESIGN_ICONS: Record<string, IconName> = {
  'mud-mixer': 'mixer',
};

const iconFor = (id: string): IconName => DESIGN_ICONS[id] ?? 'design';

/**
 * The hand tools, and the two kinds of building.
 *
 * **Resources and Manufacturing are kept apart on purpose**, and the seam is not an accident of
 * how the simulation stores them: they are two different decisions. A resource building is
 * *sited* — the ground says yes or no, and choosing where is the whole of it. A works is
 * *fitted out* — it can go anywhere a carrier can reach, and everything interesting about it
 * happens inside. One bar asks where, the other asks how.
 *
 * **There is no Inspect button.** Inspecting is what an empty hand does: a click on a building
 * that the tool has nothing to say about opens it anyway, and a tool clicked a second time, or
 * Escape, or raising what was in hand all put it down again.
 *
 * **There is no designer button either, any more.** A machine is not drawn in the abstract and
 * then stamped on the map — a works goes up empty and is fitted out where it stands, so the way
 * into the interior is to put a shed down and click it.
 */
export function BuildBar(): React.JSX.Element | null {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const [picking, setPicking] = useState(false);
  const pickerRef = useRef<HTMLSpanElement>(null);

  // Anything that takes the player somewhere else closes the menu behind them.
  if (picking && hud.openBuilding) setPicking(false);

  useEffect(() => {
    if (!picking) return;

    const onPointerDown = (event: PointerEvent): void => {
      if (!pickerRef.current?.contains(event.target as Node)) setPicking(false);
    };
    // Captured, so Escape shuts the menu rather than reaching the canvas and putting the tool
    // down underneath it.
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

  // The tools only mean anything once the ground is resolved into parcels.
  if (hud.detail !== 'fine' || hud.openBuilding) return null;

  const held = designIdOfTool(hud.tool);
  const heldDesign = held === null ? undefined : hud.designs.find((design) => design.id === held);
  const holdingShed = held === WORKS_DESIGN_ID;
  const patterns = hud.designs.filter((design) => design.id !== WORKS_DESIGN_ID);

  const tool = (value: Tool, icon: IconName, label: string, title: string): React.JSX.Element => (
    <PixelTile
      key={value}
      icon={icon}
      label={label}
      title={title}
      held={hud.tool === value}
      onClick={() => game.setTool(hud.tool === value ? 'inspect' : value)}
    />
  );

  return (
    <div className="se-buildbar">
      {tool('hearth', 'found', 'Found', 'Click open ground to set a hearth and start a settlement')}

      <LandBar />

      <span className="se-picker-wrap" ref={pickerRef}>
        {picking ? (
          <div className="se-picker">
            <PixelSection icon="workshops" label="manufacturing" />
            <span className="se-picker-row">
              <PixelTile
                icon="design"
                label="Works"
                reason="an empty shed"
                title="Raise an empty works and fit it out where it stands"
                held={holdingShed}
                onClick={() => {
                  game.setTool(placeTool(WORKS_DESIGN_ID));
                  setPicking(false);
                }}
              />
            </span>
            {patterns.length > 0 ? <PixelSection icon="design" label="patterns" /> : null}
            {patterns.map((design) => (
              <span key={design.id} className="se-picker-row">
                <PixelTile
                  icon={iconFor(design.id)}
                  label={design.label}
                  title={describeDesign(design)}
                  held={held === design.id}
                  onClick={() => {
                    game.setTool(placeTool(design.id));
                    setPicking(false);
                  }}
                />
                <button
                  type="button"
                  className="se-tile se-tool-ghost"
                  title={`Throw the ${design.label} pattern away`}
                  onClick={() => game.discardDesign(design.id)}
                >
                  <PixelIcon name="raze" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <PixelTile
          wide
          icon={heldDesign ? iconFor(heldDesign.id) : 'design'}
          label={holdingShed ? 'Works' : (heldDesign?.label ?? 'Build')}
          title={
            holdingShed
              ? 'Holding a works — click open ground to raise the shed, then click it to fit it out'
              : heldDesign
                ? `Holding ${heldDesign.label} — click open ground to raise it, shift to keep it in hand`
                : 'Raise a works, or stamp a pattern you have kept'
          }
          held={heldDesign !== undefined || holdingShed}
          onClick={() => setPicking(!picking)}
        />
      </span>

      {tool('raze', 'raze', 'Raze', 'Click a building you raised to take it down')}
    </div>
  );
}
