import { useState } from 'react';
import { ICON_NAMES, PLATE_NAMES } from '../pixel/ui/metrics.ts';
import type { IconName } from '../pixel/ui/metrics.ts';
import { ItemType } from '../sim/types.ts';
import { PixelHeading, PixelText } from '../ui/pixel/Pixel.tsx';
import { PixelSection, PixelTile } from '../ui/pixel/Tile.tsx';
import { AreaSheet } from '../ui/AreaSheet.tsx';
import type { AreaHand, AreaView } from '../ui/areaView.ts';
import { HoldingSlab, RigSlab } from '../ui/RigSlab.tsx';
import { TownSlab } from '../ui/TownSlab.tsx';
import type { RigHand, RigView } from '../ui/rigView.ts';
import type { TownView } from '../ui/townView.ts';
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
  label: 'Hearth',
  capacity: 8,
  process: 'fire',
  charge: 1,
  affordable: [true, true, true],
  changingOver: false,
  // What is standing in the building, which is what the queue above it is read against: the
  // basket is there, the clay is not, and the entry waiting on clay is crossed through.
  stock: [
    [ItemType.Deadwood, 4],
    [ItemType.Basket, 1],
  ],
  queue: [
    { id: 'seal-a-basket', label: 'Seal a basket', uses: [{ item: ItemType.Deadwood, amount: 2 }], makes: [{ item: ItemType.Vessel, amount: 1 }], seconds: 4, running: true, progress: 0.4, refusal: null, why: '' },
    { id: 'bank-the-fire', label: 'Embers', uses: [{ item: ItemType.Deadwood, amount: 2 }], makes: [{ item: ItemType.Embers, amount: 1 }], seconds: 4, running: false, progress: 0, refusal: 'full', why: 'nowhere to put the Embers' },
    { id: 'fire-a-pot', label: 'Fire a pot', uses: [{ item: ItemType.Deadwood, amount: 2 }], makes: [{ item: ItemType.Water, amount: 1 }], seconds: 4, running: false, progress: 0, refusal: 'inputs', why: 'no Wood' },
    { id: 'burn-lime', label: 'Burn lime', uses: [{ item: ItemType.Deadwood, amount: 2 }], makes: [{ item: ItemType.Mud, amount: 1 }], seconds: 4, running: false, progress: 0, refusal: 'envelope', why: 'needs yellow; this rig tops out at faint red' },
  ],
};

/** A hearth in the opening state: no wood, so only the banked fire can be paid for. */
const NO_WOOD_RIG: RigView = {
  ...SAMPLE_RIG,
  buildingId: 'lab/5',
  label: 'Building',
  capacity: 8,
  charge: 0,
  affordable: [true, false, false],
  stock: [],
  queue: [
    { id: 'bank-the-fire', label: 'Embers', uses: [{ item: ItemType.Deadwood, amount: 2 }], makes: [{ item: ItemType.Embers, amount: 1 }], seconds: 4, running: false, progress: 0, refusal: 'inputs', why: 'no Deadwood' },
  ],
};

/** Plenty standing in it: the storage region with a row to every item. */
const STOCKED_RIG: RigView = {
  ...SAMPLE_RIG,
  buildingId: 'lab/6',
  label: 'Building',
  capacity: 8,
  stock: [
    [ItemType.Deadwood, 12],
    [ItemType.Clay, 3],
    [ItemType.Water, 7],
    [ItemType.Basket, 1],
    [ItemType.Embers, 26],
    [ItemType.Fibre, 5],
  ],
};

/** The fire down and climbing again between two methods: the strip has nothing to drive. */
const CHANGING_RIG: RigView = {
  ...SAMPLE_RIG,
  changingOver: true,
  charge: 2,
  queue: [
    { id: 'burn-lime', label: 'Burn lime', uses: [{ item: ItemType.Deadwood, amount: 2 }], makes: [{ item: ItemType.Mud, amount: 1 }], seconds: 4, running: true, progress: 0.4, refusal: null, why: '' },
    { id: 'seal-a-basket', label: 'Seal a basket', uses: [{ item: ItemType.Deadwood, amount: 2 }], makes: [{ item: ItemType.Vessel, amount: 1 }], seconds: 4, running: false, progress: 0, refusal: null, why: '' },
  ],
};

