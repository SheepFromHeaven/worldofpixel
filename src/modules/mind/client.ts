import type { TileIndex } from '../../sim/grid.ts';
import { registerSection } from '../clientSlots.ts';
import type { SheetButton, SheetContext, SheetSection } from '../clientSlots.ts';
import { available } from '../construction/api.ts';
import { ITEM_ART, ITEM_NAMES, ItemType } from '../items/api.ts';
import { PERSON_NAMES } from '../thoughts/api.ts';
import { QUEUE_LIMIT, State } from './mind.ts';
import { chainOf, neuronIndex, neuronOf, RECIPES } from './neurons.ts';
import type { Recipe } from './neurons.ts';

const iconOf = (recipe: Recipe): string => ITEM_ART[recipe.make[0] ?? neuronOf(neuronIndex(recipe.result)).item] ?? 'crate';

function shortOf(context: SheetContext, recipe: Recipe, tile: TileIndex): string | null {
  for (const [kind, count] of chainOf(recipe.parents.map(neuronIndex), recipe).needs) {
    if (kind !== ItemType.None && available(context.people, kind, tile) < count) return `needs ${count} ${ITEM_NAMES[kind] ?? 'item'}`;
  }
  return null;
}

function queueAt(context: SheetContext, tile: TileIndex): readonly SheetSection[] {
  const { world, mind } = context;
  const station = world.structures.stationAt(tile);
  if (station === null || mind === null) return [];
  const known = new Set(mind.neurons.map((neuron) => neuron.index));
  const recipes = RECIPES.filter((recipe) => recipe.order !== undefined && recipe.station === station && known.has(neuronIndex(recipe.result)));
  if (recipes.length === 0) return [];

  const queued = mind.hypotheses.filter((hypothesis) => hypothesis.order && hypothesis.state === State.Open && hypothesis.tile === tile);
  const full = queued.length >= QUEUE_LIMIT;
  const queue: SheetButton[] = queued.map((hypothesis) => {
    const recipe = recipes.find((one) => neuronIndex(one.result) === hypothesis.result);
    const working = hypothesis.tryer >= 0;
    return {
      key: `order-${hypothesis.id}`,
      icon: recipe ? iconOf(recipe) : 'crate',
      name: recipe?.order ?? 'order',
      on: true,
      note: working ? `${PERSON_NAMES[hypothesis.tryer] ?? 'someone'} is at it` : `${hypothesis.note}, click to take it off`,
      command: working ? null : { kind: 'forget', id: hypothesis.id },
    };
  });
  const make: SheetButton[] = recipes.map((recipe) => {
    const short = shortOf(context, recipe, tile);
    return {
      key: `make-${recipe.result}`,
      icon: iconOf(recipe),
      name: recipe.order!,
      on: true,
      note: full ? 'the queue is full' : short ? `${short}, it waits until there are` : 'add one to the queue',
      command: full ? null : { kind: 'order', tile, result: neuronIndex(recipe.result) },
    };
  });
  return [
    { id: 'make', title: 'make', hint: 'add to the queue', buttons: make },
    { id: 'queue', title: 'queue', hint: 'first in is made first', slots: QUEUE_LIMIT, buttons: queue },
  ];
}

registerSection({ id: 'orders', order: 20, at: queueAt });
