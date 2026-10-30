import { registerBrush, registerDrawable, registerSheet } from '../clientSlots.ts';
import { structureBrush } from './brush.ts';
import { structures } from './draw.ts';
import { structureAt } from './sheet.ts';

registerSheet({ id: 'structures', at: structureAt });
registerDrawable(structures);
registerBrush(structureBrush);
