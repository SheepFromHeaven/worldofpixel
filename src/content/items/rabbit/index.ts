import { item, food, stackable } from '../definition.ts';

export const rabbit = item('rabbit', 'rabbit', 'rabbit', stackable(), food({ kcal: 280, cooksTo: 'roast' }));

export const order = 16;

export default rabbit;
