import type { TileIndex } from '../sim/grid.ts';
import type { ItemType } from '../sim/people/items.ts';
import { ITEM_NAMES } from '../sim/people/items.ts';
import { NOBODY } from '../sim/people/people.ts';
import { igniterNear } from '../sim/sources/emitters.ts';
import { FUEL_CAPACITY } from '../sim/sources/fuel.ts';
import { Blueprint, Building, Cover } from '../sim/world.ts';
import type { GameMode } from '../sim/simulation.ts';
import type { People } from '../sim/people/people.ts';
import type { World } from '../sim/world.ts';
import type { Slice } from './radialMenu.ts';
import { RECIPES, chainOf, neuronIndex, Outcome } from '../sim/mind/neurons.ts';

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
  planKindle(index: TileIndex): void;
  planBed(index: TileIndex): void;
  planHut(index: TileIndex): void;
  planSnare(index: TileIndex): void;
  demolish(index: TileIndex): void;
  roast(index: TileIndex): void;
  readonly gathering: boolean;
  setGathering(on: boolean): void;
  readonly angling: boolean;
  setAngling(on: boolean): void;
  mindKnows(id: string): boolean;
  order(index: TileIndex, result: number): void;
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
  const erect: Slice[] = [];

  const kinds = world.items.kindsAt(index);
  const standable = tile.passable ? null : (tile.refusal ?? 'cannot stand here');
  const freeGround = !world.isStorage(index) && !world.isFloor(index);

  if (world.isStorage(index)) slices.push({ label: 'Clear Storage', reason: null, run: () => game.clearStorage(index) });
  else if (world.isFloor(index)) slices.push({ label: 'Clear Knapping Floor', reason: null, run: () => game.clearFloor(index) });
  else erect.push({ label: 'Storage', reason: standable, run: () => game.designateStorage(index) });

  const buildable = freeGround && !world.isPlanned(index) && !world.isFire(index) && !world.isEmber(index) && world.built[index] === Building.None;
  if (world.built[index] !== Building.None) {
    slices.push({ label: world.built[index] === Building.Hut ? 'Take Down Hut' : world.built[index] === Building.Snare ? 'Take Down Snare' : 'Take Down Bed', reason: null, run: () => game.demolish(index) });
  }
  if (buildable && game.mindKnows('bed')) erect.push({ label: 'Bed', reason: tile.cover === Cover.Tree ? 'a tree is in the way' : standable, run: () => game.planBed(index) });
  if (buildable && game.mindKnows('snare')) erect.push({ label: 'Snare', reason: tile.cover === Cover.Tree ? 'a tree is in the way' : standable, run: () => game.planSnare(index) });
  if (buildable && game.mindKnows('hut')) erect.push({ label: 'Hut', reason: tile.cover === Cover.Tree ? 'a tree is in the way' : standable, run: () => game.planHut(index) });

  if (freeGround && game.mindKnows('tool')) erect.push({ label: 'Knapping Floor', reason: standable, run: () => game.layFloor(index) });

  for (const kind of kinds) {
    const reason = people.pickerFor(index) === NOBODY ? 'hands are full' : null;
    slices.push({ label: `Pick Up ${titled(ITEM_NAMES[kind] ?? 'item')}`, reason, run: () => game.pickUp(index, kind) });
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
  const treeless = !tile.passable ? (tile.refusal ?? 'cannot stand here') : tile.cover === Cover.Tree ? 'a tree is in the way' : null;
  if (world.isPlanned(index)) {
    slices.push({ label: world.plan[index] === Blueprint.Relight ? 'Cancel Relight' : world.plan[index] === Blueprint.Bed ? 'Cancel Bed Plan' : world.plan[index] === Blueprint.Hut ? 'Cancel Hut Plan' : world.plan[index] === Blueprint.Snare ? 'Cancel Snare Plan' : 'Cancel Campfire Plan', reason: null, run: () => game.cancelPlan(index) });
  } else if (world.isEmber(index)) {
    slices.push({ label: 'Relight Campfire', reason: null, run: () => game.planRelight(index) });
  } else if (!world.isFire(index) && !world.isStorage(index) && igniterNear(world, people, centre.x, centre.y)) {
    erect.push({ label: 'Campfire', reason: treeless, run: () => game.planCampfire(index) });
  } else if (!world.isFire(index) && !world.isStorage(index) && game.mindKnows('flame')) {
    erect.push({ label: 'Campfire', reason: treeless, run: () => game.planKindle(index) });
  }

  for (const recipe of RECIPES) {
    if (recipe.order === undefined || recipe.outcome !== Outcome.Success || !game.mindKnows(recipe.result)) continue;
    if (recipe.station === 'floor' && !world.isFloor(index)) continue;
    const needs = chainOf(neuronIndex(recipe.a), neuronIndex(recipe.b), recipe).needs;
    let short: string | null = null;
    for (const [kind, count] of needs) if (short === null && people.available(kind, index) < count) short = `needs ${count} ${ITEM_NAMES[kind] ?? 'item'}`;
    const reason = !tile.passable ? (tile.refusal ?? 'cannot stand here') : short;
    slices.push({ label: recipe.order, reason, run: () => game.order(index, neuronIndex(recipe.result)) });
  }

  if (world.isFire(index)) {
    const fuelled = people.feederFor(index) !== NOBODY;
    slices.push({ label: 'Add Fuel', reason: !fuelled ? 'needs a branch or kindling in hand' : world.fuelAt(index) >= FUEL_CAPACITY ? 'it is full' : null, run: () => game.addFuel(index) });
    slices.push({ label: 'Light Torch', reason: people.lighterFor(index) === NOBODY ? 'needs a branch in hand' : null, run: () => game.lightTorch(index) });
    if (game.mindKnows('cooked')) slices.push({ label: 'Roast Food', reason: people.roasterFor(index) === NOBODY ? 'needs raw food in hand or lying about' : null, run: () => game.roast(index) });
  }

  if (game.depth > 0) {
    const reason = world.isDeepTorch(index) ? 'a torch is already here' : game.deepCaveAt(index) ? null : 'needs open cave air';
    slices.push({ label: 'Place Torch', reason, run: () => game.plantTorch(index) });
  } else if (game.mode === 'discover' || people.planterFor(index) !== NOBODY) {
    erect.push({ label: 'Torch', reason: world.plantable(index) ? null : 'cannot stand a torch here', run: () => game.plantTorch(index) });
  }

  if (people.knowledge.hasDiscoveredFlintKnapping && tile.cover === Cover.Tree) {
    slices.push({ label: 'Chop Wood', reason: people.chopperFor(index) === NOBODY ? 'needs an axe in hand' : null, run: () => game.chopWood(index) });
  }

  if (erect.length > 0 && (game.mode === 'discover' || game.mindKnows('flame') || game.mindKnows('tool') || game.mindKnows('bed') || game.mindKnows('hut') || game.mindKnows('snare'))) {
    slices.push({ label: 'Erect', reason: null, run: () => undefined, children: erect });
  }

  const orders: Slice[] = [];
  if (game.mindKnows('basket')) orders.push({ label: game.gathering ? 'Stop Gathering' : 'Gather Food', reason: world.storageTiles.length === 0 ? 'needs a storage' : null, run: () => game.setGathering(!game.gathering) });
  if (game.mindKnows('spear')) orders.push({ label: game.angling ? 'Stop Fishing' : 'Go Fishing', reason: world.storageTiles.length === 0 ? 'needs a storage' : null, run: () => game.setAngling(!game.angling) });
  if (orders.length > 0) slices.push({ label: 'Orders', reason: null, run: () => undefined, children: orders });

  slices.push({ label: 'Inspect Ground', reason: null, run: () => game.openTile(index) });
  return slices;
}
