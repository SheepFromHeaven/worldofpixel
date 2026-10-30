import { item, food, stackable } from '../definition.ts';

export const fish = item('fish', 'fish', 'fish', stackable(), food({ kcal: 190, cooksTo: 'roast' }));
