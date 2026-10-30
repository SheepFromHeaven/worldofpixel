import { found, item, stackable } from '../definition.ts';

export const stone = item('stone', 'stone', 'stone', stackable(), found(3, { bare: 0.4 }));

export const order = 2;

export default stone;
