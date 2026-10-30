import type { Emission } from '../fire/api.ts';
import type { EmitterSource } from '../fire/api.ts';
import { capability } from '../../sim/kernel/kernel.ts';

export const EMISSION = capability<Emission>('emission');
export const EMITTER_SOURCES = capability<readonly EmitterSource[]>('emitterSources');
