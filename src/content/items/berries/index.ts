import { item, food, stackable } from '../definition.ts';

export const berries = item('berries', 'berries', 'berries', stackable(), food({ kcal: 140 }));

export const order = 9;

export default berries;
