import type { TileIndex } from '../sim/grid.ts';
import type { ItemType } from '../sim/people/items.ts';
import { ITEM_NAMES } from '../sim/people/items.ts';
import { NOBODY } from '../sim/people/people.ts';
import { igniterNear } from '../sim/sources/emitters.ts';
import { FUEL_CAPACITY } from '../sim/sources/fuel.ts';
import { Blueprint, Cover } from '../sim/world.ts';
import type { GameMode } from '../sim/simulation.ts';
import type { People } from '../sim/people/people.ts';
import type { World } from '../sim/world.ts';
import type { Slice } from './radialMenu.ts';

export interface RadialHost {
  readonly world: World;
  readonly people: People;
  readonly depth: number;
  readonly mode: GameMode;
  deepCaveAt(index: TileIndex): boolean;
  clearStorage(index: TileIndex): void;
  clearFloor(index: TileIndex): void;
  designateStorage(index: TileIndex): void;
  layFloor(index: TileIndex): void;
  pickUp(index: TileIndex, item: ItemType): void;
  experiment(index: TileIndex): void;
  bringHere(index: TileIndex): void;
  cancelPlan(index: TileIndex): void;
  planRelight(index: TileIndex): void;
  planCampfire(index: TileIndex): void;
  addFuel(index: TileIndex): void;
  lightTorch(index: TileIndex): void;
  plantTorch(index: TileIndex): void;
  chopWood(index: TileIndex): void;
  openTile(index: TileIndex): void;
}

const titled = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export function slicesFor(game: RadialHost, index: TileIndex): Slice[] {
  const { world, people } = game;
  const tile = world.tile(index);
  const slices: Slice[] = [];

  const kinds = world.items.kindsAt(index);
  const lying = world.items.at(index).length;

  const standable = tile.passable ? null : (tile.refusal ?? 'cannot stand here');
  if (world.isStorage(index)) {
    slices.push({ label: 'Clear Storage', reason: null, run: () => game.clearStorage(index) });
  } else if (world.isFloor(index)) {
    slices.push({ label: 'Clear Knapping Floor', reason: null, run: () => game.clearFloor(index) });
  } else {
    slices.push({ label: 'Designate Storage', reason: standable, run: () => game.designateStorage(index) });
    slices.push({ label: 'Designate Knapping Floor', reason: standable, run: () => game.layFloor(index) });
  }

  for (const kind of kinds) {
    const reason = people.pickerFor(index) === NOBODY ? 'hands are full' : null;
    slices.push({ label: `Pick Up ${titled(ITEM_NAMES[kind] ?? 'item')}`, reason, run: () => game.pickUp(index, kind) });
  }

  if (world.isFloor(index)) {
    const reason = lying === 0 ? 'nothing on the floor' : people.knapperFor(index) === NOBODY ? 'nobody free' : null;
    slices.push({ label: 'Experiment', reason, run: () => game.experiment(index) });
  }

  const carrier = people.carrierFor(index);
  if (carrier !== NOBODY) {
    const held = people.heldItemType[carrier]! as ItemType;
    const reason = !tile.passable
      ? 'cannot stand here'
      : world.isStorage(index) && !world.storageAccepts(index, held)
        ? 'storage holds something else'
        : world.isFloor(index) && world.floorSpace(index) === 0
          ? 'the floor is full'
          : null;
    slices.push({ label: 'Bring Here', reason, run: () => game.bringHere(index) });
  }

  const centre = world.grid.centre(index);
  if (world.isPlanned(index)) {
    slices.push({ label: world.plan[index] === Blueprint.Relight ? 'Cancel Relight' : 'Cancel Campfire Plan', reason: null, run: () => game.cancelPlan(index) });
  } else if (world.isEmber(index)) {
    slices.push({ label: 'Relight Campfire', reason: null, run: () => game.planRelight(index) });
  } else if (!world.isFire(index) && !world.isStorage(index) && igniterNear(world, people, centre.x, centre.y)) {
    const reason = !tile.passable ? (tile.refusal ?? 'cannot stand here') : tile.cover === Cover.Tree ? 'a tree is in the way' : null;
    slices.push({ label: 'Plan Campfire', reason, run: () => game.planCampfire(index) });
  }

  if (world.isFire(index)) {
    const fuelled = people.feederFor(index) !== NOBODY;
    slices.push({ label: 'Add Fuel', reason: !fuelled ? 'needs a branch or kindling in hand' : world.fuelAt(index) >= FUEL_CAPACITY ? 'it is full' : null, run: () => game.addFuel(index) });
    slices.push({ label: 'Light Torch', reason: people.lighterFor(index) === NOBODY ? 'needs a branch in hand' : null, run: () => game.lightTorch(index) });
  }

  if (game.depth > 0) {
    const reason = world.isDeepTorch(index) ? 'a torch is already here' : game.deepCaveAt(index) ? null : 'needs open cave air';
    slices.push({ label: 'Place Torch', reason, run: () => game.plantTorch(index) });
  } else if (game.mode === 'discover' || people.planterFor(index) !== NOBODY) {
    slices.push({ label: 'Place Torch', reason: world.plantable(index) ? null : 'cannot stand a torch here', run: () => game.plantTorch(index) });
  }

  if (people.knowledge.hasDiscoveredFlintKnapping && tile.cover === Cover.Tree) {
    slices.push({ label: 'Chop Wood', reason: people.chopperFor(index) === NOBODY ? 'needs an axe in hand' : null, run: () => game.chopWood(index) });
  }

  slices.push({ label: 'Inspect Ground', reason: null, run: () => game.openTile(index) });
  return slices;
}