/** The two ends of a shelf: nothing on it, and more on it than it holds. */
const SHELVES_RIG: RigView = {
  buildingId: 'lab/2',
  label: 'Building',
  capacity: 8,
  process: 'fire',
  charge: 0,
  affordable: [true, true, true],
  changingOver: false,
  // A shed with more in it than its boards hold, so the tally carries the rest.
  stock: [
    [ItemType.Wood, 11],
    [ItemType.Mud, 3],
  ],
  queue: [
    { id: 'empty', label: 'Dry a brick', uses: [{ item: ItemType.Deadwood, amount: 2 }], makes: [{ item: ItemType.Mud, amount: 1 }], seconds: 4, running: true, progress: 0.4, refusal: null, why: '' },
    { id: 'over', label: 'Char a pile', uses: [{ item: ItemType.Deadwood, amount: 2 }], makes: [{ item: ItemType.Wood, amount: 1 }], seconds: 4, running: false, progress: 0, refusal: 'full', why: 'nowhere to put the Charcoal' },
    { id: 'nameless', label: 'Watch the clamp', uses: [], makes: [], seconds: 0, running: false, progress: 0, refusal: 'wrong-process', why: 'not a method for this kind of rig' },
  ],
};

/**
 * A cord walk: cold work, no fire under it and so no strip over it. Stood beside a fire rig on
 * the bench because the absence is the thing being looked at, and an absence can only be read
 * against the panel that still has one.
 */
const HAND_RIG: RigView = {
  buildingId: 'lab/3',
  label: 'Building',
  capacity: 8,
  process: 'hand',
  charge: 1,
  affordable: [true, true, true],
  changingOver: false,
  stock: [[ItemType.Fibre, 6]],
  queue: [
    { id: 'twist-cord', label: 'Walk a cord', uses: [{ item: ItemType.Deadwood, amount: 2 }], makes: [{ item: ItemType.Cord, amount: 1 }], seconds: 4, running: true, progress: 0.4, refusal: null, why: '' },
    { id: 'weave-a-basket', label: 'Weave a basket', uses: [{ item: ItemType.Deadwood, amount: 2 }], makes: [{ item: ItemType.Basket, amount: 1 }], seconds: 4, running: false, progress: 0, refusal: 'inputs', why: 'no Cord' },
  ],
};

/** A clamp: its three vents are a real decision, so it keeps the strip until it has its own. */
const CLAMP_RIG: RigView = {
  buildingId: 'lab/4',
  label: 'Building',
  capacity: 8,
  process: 'char',
  charge: 2,
  affordable: [true, true, true],
  changingOver: false,
  stock: [],
  queue: [
    { id: 'burn-charcoal', label: 'Burn charcoal', uses: [{ item: ItemType.Deadwood, amount: 2 }], makes: [{ item: ItemType.Charcoal, amount: 1 }], seconds: 4, running: true, progress: 0.4, refusal: null, why: '' },
  ],
};

/**
 * A town part way through the first age: three of them, one roof, one basket to carry water
 * in, and a day that is still nearly all survival. The hours come to fourteen, because they
 * have to — a day with a notch missing out of it is the thing the sharing-out prevents.
 */
const SAMPLE_TOWN: TownView = {
  name: 'Ashford',
  people: 5,
  sheltered: 2,
  vessels: 1,
  buildings: 4,
  day: [
    { part: 'rest', hours: 4 },
    { part: 'water', hours: 3 },
    { part: 'food', hours: 4 },
    { part: 'work', hours: 2 },
    { part: 'idle', hours: 1 },
  ],
  spare: 7,
  standing: [
    {
      id: 'lab/hearth',
      label: 'Hearth',
      stock: [
        [ItemType.Deadwood, 8],
        [ItemType.Fibre, 3],
        [ItemType.Berries, 2],
        [ItemType.Mud, 1],
      ],
      capacity: 8,
    },
    { id: 'lab/well', label: 'Well', stock: [[ItemType.Water, 2]], capacity: 8 },
    { id: 'lab/reeds', label: 'Reed bed', stock: [[ItemType.Fibre, 4]], capacity: 8 },
  ],
};

/** The same town once it has tools, pots and roofs: the day the chapter is trying to buy. */
const RICH_TOWN: TownView = {
  ...SAMPLE_TOWN,
  name: 'Ashford',
  people: 13,
  sheltered: 11,
  vessels: 6,
  buildings: 17,
  day: [
    { part: 'rest', hours: 2 },
    { part: 'water', hours: 1 },
    { part: 'food', hours: 1 },
    { part: 'work', hours: 9 },
    { part: 'idle', hours: 1 },
  ],
  spare: 104,
};

