import { FAUNA } from '../fauna/api.ts';
import { system } from '../../sim/kernel/kernel.ts';
import { BIRDS } from './species.ts';
import { DEFAULT_RADIUS, listingsOf } from '../../sim/kernel/listing.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const birds = system({ id: 'birds', needs: { fauna: FAUNA }, create: () => ({}) });

export const birdsModule = defineModule('birds', [birds], {
  order: 160, heavy: true,
  kind: { group: 'bird', title: 'birds' },
  listings: listingsOf('bird', BIRDS, (one) => ({ speed: one.speed, reach: one.reach, rest: one.rest, roams: false, restless: false, radius: DEFAULT_RADIUS, length: 0 })),
});
