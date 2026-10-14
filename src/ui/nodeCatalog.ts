import { Resources } from '../engine/recipes.js';
import { Channel } from '../engine/types.js';
import type { ResourceId } from '../engine/types.js';

export interface SourceEntry {
  key: string;
  label: string;
  channel: Channel;
  resource: ResourceId;
}

export const SOURCE_CATALOG: readonly SourceEntry[] = [
  { key: 'earth', label: 'Earth Source', channel: Channel.Solid, resource: Resources.Earth },
  { key: 'water', label: 'Water Source', channel: Channel.Fluid, resource: Resources.Water },
  { key: 'fire', label: 'Fire Source', channel: Channel.Heat, resource: Resources.Fire },
  { key: 'air', label: 'Air Source', channel: Channel.Gas, resource: Resources.Air },
];
