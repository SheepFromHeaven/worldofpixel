import { SAVED } from '../../sim/capabilities.ts';
import { MIND } from './api.ts';
import { PEOPLE } from '../people/api.ts';
import { available } from '../construction/api.ts';
import { provide, system } from '../../sim/kernel/kernel.ts';
import { Mind } from './mind.ts';
import { chainOf, neuronIndex, RECIPES } from './neurons.ts';
import type { Offer, Offers } from '../../sim/offers.ts';
import { ITEM_NAMES } from '../items/api.ts';
import { mindSystem } from '../../sim/kernel/systems.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const thinking = system({
  id: 'thinking',
  needs: { people: PEOPLE, saved: SAVED },
  create: ({ people, saved }) => {
    const mind = new Mind(people);
    people.mind = mind;
    if (saved?.mind) mind.restore(saved.mind);
    if (saved) people.endAllWonders();
    return { provides: [provide(MIND, mind)], save: () => ({ mind: mind.snapshot() }) };
  },
});

const mindVerbs = system({
  id: 'knowing',
  needs: { people: PEOPLE, mind: MIND },
  create: ({ mind }) => ({
    commands: {
      pick: ({ parent }: { parent: number }) => mind.pick(parent) !== 'not a neuron',
      drop: () => (mind.drop(), true),
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
    if (recipe.order === undefined || !context.knows(recipe.result)) continue;
    if (recipe.station) continue;
    const needs = chainOf(recipe.parents.map(neuronIndex), recipe).needs;
    let short: string | null = null;
    for (const [kind, count] of needs) if (short === null && available(people, kind, tile) < count) short = `needs ${count} ${ITEM_NAMES[kind] ?? 'item'}`;
    out.push({ label: recipe.order, reason: !here.passable ? (here.refusal ?? 'cannot stand here') : short, command: { kind: 'order', tile, result: neuronIndex(recipe.result) } });
  }
  return out;
};

export const mindModule = defineModule('mind', [thinking, mindSystem, mindVerbs], { order: 70, stage: true, offers: [recipeOffers] });
