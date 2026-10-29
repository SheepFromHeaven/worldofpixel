import { FAUNA } from '../capabilities.ts';
import { system } from '../kernel/kernel.ts';
import { INSECTS } from '../insects/species.ts';
import { DEFAULT_RADIUS, listingsOf } from './listing.ts';
import { defineModule } from './module.ts';

const insects = system({ id: 'insects', needs: { fauna: FAUNA }, create: () => ({}) });

export const insectsModule = defineModule('insects', [insects], {
  kind: { group: 'insect', title: 'insects' },
  listings: listingsOf('insect', INSECTS, () => ({ speed: 1.2, reach: 6, rest: 0, roams: false, restless: false, radius: DEFAULT_RADIUS, length: 0 })),
});
