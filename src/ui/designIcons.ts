import type { IconName } from '../pixel/ui/metrics.ts';

const ICONS: Record<string, IconName> = {
  fireplace: 'hearth',
  well: 'well',
  digging: 'dig',
  woodcutter: 'woodcutter',
  'forage-camp': 'forage',
  'bank-dig': 'mud',
  'clay-pit': 'clay',
  'reed-bed': 'fibre',
  'fibre-patch': 'fibre',
  'pit-firing': 'pit-fire',
  'charcoal-clamp': 'clamp',
  'cord-walk': 'cord-walk',
  'weaving-frame': 'weaving-frame',
  'daub-pit': 'daub',
};

export const designIcon = (id: string): IconName => ICONS[id] ?? 'design';
