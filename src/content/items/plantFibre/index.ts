import { found, item, fuel, stackable } from '../definition.ts';

export const plantFibre = item('plantFibre', 'plant fibre', 'fibre', stackable(), fuel(10), found(8, { grass: 0.6, scrub: 0.45, bush: 0.5 }));

export const order = 8;

export default plantFibre;