/** A clearing: a fibre patch in the ground slot, a cord walk beside it, and the yard to be had for labour. */
const CLEARING_AREA: AreaView = {
  buildingId: 'lab/area-1',
  stage: 0,
  stages: 5,
  slots: [
    { kind: 'ground', icon: 'fibre', label: 'Fibre patch', station: false, busy: true },
    { kind: 'work', icon: 'cord-walk', label: 'Cord walk', station: true, busy: false },
  ],
  locked: [{ stage: 'Yard' }],
  open: null,
  ground: {
    icon: 'fibre',
    slot: 0,
    uses: [],
    makes: [{ item: ItemType.Fibre, amount: 3 }],
    seconds: 12,
    progress: 0.55,
  },
  list: [
    { id: 'twist-cord', label: 'Walk a cord', slot: 1, icon: 'cord-walk', uses: [{ item: ItemType.Fibre, amount: 2 }], makes: [{ item: ItemType.Cord, amount: 1 }], seconds: 6, running: false, progress: 0, refusal: 'inputs', why: 'no Fibre' },
  ],
  shelf: [[ItemType.Fibre, 1]],
  capacity: 8,
  panel: null,
  choices: null,
  raise: { name: 'Yard', slots: 3, cost: [], ordered: false, progress: 0 },
  state: null,
};

/** A walled yard round the fire, the fire's slot open, and the roof half paid for. */
const YARD_AREA: AreaView = {
  buildingId: 'lab/area-2',
  stage: 2,
  stages: 5,
  slots: [
    { kind: 'work', icon: 'hearth', label: 'Hearth', station: true, busy: true },
    { kind: 'work', icon: 'daub', label: 'Daub pit', station: true, busy: false },
    { kind: 'work', icon: null, label: null, station: false, busy: false },
    { kind: 'ground', icon: null, label: null, station: false, busy: false },
  ],
  locked: [{ stage: 'Roofed works' }],
  open: 0,
  ground: null,
  list: [
    { id: 'seal-a-basket', label: 'Seal a basket', slot: 0, icon: 'hearth', uses: [{ item: ItemType.Basket, amount: 1 }, { item: ItemType.Daub, amount: 1 }], makes: [{ item: ItemType.Vessel, amount: 1 }], seconds: 8, running: true, progress: 0.4, refusal: null, why: '' },
    { id: 'bank-the-fire', label: 'Embers', slot: 0, icon: 'hearth', uses: [{ item: ItemType.Deadwood, amount: 2 }], makes: [{ item: ItemType.Embers, amount: 1 }], seconds: 4, running: false, progress: 0, refusal: 'full', why: 'nowhere to put the Embers' },
    { id: 'mix-daub', label: 'Mix daub', slot: 1, icon: 'daub', uses: [{ item: ItemType.Mud, amount: 2 }, { item: ItemType.Fibre, amount: 1 }], makes: [{ item: ItemType.Daub, amount: 1 }], seconds: 6, running: false, progress: 0, refusal: 'inputs', why: 'no Mud' },
  ],
  shelf: [
    [ItemType.Deadwood, 5],
    [ItemType.Basket, 1],
    [ItemType.Daub, 2],
    [ItemType.Embers, 8],
    [ItemType.Wood, 1],
  ],
  capacity: 8,
  panel: SAMPLE_RIG,
  choices: null,
  raise: {
    name: 'Roofed works',
    slots: 5,
    cost: [
      { item: ItemType.Wood, amount: 2, have: 1 },
      { item: ItemType.Fibre, amount: 4, have: 2 },
    ],
    ordered: true,
    progress: 0,
  },
  state: null,
};

/** The empty slot open: what could stand in it, one that fits and one the ground refuses. */
const CHOOSING_AREA: AreaView = {
  ...YARD_AREA,
  buildingId: 'lab/area-3',
  stage: 1,
  slots: [
    { kind: 'ground', icon: 'clay', label: 'Clay pit', station: false, busy: true },
    { kind: 'work', icon: 'pit-fire', label: 'Pit firing', station: true, busy: false },
    { kind: 'work', icon: null, label: null, station: false, busy: false },
  ],
  locked: [{ stage: 'Walled yard' }],
  open: 2,
  ground: { icon: 'clay', slot: 0, uses: [], makes: [{ item: ItemType.Clay, amount: 2 }], seconds: 10, progress: 0.2 },
  list: [
    { id: 'fire-a-pot', label: 'Fire a pot', slot: 1, icon: 'pit-fire', uses: [{ item: ItemType.Clay, amount: 2 }, { item: ItemType.Deadwood, amount: 3 }], makes: [{ item: ItemType.Pot, amount: 1 }], seconds: 20, running: false, progress: 0, refusal: null, why: '' },
  ],
  shelf: [[ItemType.Clay, 3]],
  panel: null,
  choices: [
    { designId: 'daub-pit', icon: 'daub', label: 'Daub pit', ok: true, reason: '' },
    { designId: 'well', icon: 'well', label: 'Well', ok: false, reason: 'a well wants a ground slot' },
  ],
  raise: {
    name: 'Walled yard',
    slots: 4,
    cost: [
      { item: ItemType.Cord, amount: 2, have: 2 },
      { item: ItemType.Daub, amount: 3, have: 3 },
    ],
    ordered: true,
    progress: 0.6,
  },
  state: 'being cleared',
};

