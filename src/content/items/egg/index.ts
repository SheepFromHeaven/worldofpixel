import { item, food, stackable } from '../definition.ts';

export const egg = item('egg', 'egg', 'egg', stackable(), food({ kcal: 160, cooksTo: 'roast' }));

export const order = 11;

export default egg;
