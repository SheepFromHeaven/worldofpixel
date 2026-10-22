import { useSyncExternalStore } from 'react';
import { game } from './game.ts';
import type { Tool } from './game.ts';
import type { IconName } from './pixel/Pixel.tsx';
import { PixelTile } from './pixel/Tile.tsx';

/**
 * The hand tools, and nothing else.
 *
 * **There is one thing to build: a work area.** What stands in it is chosen from its own sheet,
 * a slot at a time, from what the chapter has reached and the ground allows — so the bar has no
 * catalogue and no menu, and a fire, a pit and a camp are not buildings the player picks from
 * here. Founding sets the first area down with its fire and its camp already in it.
 *
 * **The bar is a readout of the chapter, never the enforcement of it** (`chapter.ts`): the slot's
 * list shows only the steps the town has reached, and `canBuild` refuses the rest.
 *
 * **There is no Inspect button.** Inspecting is what an empty hand does: a click on an area that
 * the tool has nothing to say about opens it anyway, and a tool clicked a second time, or
 * Escape, or setting down what was in hand all put it down again.
 */
export function BuildBar(): React.JSX.Element | null {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);

  // The tools only mean anything once the ground is resolved into parcels.
  if (hud.detail !== 'fine' || hud.openBuilding) return null;

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
      {tool('found', 'found', 'Found', 'Click open ground to start a settlement')}
      {tool('area', 'design', 'Work area', 'Click ground inside your claim to mark out a work area, shift to keep marking')}
      {tool('raze', 'raze', 'Raze', 'Click a work area to take it down')}
    </div>
  );
}
