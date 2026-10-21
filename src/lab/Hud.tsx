import { useEffect, useRef, useState } from 'react';
import { ICON_NAMES, PLATE_NAMES } from '../pixel/ui/metrics.ts';
import type { IconName } from '../pixel/ui/metrics.ts';
import { createBuilding } from '../sim/buildings.ts';
import { STARTER_DESIGNS } from '../sim/designs.ts';
import { RECIPES } from '../sim/recipes.ts';
import { BlockKind, Direction, ItemType, PLACEABLE_BLOCKS } from '../sim/types.ts';
import type { Design } from '../sim/types.ts';
import { DEFAULT_SELECTION, ROOM_TOOLS, drawRoom, hitRoom, layoutRoom } from '../render/roomLayer.ts';
import type { RoomSelection } from '../render/roomLayer.ts';
import { PixelHeading, PixelText } from '../ui/pixel/Pixel.tsx';
import { PixelSection, PixelTile } from '../ui/pixel/Tile.tsx';
import { RigSlab } from '../ui/RigSlab.tsx';
import type { RigView } from '../ui/rigView.ts';
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

/**
 * A rig to look at, with its queue part way through: one entry running, one waiting on a
 * material and one the fire cannot get hot enough for — which is the whole of what the strip
 * and the queue have to be able to say.
 */
const SAMPLE_RIG: RigView = {
  buildingId: 'lab/1',
  charge: 1,
  changingOver: false,
  queue: [
    { id: 'seal-a-basket', label: 'Seal a basket', item: ItemType.Vessel, stock: 2, target: 3, running: true, why: '' },
    { id: 'bank-the-fire', label: 'Bank the fire', item: ItemType.Embers, stock: 6, target: 8, running: false, why: 'no Wood' },
    { id: 'burn-lime', label: 'Burn lime', item: ItemType.Mud, stock: 0, target: 4, running: false, why: 'needs yellow; this rig tops out at faint red' },
  ],
};

/** Something to look at on the blueprint: a building standing on the ground it draws from. */
const STANDING = createBuilding('lab/1', MIXER, 'lab-cell', { x: 0, y: 0 }, [
  ItemType.Water,
  ItemType.Dirt,
]);

function Sheet({
  draw,
  height,
  onPoint,
}: {
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => void;
  height: number;
  onPoint?: (at: { x: number; y: number }) => void;
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

  return (
    <canvas
      ref={canvas}
      style={{ width: '100%', height, display: 'block' }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onPoint?.({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      }}
    />
  );
}

export function Hud(): React.JSX.Element {
  const [selection, setSelection] = useState<RoomSelection>({ ...DEFAULT_SELECTION });
  const [held, setHeld] = useState<IconName | null>(null);
  const [pointer, setPointer] = useState({ x: -1, y: -1 });
  const [charge, setCharge] = useState(1);

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
          <PixelSection icon="land" label="resources" />
          <PixelTile icon="well" label="Well" reason="water here" />
          <PixelTile icon="dig" label="Dig site" reason="dirt here" />
          <PixelTile icon="woodcutter" label="Woodcutter" disabled reason="no wood here" />
          <PixelSection icon="workshops" label="manufacturing" />
          <PixelTile icon="design" label="Works" reason="an empty shed" />
          <PixelTile icon="mixer" label="Mud Mixer" />
        </div>

        <h2>the hand that sets a rig</h2>
        <div className="hud-rigs">
          {(['fire', 'village', 'stone'] as const).map((stage) => (
            <RigSlab
              key={stage}
              stage={stage}
              rig={{ ...SAMPLE_RIG, charge }}
              hand={{ charge: setCharge, stop: () => {}, move: () => {} }}
            />
          ))}
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

        <h2>inside a works</h2>
        <Sheet
          height={680}
          draw={(ctx, width, height, time) => {
            const viewport = { width, height };
            const layout = layoutRoom(viewport, STANDING);
            const hovered = hitRoom(layout, STANDING, selection, pointer.x, pointer.y);
            drawRoom(ctx, STANDING, viewport, layout, selection, hovered, time, 0.5);
          }}
          onPoint={setPointer}
        />
        <div className="hud-row">
          {ROOM_TOOLS.map((tool) => (
            <PixelTile
              key={tool}
              label={tool}
              held={selection.tool === tool}
              onClick={() => setSelection({ ...selection, tool })}
            />
          ))}
        </div>
      </div>

      <footer>
        <PixelHeading>pixel tiles, and a room to stand them in</PixelHeading>
      </footer>
    </main>
  );
}
