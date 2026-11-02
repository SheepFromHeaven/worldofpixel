import { item, food, stackable } from '../definition.ts';

export const roast = item('roast', 'roast', 'roast', stackable(), food({ kcal: 320 }));

export const order = 14;

export default roast;
