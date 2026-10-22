import { useState } from 'react';
import { ICON_NAMES, PLATE_NAMES } from '../pixel/ui/metrics.ts';
import type { IconName } from '../pixel/ui/metrics.ts';
import { ItemType } from '../sim/types.ts';
import { PixelHeading, PixelText } from '../ui/pixel/Pixel.tsx';
import { PixelSection, PixelTile } from '../ui/pixel/Tile.tsx';
import { Bar, Clock, RailEdge, Strip } from '../ui/shell.tsx';
import type { BarView, StripView } from '../ui/shellView.ts';
import { AreaSheet } from '../ui/AreaSheet.tsx';
import type { AreaHand, AreaView } from '../ui/areaView.ts';
import { TownSlab } from '../ui/TownSlab.tsx';
import type { FireView } from '../ui/rigView.ts';
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

/** A fireplace's banking strip, set to steady. */
const SAMPLE_RIG: FireView = { process: 'fire', charge: 1, affordable: [true, true, true], changingOver: false };

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
      label: 'Fireplace',
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

/** A clearing with its one slot taken by a fibre patch, and the wall of stones half carried. */
const CLEARING_AREA: AreaView = {
  buildingId: 'lab/area-1',
  stage: 0,
  stages: 5,
  slots: [{ icon: 'fibre', label: 'Fibre patch', station: false, removable: true, busy: true, blocked: false }],
  locked: [{ stage: 'Yard' }],
  open: null,
  grounds: [{
    icon: 'fibre',
    slot: 0,
    uses: [],
    makes: [{ item: ItemType.Fibre, amount: 2 }],
    seconds: 14,
    progress: 0.55,
    recipe: 0,
    recipes: [],
  }],
  list: [],
  shelf: [[ItemType.Fibre, 1], [ItemType.Stone, 2]],
  capacity: 8,
  panel: null,
  choices: null,
  raise: { name: 'Yard', slots: 2, cost: [{ item: ItemType.Stone, amount: 3, have: 2 }], ordered: true, progress: 0 },
  state: null,
};

/** A clearing with nothing in its one slot, open, and the choices for it. */
const EMPTY_AREA: AreaView = {
  ...CLEARING_AREA,
  buildingId: 'lab/area-0',
  slots: [{ icon: null, label: null, station: false, removable: false, busy: false, blocked: false }],
  open: 0,
  grounds: [],
  shelf: [],
  choices: [
    { designId: 'forage-camp', icon: 'forage', label: 'Forage camp', ok: true, reason: '' },
    { designId: 'bank-dig', icon: 'mud', label: 'Bank dig', ok: true, reason: '' },
    { designId: 'well', icon: 'well', label: 'Well', ok: false, reason: 'no Water for a Well in this ground' },
  ],
  raise: { name: 'Yard', slots: 2, cost: [{ item: ItemType.Stone, amount: 3, have: 0 }], ordered: false, progress: 0 },
};

/** The founding area: a fireplace and a forage camp, walled, with the fire's knobs open. */
const FORAGE_FUEL = [
  { item: ItemType.Deadwood, chance: 0.5 },
  { item: ItemType.Stone, chance: 0.5 },
];
const FORAGE_FOOD = [
  { item: ItemType.Berries, chance: 0.2 },
  { item: ItemType.Fibre, chance: 0.7 },
];

