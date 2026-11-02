import { item, food, stackable } from '../definition.ts';

export const grubs = item('grubs', 'grubs', 'grubs', stackable(), food({ kcal: 110, cooksTo: 'roast' }));

export const order = 10;

export default grubs;
