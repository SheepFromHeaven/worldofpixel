import { item, fuel, stackable } from '../definition.ts';

export const torch = item('torch', 'torch', 'torch', stackable(), fuel(60));