const FOUNDED_AREA: AreaView = {
  buildingId: 'lab/area-home',
  stage: 1,
  stages: 5,
  slots: [
    { icon: 'hearth', label: 'Fireplace', station: true, removable: false, busy: true, blocked: false },
    { icon: 'forage', label: 'Forage camp', station: false, removable: true, busy: true, blocked: false },
  ],
  locked: [{ stage: 'Walled yard' }],
  open: 0,
  grounds: [{
    icon: 'forage',
    slot: 1,
    uses: [],
    makes: [{ item: ItemType.Deadwood, amount: 4 }],
    seconds: 14,
    progress: 0.3,
    pool: FORAGE_FUEL,
    recipe: 0,
    recipes: [FORAGE_FUEL, FORAGE_FOOD],
  }],
  list: [
    { id: 'bank-the-fire', label: 'Embers', slot: 0, icon: 'hearth', uses: [{ item: ItemType.Deadwood, amount: 2 }], makes: [{ item: ItemType.Embers, amount: 1 }], seconds: 4, running: true, progress: 0.4, refusal: null, why: '', short: null },
  ],
  shelf: [[ItemType.Deadwood, 3], [ItemType.Berries, 2], [ItemType.Stone, 1], [ItemType.Embers, 2]],
  capacity: 8,
  panel: SAMPLE_RIG,
  choices: null,
  raise: {
    name: 'Walled yard',
    slots: 3,
    cost: [
      { item: ItemType.Cord, amount: 2, have: 0 },
      { item: ItemType.Daub, amount: 2, have: 0 },
    ],
    ordered: false,
    progress: 0,
  },
  state: null,
};

