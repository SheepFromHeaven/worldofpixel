import { ItemType } from './types.ts';
import type { RecipeId } from './types.ts';

export interface Recipe {
  id: RecipeId;
  label: string;
  inputs: { item: ItemType; amount: number }[];
  output: ItemType;
  outputAmount: number;
  /** Ticks of work once the ingredients are in the block's hoppers. */
  ticks: number;
}

/**
 * Everything a combine block knows how to do. A recipe is not attached to any building: the
 * player draws a machine around one, and the same recipe can sit in as many designs as they like.
 */
export const RECIPES: Recipe[] = [
  {
    id: 'mud',
    label: 'Mud',
    inputs: [
      { item: ItemType.Water, amount: 1 },
      { item: ItemType.Dirt, amount: 1 },
    ],
    output: ItemType.Mud,
    outputAmount: 1,
    ticks: 10,
  },
];

export function recipeById(id: RecipeId): Recipe | undefined {
  return RECIPES.find((recipe) => recipe.id === id);
}

export function describeRecipe(recipe: Recipe): string {
  const inputs = recipe.inputs.map((input) => `${input.amount} ${input.item}`).join(' + ');
  return `${inputs} → ${recipe.outputAmount} ${recipe.output} (${recipe.ticks} ticks)`;
}
