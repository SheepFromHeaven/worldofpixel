import { found, item, fuel, stackable } from '../definition.ts';

export const dryKindling = item('dryKindling', 'dry plant fibre', 'kindling', stackable(), fuel(30, { feeds: true }), found(3, { grass: 0.2, scrub: 0.2, bush: 0.15, fallen: 0.2 }));

export const order = 3;

export default dryKindling;
