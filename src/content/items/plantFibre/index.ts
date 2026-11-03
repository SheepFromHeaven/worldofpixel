import { item, fuel, stackable } from '../definition.ts';

export const plantFibre = item('plantFibre', 'plant fibre', 'fibre', stackable(), fuel(10));

export const order = 8;

export default plantFibre;
