import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AGES, STEPS, designOpen } from '../sim/chapter.ts';
import type { Age, Step } from '../sim/chapter.ts';
import type { Design } from '../sim/types.ts';
import { designIdOfTool, game, placeTool } from './game.ts';
import { LandBar } from './LandBar.tsx';
import type { Tool } from './game.ts';
import type { IconName } from './pixel/Pixel.tsx';
import { PixelSection, PixelTile } from './pixel/Tile.tsx';

/**
 * What a tile in the catalogue says when the cursor rests on it.
 *
 * `describeDesign` went with the floor plan, and most of what it listed went with it too: a
 * building no longer has doors, bins or a recipe of its own. What is left is what the chapter
 * hands over — somewhere to sleep, a rig to run methods on, and how much it holds — and the
 * methods themselves belong on the rig's slab, where they can be reordered.
 */
function describeDesign(design: Design): string {
  const parts: string[] = [];
  if (design.beds) parts.push(`sleeps ${design.beds}${design.sheltered ? ' under a roof' : ' in the open'}`);
  if (design.rig) parts.push('a floor to run methods on');
  parts.push(`holds ${design.capacity} of each`);
  return parts.join(' - ');
}

/**
 * The lean-to takes the blueprint, for want of a drawing of a shelter: nothing on the sheet is
 * one, and a roof drawn as a log or a fire would be a worse lie than a blank plate.
 */
const DESIGN_ICONS: Record<string, IconName> = {
  'pit-firing': 'pit-fire',
  'charcoal-clamp': 'clamp',
  'cord-walk': 'cord-walk',
  'weaving-frame': 'weaving-frame',
  'daub-pit': 'daub',
};

const iconFor = (id: string): IconName => DESIGN_ICONS[id] ?? 'design';

/** A mark per age, so a run of tiles is read as the age it belongs to and not as a list. */
const AGE_ICONS: Record<Age, IconName> = {
  Hands: 'hearth',
  'Mud and fibre': 'mud',
  Fire: 'fire-mid',
  'The axe': 'woodcutter',
  'Clay houses': 'clay',
};

/**
 * The hand tools, and the buildings the chapter has reached.
 *
 * **Resources and Manufacturing are kept apart on purpose**, and the seam is not an accident of
 * how the simulation stores them: they are two different decisions. A resource building is
 * *sited* — the ground says yes or no, and choosing where is the whole of it. A rig goes
 * anywhere a carrier can reach, and what it does is the method running on it. One bar asks
 * where, the other asks what.
 *
 * **The bar is a readout of the chapter, never the enforcement of it** (`chapter.ts`). A step
 * the town has not reached is not on the bar at all rather than greyed out: the player should
 * have no reason to want a kiln before there is anything to fire in one, and a shelf of locked
 * doors is a list of things the game is withholding. `canBuild` refuses the same set, so
 * nothing can be raised round the back of this.
 *
 * **There is no Inspect button.** Inspecting is what an empty hand does: a click on a building
 * that the tool has nothing to say about opens it anyway, and a tool clicked a second time, or
 * Escape, or raising what was in hand all put it down again.
 *
 * **There is no designer, and no library of the player's own drawings.** The unit of progress
 * is the book of methods, so what the Build menu holds is the chapter's own catalogue of
 * buildings, in the chapter's order.
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

  // The town the tools would act on, which at this distance is the one the camera is over. Read
  // off the world rather than the snapshot because the snapshot carries no settlement; with none
  // in reach there is nothing to build and the menu is not drawn at all.
  const town = game.townAt(game.camera.centre);
  const held = designIdOfTool(hud.tool);
  const heldDesign = held === null ? undefined : hud.designs.find((design) => design.id === held);

  const reached: { step: Step; design: Design }[] = [];
  for (const step of STEPS) {
    if (step.design === undefined || town === undefined) continue;
    if (!designOpen(town, step.design)) continue;
    const design = hud.designs.find((entry) => entry.id === step.design);
    if (design) reached.push({ step, design });
  }

  const raise = (design: Design, reason: string): React.JSX.Element => (
    <PixelTile
      icon={iconFor(design.id)}
      label={design.label}
      reason={reason}
      title={describeDesign(design)}
      held={held === design.id}
      onClick={() => {
        game.setTool(placeTool(design.id));
        setPicking(false);
      }}
    />
  );

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

      {reached.length > 0 ? (
        <span className="se-picker-wrap" ref={pickerRef}>
          {picking ? (
            <div className="se-picker">
              {AGES.map((age) => {
                const run = reached.filter((entry) => entry.step.age === age);
                if (run.length === 0) return null;
                return (
                  <span key={age}>
                    <PixelSection icon={AGE_ICONS[age]} label={age.toLowerCase()} />
                    {run.map(({ step, design }) => (
                      <span key={design.id} className="se-picker-row">
                        {raise(design, design.beds === undefined ? 'a rig' : `${design.beds} beds`)}
                      </span>
                    ))}
                  </span>
                );
              })}
            </div>
          ) : null}

          <PixelTile
            wide
            icon={heldDesign ? iconFor(heldDesign.id) : 'design'}
            label={heldDesign?.label ?? 'Build'}
            title={
              heldDesign
                ? `Holding ${heldDesign.label} — click open ground to raise it, shift to keep it in hand`
                : 'Raise one of the buildings the town has worked out how to make'
            }
            held={heldDesign !== undefined}
            onClick={() => setPicking(!picking)}
          />
        </span>
      ) : null}

      {tool('raze', 'raze', 'Raze', 'Click a building you raised to take it down')}
    </div>
  );
}
