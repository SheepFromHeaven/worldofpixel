import { registerBrush, registerDrawable, registerSection, registerSheet } from '../clientSlots.ts';
import { structureBrush } from './brush.ts';
import { structures } from './draw.ts';
import { storageSection, structureAt } from './sheet.ts';

registerSheet({ id: 'structures', at: structureAt });
registerSection({ id: 'storage', order: 10, at: storageSection });
registerDrawable(structures);
registerBrush(structureBrush);
