import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { describeDesign } from '../sim/blocks.ts';
import { designIdOfTool, game, placeTool } from './game.ts';
import { LandBar } from './LandBar.tsx';
import type { Tool } from './game.ts';
import { PixelIcon, PixelText } from './pixel/Pixel.tsx';
import type { IconName } from './pixel/Pixel.tsx';

/**
 * The starters have drawings; anything the player draws gets the blueprint.
 *
 * A design is a grid of blocks and the library is open-ended, so there is no icon to be had for
 * a machine nobody has invented yet — and a blank plate beside three pictures says, correctly,
 * that this one is the player's own.
 */
const DESIGN_ICONS: Record<string, IconName> = {
  well: 'well',
  digging: 'dig',
  'mud-mixer': 'mixer',
};

const iconFor = (id: string): IconName => DESIGN_ICONS[id] ?? 'design';

/**
 * The hand tools, and one door to the library.
 *
 * **There is no Inspect button.** Inspecting is what an empty hand does: a click on a building
 * that the tool has nothing to say about opens it anyway, and a tool clicked a second time, or
 * Escape, or raising what was in hand all put it down again. A button for the resting state is a
 * button that is pressed nearly all the time, which teaches the player it means something.
 *
 * **The library is behind `Build`, not laid out on the bar.** A shelf grows a button per design
 * and the player can draw as many as they like, so the bar was already the widest thing on
 * screen with three of them on it. The button holds what is in hand, so the bar says what the
 * next click will raise without the shelf being there to say it.
 */
export function BuildBar(): React.JSX.Element | null {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const [picking, setPicking] = useState(false);
  const pickerRef = useRef<HTMLSpanElement>(null);

  // Anything that takes the player somewhere else closes the menu behind them.
  if (picking && (hud.designerOpen || hud.openBuilding)) setPicking(false);

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
  if (hud.detail !== 'fine' || hud.openBuilding || hud.designerOpen) return null;

  const held = designIdOfTool(hud.tool);
  const heldDesign = held === null ? undefined : hud.designs.find((design) => design.id === held);

  const tool = (value: Tool, icon: IconName, label: string, title: string): React.JSX.Element => (
    <button
      key={value}
      type="button"
      title={title}
      className={hud.tool === value ? 'se-tool se-on' : 'se-tool'}
      onClick={() => game.setTool(hud.tool === value ? 'inspect' : value)}
    >
      <PixelIcon name={icon} />
      <PixelText>{label}</PixelText>
    </button>
  );

  return (
    <div className="se-buildbar">
      {tool('hearth', 'found', 'Found', 'Click open ground to set a hearth and start a settlement')}
      {tool(
        'road',
        'road',
        'Dirt path',
        'Click a building to run a road to it from the fire; drag across parcels to lay one by hand',
      )}

      <LandBar />

      <span className="se-picker-wrap" ref={pickerRef}>
        {picking ? (
          <div className="se-picker">
            <span className="se-picker-title">
              <PixelText>library</PixelText>
            </span>
            {hud.designs.map((design) => (
              <span key={design.id} className="se-picker-row">
                <button
                  type="button"
                  className="se-tool"
                  title={describeDesign(design)}
                  onClick={() => {
                    game.setTool(placeTool(design.id));
                    setPicking(false);
                  }}
                >
                  <PixelIcon name={iconFor(design.id)} />
                  <PixelText>{design.label}</PixelText>
                </button>
                <button
                  type="button"
                  className="se-tool se-tool-ghost"
                  title={`Open ${design.label} in the designer`}
                  onClick={() => game.openDesigner(design.id)}
                >
                  <PixelIcon name="pencil" />
                </button>
              </span>
            ))}
            <button
              type="button"
              className="se-tool"
              title="Draw a new machine out of blocks"
              onClick={() => game.openDesigner(null)}
            >
              <PixelIcon name="pencil" />
              <PixelText>New design</PixelText>
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className={heldDesign ? 'se-tool se-build se-on' : 'se-tool se-build'}
          title={
            heldDesign
              ? `Holding ${heldDesign.label} — click open ground to raise it, shift to keep it in hand`
              : 'Take a machine off the library shelf'
          }
          onClick={() => setPicking(!picking)}
        >
          <PixelIcon name={heldDesign ? iconFor(heldDesign.id) : 'design'} />
          <PixelText>{heldDesign ? heldDesign.label : 'Build'}</PixelText>
        </button>
      </span>

      {tool('raze', 'raze', 'Raze', 'Click a building you raised to take it down')}
    </div>
  );
}
