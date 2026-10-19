import { useEffect, useRef, useState } from 'react';
import { ICON_NAMES, PLATE_NAMES } from '../pixel/ui/metrics.ts';
import type { IconName } from '../pixel/ui/metrics.ts';
import { createBuilding } from '../sim/buildings.ts';
import { STARTER_DESIGNS } from '../sim/designs.ts';
import { RECIPES } from '../sim/recipes.ts';
import { BlockKind, Direction, ItemType, PLACEABLE_BLOCKS } from '../sim/types.ts';
import type { Design } from '../sim/types.ts';
import { drawDesigner, layoutDesigner } from '../render/designerLayer.ts';
import type { DesignerSelection } from '../render/designerLayer.ts';
import { drawBuildingInterior } from '../render/interiorLayer.ts';
import { PixelHeading, PixelText } from '../ui/pixel/Pixel.tsx';
import { PixelSection, PixelTile } from '../ui/pixel/Tile.tsx';
import '../ui/styles.css';

/**
 * The building flow with no world under it.
 *
 * The designer sheet and the blueprint are canvases inside a game that spends several seconds
 * raising a world before either can be opened, which is a slow loop to look at a bevel through.
 * Here they are drawn against nothing, from a design held in this file, and every plate and
 * every icon is laid out beside them — so a change to a tile is seen in the time it takes vite
 * to reload, and the sheets are seen in the same pass as the pieces they are made of.
 *
 * Nothing in here is reachable from the game: `/lab` is its own entry for exactly this reason.
 */

const MIXER: Design =
  STARTER_DESIGNS.find((design) => design.id === 'mud-mixer') ?? STARTER_DESIGNS[0]!;

/** Something to look at on the blueprint: a building standing on the ground it draws from. */
const STANDING = createBuilding('lab/1', MIXER, 'lab-cell', { x: 0, y: 0 }, [
  ItemType.Water,
  ItemType.Dirt,
]);

function Sheet({
  draw,
  height,
}: {
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => void;
  height: number;
}): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);

  /**
   * Redrawn off a timer rather than off `requestAnimationFrame`.
   *
   * A bench is looked at in a tab that is very often not the one in front, and a browser stops
   * handing out animation frames to a tab it cannot see — which leaves the sheet blank in every
   * screenshot taken of it, including the ones taken to check the change that was just made.
   * Thirty a second is far more than a board of still tiles needs, and a throttled timer still
   * gets round to drawing it.
   */
  useEffect(() => {
    const render = (): void => {
      const now = performance.now();
      const element = canvas.current;
      const ctx = element?.getContext('2d');
      if (!element || !ctx) return;

      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = element.clientWidth;
      if (width === 0) return;
      if (element.width !== Math.round(width * ratio)) {
        element.width = Math.round(width * ratio);
        element.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      draw(ctx, width, height, now / 1000);
    };

    const handle = window.setInterval(render, 33);
    render();
    return () => window.clearInterval(handle);
  }, [draw, height]);

  return <canvas ref={canvas} style={{ width: '100%', height, display: 'block' }} />;
}

export function Hud(): React.JSX.Element {
  const [selection, setSelection] = useState<DesignerSelection>({
    kind: PLACEABLE_BLOCKS[0] ?? BlockKind.Input,
    facing: Direction.East,
    item: ItemType.Water,
    recipeId: RECIPES[0]?.id ?? 'mud',
  });
  const [held, setHeld] = useState<IconName | null>(null);

  return (
    <main className="hud-lab">
      <header>
        <h1>hud lab</h1>
      </header>

      <div className="hud-stage">
        <h2>tiles</h2>
        <div className="se-buildbar hud-row">
          <PixelTile icon="found" label="Found" held={held === 'found'} onClick={() => setHeld('found')} />
          <PixelTile icon="road" label="Dirt path" held={held === 'road'} onClick={() => setHeld('road')} />
          <PixelTile wide icon="design" label="Build" held={held === 'design'} onClick={() => setHeld('design')} />
          <PixelTile icon="raze" label="Raze" disabled reason="nothing raised" />
        </div>

        <h2>the picker</h2>
        <div className="se-picker hud-picker">
          <PixelSection icon="land" label="land" />
          <PixelTile icon="well" label="Well" reason="water here" />
          <PixelTile icon="dig" label="Dig site" reason="dirt here" />
          <PixelTile icon="woodcutter" label="Woodcutter" disabled reason="no wood here" />
          <PixelSection icon="workshops" label="workshops" />
          <PixelTile icon="mixer" label="Mud Mixer" />
          <PixelTile icon="pencil" label="New design" />
        </div>

        <h2>every plate</h2>
        <div className="hud-plates">
          {PLATE_NAMES.map((name) => (
            <span key={name} className="hud-plate" style={{ borderImageSource: `url('/ui/${name}.png')` }}>
              <PixelText>{name}</PixelText>
            </span>
          ))}
        </div>

        <h2>every icon</h2>
        <div className="hud-icons">
          {ICON_NAMES.map((name) => (
            <PixelTile key={name} icon={name} label={name} onClick={() => setHeld(name)} held={held === name} />
          ))}
        </div>

        <h2>the designer sheet</h2>
        <Sheet
          height={560}
          draw={(ctx, width, height, time) => {
            const viewport = { width, height };
            drawDesigner(
              ctx,
              viewport,
              MIXER,
              selection,
              layoutDesigner(viewport, MIXER, selection),
              { x: 3, y: 3 },
              time,
            );
          }}
        />
        <div className="hud-row">
          {PLACEABLE_BLOCKS.map((kind) => (
            <PixelTile
              key={kind}
              label={kind}
              held={selection.kind === kind}
              onClick={() => setSelection({ ...selection, kind })}
            />
          ))}
        </div>

        <h2>the blueprint</h2>
        <Sheet
          height={640}
          draw={(ctx, width, height, time) => {
            drawBuildingInterior(ctx, STANDING, { width, height }, time, 0.5);
          }}
        />
      </div>

      <footer>
        <PixelHeading>mahjong tiles on a board</PixelHeading>
      </footer>
    </main>
  );
}
