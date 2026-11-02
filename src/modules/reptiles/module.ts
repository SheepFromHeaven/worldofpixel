import { FAUNA } from '../fauna/api.ts';
import { system } from '../../sim/kernel/kernel.ts';
import { REPTILES } from './species.ts';
import { DEFAULT_RADIUS, listingsOf } from '../../sim/kernel/listing.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const reptiles = system({ id: 'reptiles', needs: { fauna: FAUNA }, create: () => ({}) });

export const reptilesModule = defineModule('reptiles', [reptiles], {
  order: 170, heavy: true,
  kind: { group: 'reptile', title: 'reptiles' },
  listings: listingsOf('reptile', REPTILES, (one) => ({ speed: one.speed, reach: one.reach, rest: one.rest, roams: true, restless: false, radius: DEFAULT_RADIUS, length: 0 })),
});
