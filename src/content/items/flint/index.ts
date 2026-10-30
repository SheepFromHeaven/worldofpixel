import { found, item, stackable } from '../definition.ts';

export const flint = item('flint', 'flint', 'flint', stackable(), found(3, { bare: 0.2 }));

export const order = 1;

export default flint;
