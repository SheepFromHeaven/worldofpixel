import { item, fuel, stackable } from '../definition.ts';

export const basket = item('basket', 'basket', 'basket', stackable(), fuel(20));

export const order = 13;

export default basket;
