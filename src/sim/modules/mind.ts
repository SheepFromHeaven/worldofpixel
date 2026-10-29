import { MIND, PEOPLE } from '../capabilities.ts';
import { system } from '../kernel/kernel.ts';
import { chainOf, neuronIndex, Outcome, RECIPES } from '../mind/neurons.ts';
import type { Offer, Offers } from '../offers.ts';
import { ITEM_NAMES } from '../people/items.ts';
import { mindSystem } from '../systems/people.ts';
import { defineModule } from './module.ts';

const mindVerbs = system({
  id: 'knowing',
  needs: { people: PEOPLE, mind: MIND },
  create: ({ mind }) => ({
    commands: {
      wonder: ({ a, b }: { a: number; b: number }) => (mind.wonder(a, b), true),
      forget: ({ id }: { id: number }) => (mind.cancel(id), true),
      order: ({ tile, result }: { tile: number; result: number }) => (mind.order(result, tile), true),
    },
  }),
});

const recipeOffers: Offers = (context, tile) => {
  const { world, people } = context;
  const here = world.tile(tile);
  const out: Offer[] = [];
  for (const recipe of RECIPES) {
    if (recipe.order === undefined || recipe.outcome !== Outcome.Success || !context.knows(recipe.result)) continue;
    if (recipe.station === 'floor' && !world.structures.isFloor(tile)) continue;
    const needs = chainOf(neuronIndex(recipe.a), neuronIndex(recipe.b), recipe).needs;
    let short: string | null = null;
    for (const [kind, count] of needs) if (short === null && people.available(kind, tile) < count) short = `needs ${count} ${ITEM_NAMES[kind] ?? 'item'}`;
    out.push({ label: recipe.order, reason: !here.passable ? (here.refusal ?? 'cannot stand here') : short, command: { kind: 'order', tile, result: neuronIndex(recipe.result) } });
  }
  return out;
};

export const mindModule = defineModule('mind', [mindSystem, mindVerbs], { offers: [recipeOffers] });
