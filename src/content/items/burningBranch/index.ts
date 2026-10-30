import { item, fuel, stackable } from '../definition.ts';

export const burningBranch = item('burningBranch', 'burning branch', 'branch', stackable(), fuel(80));

export const order = 7;

export default burningBranch;
