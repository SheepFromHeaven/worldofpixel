import { item, food, stackable } from '../definition.ts';

export const roast = item('roast', 'roast', 'roast', stackable(), food({ kcal: 320 }));
