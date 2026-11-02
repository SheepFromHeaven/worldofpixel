import { FAUNA } from '../fauna/api.ts';
import { system } from '../../sim/kernel/kernel.ts';
import { AMPHIBIANS } from './species.ts';
import { DEFAULT_RADIUS, listingsOf } from '../../sim/kernel/listing.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const amphibians = system({ id: 'amphibians', needs: { fauna: FAUNA }, create: () => ({}) });

export const amphibiansModule = defineModule('amphibians', [amphibians], {
  order: 180, heavy: true,
  kind: { group: 'amphibian', title: 'amphibians' },
  listings: listingsOf('amphibian', AMPHIBIANS, (one) => ({ speed: 1, reach: 8, rest: one.rest, roams: true, restless: false, radius: DEFAULT_RADIUS, length: 0 })),
});
