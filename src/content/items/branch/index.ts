import { item, fuel, stackable } from '../definition.ts';

export const branch = item('branch', 'branch', 'branch', stackable(), fuel(100, { feeds: true }));

export const order = 4;

export default branch;
