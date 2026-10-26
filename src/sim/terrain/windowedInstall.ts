import { WORLD_SCALE } from '../grid.ts';
import { windowedSteps } from './windowed.ts';
import { useFieldGenerator } from './worldfield.ts';

if (WORLD_SCALE > 1) useFieldGenerator(windowedSteps);
