import { item, food, stackable } from '../definition.ts';

export const berries = item('berries', 'berries', 'berries', stackable(), food({ kcal: 140 }));
