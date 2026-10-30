import { found, item, fuel, stackable } from '../definition.ts';

export const branch = item('branch', 'branch', 'branch', stackable(), fuel(100, { feeds: true }), found(8, { scrub: 0.45, bush: 0.5, tree: 0.7, fallen: 0.8 }));

export const order = 4;

export default branch;
