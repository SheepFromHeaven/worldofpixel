import { useState } from 'react';
import { ICON_NAMES, PLATE_NAMES } from '../pixel/ui/metrics.ts';
import type { IconName } from '../pixel/ui/metrics.ts';
import { ItemType } from '../sim/types.ts';
import { PixelHeading, PixelText } from '../ui/pixel/Pixel.tsx';
import { PixelSection, PixelTile } from '../ui/pixel/Tile.tsx';
import { HoldingSlab, RigSlab } from '../ui/RigSlab.tsx';
import type { RigView } from '../ui/rigView.ts';
import '../ui/styles.css';

/**
 * The HUD with no world under it.
 *
 * The slabs sit inside a game that spends several seconds raising a world before one can be
 * opened, which is a slow loop to look at a scratched ring through. Here they are drawn against
 * nothing, from data held in this file, and every plate and every icon is laid out beside them
 * — so a change to a tile is seen in the time it takes vite to reload.
 *
 * Nothing in here is reachable from the game: `/lab` is its own entry for exactly this reason.
 */

/**
 * A rig to look at, with its queue part way through: one entry running, one whose shelf is
 * already full to the mark, one waiting on a material and one the fire cannot get hot enough
 * for — which is the whole of what the strip and the queue have to be able to say.
 */
const SAMPLE_RIG: RigView = {
  buildingId: 'lab/1',
  charge: 1,
  changingOver: false,
  queue: [
    { id: 'seal-a-basket', label: 'Seal a basket', item: ItemType.Vessel, stock: 2, target: 5, running: true, refusal: null, why: '' },
    { id: 'bank-the-fire', label: 'Bank the fire', item: ItemType.Embers, stock: 6, target: 6, running: false, refusal: 'done', why: 'Embers is up to the mark' },
    { id: 'fire-a-pot', label: 'Fire a pot', item: ItemType.Water, stock: 0, target: 4, running: false, refusal: 'inputs', why: 'no Wood' },
    { id: 'burn-lime', label: 'Burn lime', item: ItemType.Mud, stock: 1, target: 3, running: false, refusal: 'envelope', why: 'needs yellow; this rig tops out at faint red' },
  ],
};

/** The fire down and climbing again between two methods: the strip has nothing to drive. */
const CHANGING_RIG: RigView = {
  ...SAMPLE_RIG,
  changingOver: true,
  charge: 2,
  queue: [
    { id: 'burn-lime', label: 'Burn lime', item: ItemType.Mud, stock: 0, target: 3, running: true, refusal: null, why: '' },
    { id: 'seal-a-basket', label: 'Seal a basket', item: ItemType.Vessel, stock: 2, target: 5, running: false, refusal: null, why: '' },
  ],
};

/** The two ends of a shelf: nothing on it, and more on it than it holds. */
const SHELVES_RIG: RigView = {
  buildingId: 'lab/2',
  charge: 0,
  changingOver: false,
  queue: [
    { id: 'empty', label: 'Dry a brick', item: ItemType.Mud, stock: 0, target: 7, running: true, refusal: null, why: '' },
    { id: 'over', label: 'Char a pile', item: ItemType.Wood, stock: 13, target: 12, running: false, refusal: 'full', why: 'nowhere to put the Charcoal' },
    { id: 'nameless', label: 'Watch the clamp', item: null, stock: 0, target: null, running: false, refusal: 'wrong-process', why: 'not a method for this kind of rig' },
  ],
};

export function Hud(): React.JSX.Element {
  const [held, setHeld] = useState<IconName | null>(null);
  const [charge, setCharge] = useState(1);
  const [queue, setQueue] = useState(SAMPLE_RIG.queue);

  /*
   * The bench keeps the queue itself, so dragging an entry about can actually be looked at:
   * the panel draws the order it is handed and the order is only ever the real one.
   */
  const hand = {
    charge: setCharge,
    stop: (id: string, target: number) =>
      setQueue((was) => was.map((entry) => (entry.id === id ? { ...entry, target } : entry))),
    move: (id: string, by: number) =>
      setQueue((was) => {
        const from = was.findIndex((entry) => entry.id === id);
        const to = from + by;
        if (from < 0 || to < 0 || to >= was.length) return was;
        const next = [...was];
        const [moved] = next.splice(from, 1);
        if (moved) next.splice(to, 0, moved);
        return next;
      }),
  };

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
              rig={{ ...SAMPLE_RIG, charge, queue }}
              hand={hand}
            />
          ))}
        </div>

        <h2>changing over, and the two ends of a shelf</h2>
        <div className="hud-rigs">
          <RigSlab stage="fire" rig={{ ...CHANGING_RIG, charge }} hand={hand} />
          <RigSlab stage="village" rig={SHELVES_RIG} hand={hand} />
        </div>

        <h2>a building with nothing to set</h2>
        <div className="hud-rigs">
          <HoldingSlab
            stage="fire"
            holding={{
              label: 'Well',
              state: 'working',
              stock: [[ItemType.Water, 3]],
            }}
          />
          <HoldingSlab stage="village" holding={{ label: 'Works', state: 'idle', stock: [] }} />
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

      </div>

      <footer>
        <PixelHeading>pixel tiles, and the slabs they are set in</PixelHeading>
      </footer>
    </main>
  );
}
