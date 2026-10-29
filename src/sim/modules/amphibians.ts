import { FAUNA } from '../capabilities.ts';
import { system } from '../kernel/kernel.ts';
import { AMPHIBIANS } from '../amphibians/species.ts';
import { DEFAULT_RADIUS, listingsOf } from './listing.ts';
import { defineModule } from './module.ts';

const amphibians = system({ id: 'amphibians', needs: { fauna: FAUNA }, create: () => ({}) });

export const amphibiansModule = defineModule('amphibians', [amphibians], {
  kind: { group: 'amphibian', title: 'amphibians' },
  listings: listingsOf('amphibian', AMPHIBIANS, (one) => ({ speed: 1, reach: 8, rest: one.rest, roams: true, restless: false, radius: DEFAULT_RADIUS, length: 0 })),
});
