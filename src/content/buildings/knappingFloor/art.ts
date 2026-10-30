import type { Art } from '../../art.ts';
import { bakeMarker } from '../../../render/lit/growth/markerBake.ts';
import { sprites } from './sprite.ts';

export const art: Art = {
  sprites,
  bakes: [{ match: (name) => name === 'marker.floor', bake: bakeMarker }],
};
