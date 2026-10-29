import { FAUNA } from '../capabilities.ts';
import { system } from '../kernel/kernel.ts';
import { REPTILES } from '../reptiles/species.ts';
import { DEFAULT_RADIUS, listingsOf } from './listing.ts';
import { defineModule } from './module.ts';

const reptiles = system({ id: 'reptiles', needs: { fauna: FAUNA }, create: () => ({}) });

export const reptilesModule = defineModule('reptiles', [reptiles], {
  kind: { group: 'reptile', title: 'reptiles' },
  listings: listingsOf('reptile', REPTILES, (one) => ({ speed: one.speed, reach: one.reach, rest: one.rest, roams: true, restless: false, radius: DEFAULT_RADIUS, length: 0 })),
});
