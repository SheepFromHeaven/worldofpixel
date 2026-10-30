import { station, emits, ground, fuelled, placedBy } from '../definition.ts';

export const CAMPFIRE = station('campfire', 'Campfire', 'campfire.base',
  fuelled({ capacity: 600, burn: 0.5, start: 300 }),
  emits({
    look: 'fire',
    when: 'lit',
    igniter: true,
    heat: { reach: 7, output: 1 },
    light: { reach: 7, strength: 1.35, colour: [1, 0.58, 0.26], flicker: 1, windShare: 0.5, flame: 'campfire', lift: 0 },
  }),
  ground({ clears: true }),
  placedBy('planCampfire'),
);