const AREA_HAND: AreaHand = {
  open: () => undefined,
  charge: () => undefined,
  move: () => undefined,
  place: () => undefined,
  raise: () => undefined,
  remove: () => undefined,
  close: () => undefined,
};

function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="hud-frame">{children}</div>;
}

export function Hud(): React.JSX.Element {
  const [held, setHeld] = useState<IconName | null>(null);
  const [charge, setCharge] = useState(1);
  const [queue, setQueue] = useState(SAMPLE_RIG.queue);

  /*
   * The bench keeps the queue itself, so dragging an entry about can actually be looked at:
   * the panel draws the order it is handed and the order is only ever the real one.
   */
  const hand: RigHand = {
    charge: setCharge,
    close: () => undefined,
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
          {/* The control bar's own: the fire is the band, which is what the slab is about. */}
          <PixelTile icon="hearth" label="The day" held={held === 'hearth'} onClick={() => setHeld('hearth')} />
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

        <h2>area sheets</h2>
        <Frame>
          <AreaSheet stage="fire" area={CLEARING_AREA} hand={AREA_HAND} />
        </Frame>
        <Frame>
          <AreaSheet stage="fire" area={{ ...YARD_AREA, panel: { ...SAMPLE_RIG, charge } }} hand={{ ...AREA_HAND, charge: setCharge }} />
        </Frame>
        <Frame>
          <AreaSheet stage="village" area={CHOOSING_AREA} hand={AREA_HAND} />
        </Frame>
        <Frame>
          <AreaSheet stage="stone" area={{ ...CLEARING_AREA, open: 1, raise: { name: 'Walled yard', slots: 4, cost: [{ item: ItemType.Cord, amount: 2, have: 1 }, { item: ItemType.Daub, amount: 3, have: 0 }], ordered: false, progress: 0 } }} hand={AREA_HAND} />
        </Frame>

        <h2>the hand that sets a rig, at each stage (all three fires paid for)</h2>
        {(['fire', 'village', 'stone'] as const).map((stage) => (
          <Frame key={stage}>
            <RigSlab stage={stage} rig={{ ...SAMPLE_RIG, charge, queue }} hand={hand} />
          </Frame>
        ))}

        <h2>no wood yet: only the banked fire is live</h2>
        <Frame>
          <RigSlab stage="fire" rig={NO_WOOD_RIG} hand={hand} />
        </Frame>

        <h2>a lot standing in it</h2>
        <Frame>
          <RigSlab stage="stone" rig={STOCKED_RIG} hand={hand} />
        </Frame>

        <h2>cold work, and a pile that still has a knob</h2>
        <Frame>
          <RigSlab stage="fire" rig={HAND_RIG} hand={hand} />
        </Frame>
        <Frame>
          <RigSlab stage="village" rig={CLAMP_RIG} hand={hand} />
        </Frame>

        <h2>changing over, and the two ends of a shelf</h2>
        <Frame>
          <RigSlab stage="fire" rig={{ ...CHANGING_RIG, charge }} hand={hand} />
        </Frame>
        <Frame>
          <RigSlab stage="village" rig={SHELVES_RIG} hand={hand} />
        </Frame>

        <h2>a building with nothing to set</h2>
        <Frame>
          <HoldingSlab
            stage="fire"
            onClose={() => {}}
            holding={{
              label: 'Forage camp',
              state: 'working',
              stock: [[ItemType.Deadwood, 3], [ItemType.Berries, 1]],
              capacity: 8,
              work: {
                uses: [],
                makes: [{ item: ItemType.Deadwood, amount: 4 }],
                seconds: 14,
                progress: 0.3,
                pool: [
                  { item: ItemType.Deadwood, chance: 0.7 },
                  { item: ItemType.Berries, chance: 0.2 },
                  { item: ItemType.Fibre, chance: 0.1 },
                ],
              },
            }}
          />
        </Frame>
        <Frame>
          <HoldingSlab
            stage="fire"
            onClose={() => undefined}
            holding={{ label: 'Well', state: 'working', stock: [[ItemType.Water, 3]], capacity: 8, work: { uses: [], makes: [{ item: ItemType.Water, amount: 1 }], seconds: 5, progress: 0.6 } }}
          />
        </Frame>
        <Frame>
          <HoldingSlab
            stage="village"
            onClose={() => undefined}
            holding={{ label: 'Lean-to', state: 'idle', stock: [], capacity: 8 }}
          />
        </Frame>

        <h2>the town, as it can see itself</h2>
        <div className="hud-rigs hud-towns">
          <TownSlab stage="fire" town={SAMPLE_TOWN} />
          <TownSlab stage="village" town={RICH_TOWN} />
          <TownSlab stage="stone" town={{ ...RICH_TOWN, standing: [] }} />
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