/** A walled yard round the fire, the fire's slot open, and the roof half paid for. */
const YARD_AREA: AreaView = {
  buildingId: 'lab/area-2',
  stage: 2,
  stages: 5,
  slots: [
    { icon: 'hearth', label: 'Fireplace', station: true, removable: false, busy: true, blocked: false },
    { icon: 'daub', label: 'Daub pit', station: true, removable: true, busy: false, blocked: true },
    { icon: null, label: null, station: false, removable: false, busy: false, blocked: false },
  ],
  locked: [{ stage: 'Roofed works' }],
  open: 0,
  grounds: [],
  list: [
    { id: 'seal-a-basket', label: 'Seal a basket', slot: 0, icon: 'hearth', uses: [{ item: ItemType.Basket, amount: 1 }, { item: ItemType.Daub, amount: 1 }], makes: [{ item: ItemType.Vessel, amount: 1 }], seconds: 8, running: true, progress: 0.4, refusal: null, why: '', short: null },
    { id: 'bank-the-fire', label: 'Embers', slot: 0, icon: 'hearth', uses: [{ item: ItemType.Deadwood, amount: 2 }], makes: [{ item: ItemType.Embers, amount: 1 }], seconds: 4, running: false, progress: 0, refusal: 'full', why: 'nowhere to put the Embers', short: null },
    { id: 'mix-daub', label: 'Mix daub', slot: 1, icon: 'daub', uses: [{ item: ItemType.Mud, amount: 2 }, { item: ItemType.Fibre, amount: 1 }], makes: [{ item: ItemType.Daub, amount: 1 }], seconds: 6, running: false, progress: 0, refusal: 'inputs', why: 'no Mud', short: ItemType.Mud },
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
    slots: 4,
    takes: 'no sun to dry in',
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
    { icon: 'clay', label: 'Clay pit', station: false, removable: true, busy: true, blocked: false },
    { icon: 'pit-fire', label: 'Pit firing', station: true, removable: true, busy: false, blocked: false },
    { icon: null, label: null, station: false, removable: false, busy: false, blocked: false },
  ],
  locked: [{ stage: 'Walled yard' }],
  open: 2,
  grounds: [{ icon: 'clay', slot: 0, uses: [], makes: [{ item: ItemType.Clay, amount: 2 }], seconds: 10, progress: 0.2, recipe: 0, recipes: [] }],
  list: [
    { id: 'fire-a-pot', label: 'Fire a pot', slot: 1, icon: 'pit-fire', uses: [{ item: ItemType.Clay, amount: 2 }, { item: ItemType.Deadwood, amount: 3 }], makes: [{ item: ItemType.Pot, amount: 1 }], seconds: 20, running: false, progress: 0, refusal: null, why: '', short: null },
  ],
  shelf: [[ItemType.Clay, 3]],
  panel: null,
  choices: [
    { designId: 'daub-pit', icon: 'daub', label: 'Daub pit', ok: true, reason: '' },
    { designId: 'well', icon: 'well', label: 'Well', ok: false, reason: 'the ground here is already opened' },
  ],
  raise: {
    name: 'Walled yard',
    slots: 3,
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
  recipe: () => undefined,
  remove: () => undefined,
  close: () => undefined,
};

/** The rail where it lives, docked to the edge of a stretch of map, at the width the game gives it. */
function Dock({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="hud-dock-slot" style={{ position: 'relative', width: 400, height: 780, background: '#5d7d49', flex: 'none' }}>
      {children}
    </div>
  );
}

/** A stretch of map standing in for the stage the shell is laid over. */
function Screen({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="se-stage hud-screen" style={{ position: 'relative', width: 1200, height: 480, background: '#5d7d49', flex: 'none', overflow: 'hidden' }}>
      {children}
    </div>
  );
}

/** The four slots that are always on screen, from plain data. */
function ShellFrame({
  strip,
  bar,
  tick = 0,
  paused = false,
}: {
  strip: StripView;
  bar: BarView;
  tick?: number;
  paused?: boolean;
}): React.JSX.Element {
  return (
    <>
      <RailEdge />
      <Strip strip={strip} onDice={() => undefined} onOpen={() => undefined} />
      <Clock clock={{ tick, playing: !paused, speed: 1 }} onPlaying={() => undefined} onSpeed={() => undefined} />
      <Bar bar={bar} onTool={() => undefined} />
    </>
  );
}


export function Hud(): React.JSX.Element {
  const [held, setHeld] = useState<IconName | null>(null);
  const [charge, setCharge] = useState(1);

  return (
    <main className="hud-lab">
      <header>
        <h1>hud lab</h1>
      </header>

      <div className="hud-stage">
        <h2>the shell: the frame before anything has happened, and full</h2>
        <div className="hud-rails">
          <Screen>
            <ShellFrame
              strip={{ seed: 7, town: false, people: 0, spare: 0, trouble: null }}
              bar={{ tool: 'found', fine: true, towns: 0 }}
            />
          </Screen>
        </div>
        <div className="hud-rails">
          <Screen>
            <ShellFrame
              strip={{ seed: 7, town: true, people: 4, spare: 11, trouble: 'one station is stuck' }}
              bar={{ tool: 'inspect', fine: true, towns: 1 }}
              tick={1530}
            />
            <AreaSheet stage="fire" area={{ ...FOUNDED_AREA, open: null, panel: null }} hand={AREA_HAND} />
          </Screen>
        </div>
        <div className="hud-rails">
          <Screen>
            <ShellFrame
              strip={{ seed: 7, town: false, people: 0, spare: 0, trouble: null }}
              bar={{ tool: 'inspect', fine: false, towns: 0 }}
              tick={0}
              paused
            />
          </Screen>
        </div>

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

        <h2>the docked rail at its real width: the yard, then a station, side by side</h2>
        <div className="hud-rails">
          <Dock>
            <AreaSheet stage="fire" area={{ ...FOUNDED_AREA, open: null, panel: null }} hand={AREA_HAND} />
          </Dock>
          <Dock>
            <AreaSheet stage="fire" area={{ ...FOUNDED_AREA, open: 0, panel: { ...SAMPLE_RIG, charge } }} hand={{ ...AREA_HAND, charge: setCharge }} />
          </Dock>
          <Dock>
            <AreaSheet stage="fire" area={{ ...FOUNDED_AREA, open: 2, panel: null }} hand={AREA_HAND} />
          </Dock>
          <Dock>
            <AreaSheet stage="village" area={{ ...YARD_AREA, open: 3, panel: null }} hand={AREA_HAND} />
          </Dock>
        </div>
        <div className="hud-rails">
          <Dock>
            <AreaSheet stage="village" area={{ ...YARD_AREA, open: null, panel: null }} hand={AREA_HAND} />
          </Dock>
          <Dock>
            <AreaSheet stage="village" area={CHOOSING_AREA} hand={AREA_HAND} />
          </Dock>
          <Dock>
            <AreaSheet stage="fire" area={{ ...CLEARING_AREA, open: null }} hand={AREA_HAND} />
          </Dock>
          <Dock>
            <AreaSheet stage="fire" area={EMPTY_AREA} hand={AREA_HAND} />
          </Dock>
        </div>

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
