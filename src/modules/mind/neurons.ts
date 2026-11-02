import { RESEARCH } from '../../content/research/index.ts';
import { regionIndex } from '../../content/research/regions.ts';
import { itemId, ItemType } from '../items/api.ts';

export const Kind = { Thing: 0, Happening: 1 } as const;

export type Kind = (typeof Kind)[keyof typeof Kind];

export interface Neuron {
  id: string;
  label: string;
  kind: Kind;
  item: ItemType;
  region: number;
}

const itemOf = (key: string | null): ItemType => (key === null ? ItemType.None : itemId(key));

export const NEURONS: readonly Neuron[] = RESEARCH.map((entry) => ({ id: entry.key, label: entry.label, kind: entry.kind === 'thing' ? Kind.Thing : Kind.Happening, item: itemOf(entry.item), region: regionIndex(entry.region) }));

export type NeuronId = (typeof NEURONS)[number]['id'];

export const NEURON_COUNT = NEURONS.length;

export const neuronIndex = (id: string): number => NEURONS.findIndex((neuron) => neuron.id === id);

export const neuronOf = (index: number): Neuron => NEURONS[index]!;

export interface Recipe {
  parents: readonly string[];
  result: string;
  spend: readonly ItemType[];
  make: readonly ItemType[];
  title: string;
  words: string;
  order?: string;
  station?: string;
}

export const RECIPES: readonly Recipe[] = RESEARCH.flatMap((entry) =>
  entry.recipe
    ? [{ parents: entry.recipe.parents, result: entry.key, spend: entry.recipe.spend.map(itemOf), make: entry.recipe.make.map(itemOf), title: entry.recipe.title, words: entry.recipe.words, ...(entry.recipe.order ? { order: entry.recipe.order } : {}), ...(entry.recipe.station ? { station: entry.recipe.station } : {}) }]
    : [],
);

export const GOALS: readonly string[] = RESEARCH.filter((entry) => entry.goal).map((entry) => entry.key);

const MAKING: readonly number[] = NEURONS.map((neuron) => RECIPES.findIndex((recipe) => recipe.result === neuron.id));

export const recipeMaking = (result: number): Recipe | null => RECIPES[MAKING[result] ?? -1] ?? null;

export const isRoot = (neuron: number): boolean => (MAKING[neuron] ?? -1) < 0;

export const parentsOf = (result: number): readonly number[] => recipeMaking(result)?.parents.map(neuronIndex) ?? [];

export type Tally = Map<ItemType, number>;

export interface Chain {
  needs: Tally;
  spend: Tally;
  make: ItemType[];
}

const add = (into: Tally, kind: ItemType, count: number): void => {
  into.set(kind, (into.get(kind) ?? 0) + count);
};

function leaves(neuron: number, chain: Chain, depth = 0): void {
  const { item } = neuronOf(neuron);
  if (item !== ItemType.None) {
    add(chain.needs, item, 1);
    return;
  }
  const recipe = depth > 8 ? null : recipeMaking(neuron);
  if (!recipe) return;
  for (const part of recipe.parents) leaves(neuronIndex(part), chain, depth + 1);
  for (const kind of recipe.spend) add(chain.spend, kind, 1);
  chain.make.push(...recipe.make);
}

export function chainOf(parents: readonly number[], final: Recipe | null): Chain {
  const chain: Chain = { needs: new Map(), spend: new Map(), make: [] };
  for (const parent of parents) leaves(parent, chain);
  if (final) {
    for (const kind of final.spend) add(chain.spend, kind, 1);
    chain.make.push(...final.make);
  }
  for (const [kind, count] of chain.spend) {
    for (let used = 0; used < count; used += 1) {
      const at = chain.make.indexOf(kind);
      if (at < 0) break;
      chain.make.splice(at, 1);
      chain.spend.set(kind, (chain.spend.get(kind) ?? 0) - 1);
    }
  }
  const reused = new Map<ItemType, number>();
  for (const [kind, count] of chain.needs) {
    const wanted = Math.max(count, chain.spend.get(kind) ?? 0);
    reused.set(kind, wanted);
  }
  chain.needs = reused;
  return chain;
}
