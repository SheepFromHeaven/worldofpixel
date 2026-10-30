import { fuel, item, stackable } from '../definition.ts';

export const hide = item('hide', 'hide', 'hide', stackable({ size: 16 }), fuel(8));

export const order = 17;

export default hide;
