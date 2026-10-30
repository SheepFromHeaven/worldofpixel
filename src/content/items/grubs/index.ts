import { item, food, stackable } from '../definition.ts';

export const grubs = item('grubs', 'grubs', 'grubs', stackable(), food({ kcal: 110, cooksTo: 'roast' }));
