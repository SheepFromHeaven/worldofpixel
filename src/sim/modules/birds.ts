import { FAUNA } from '../capabilities.ts';
import { system } from '../kernel/kernel.ts';
import { BIRDS } from '../birds/species.ts';
import { DEFAULT_RADIUS, listingsOf } from './listing.ts';
import { defineModule } from './module.ts';

const birds = system({ id: 'birds', needs: { fauna: FAUNA }, create: () => ({}) });

export const birdsModule = defineModule('birds', [birds], {
  kind: { group: 'bird', title: 'birds' },
  listings: listingsOf('bird', BIRDS, (one) => ({ speed: one.speed, reach: one.reach, rest: one.rest, roams: false, restless: false, radius: DEFAULT_RADIUS, length: 0 })),
});
