import { FAUNA } from '../fauna/api.ts';
import { system } from '../../sim/kernel/kernel.ts';
import { INSECTS } from './species.ts';
import { DEFAULT_RADIUS, listingsOf } from '../../sim/kernel/listing.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const insects = system({ id: 'insects', needs: { fauna: FAUNA }, create: () => ({}) });

export const insectsModule = defineModule('insects', [insects], {
  order: 190, heavy: true,
  kind: { group: 'insect', title: 'insects' },
  listings: listingsOf('insect', INSECTS, () => ({ speed: 1.2, reach: 6, rest: 0, roams: false, restless: false, radius: DEFAULT_RADIUS, length: 0 })),
});
