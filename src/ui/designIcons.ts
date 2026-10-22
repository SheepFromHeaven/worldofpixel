import type { IconName } from '../pixel/ui/metrics.ts';

/**
 * The picture for anything that can stand in a slot: a land work or a station. One map, so the
 * bars, the area sheet and its slot row draw the same thing for the same design.
 */
const ICONS: Record<string, IconName> = {
  hearth: 'hearth',
  well: 'well',
  digging: 'dig',
  woodcutter: 'woodcutter',
  'forage-camp': 'deadwood',
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
