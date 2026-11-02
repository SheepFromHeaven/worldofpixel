import { seasonPhaseAtLatitude } from '../../sim/astro.ts';
import { Animals } from './animals/animals.ts';
import type { AnimalEnvironment } from './animals/animals.ts';
import { turnRadiusOf } from './animals/walker.ts';
import { CALENDAR, SPOT, WORLD } from '../../sim/capabilities.ts';
import { ANIMALS } from './api.ts';
import { FAUNA, FAUNA_CLIMATE } from '../fauna/api.ts';
import { SKY } from '../weather/api.ts';
import { daylightAt, placeOf } from '../../sim/daylight.ts';
import { provide, system } from '../../sim/kernel/kernel.ts';
import { Gait, MAMMALS } from './species.ts';
import { trapezoid } from '../flora/api.ts';
import { listingsOf } from '../../sim/kernel/listing.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const DEFAULT_RADIUS = 80;

const ROAMING_GAITS: readonly number[] = [Gait.Walk, Gait.Trot, Gait.Hop, Gait.Bound, Gait.Swim, Gait.Cruise, Gait.Porpoise];
const CONTINUOUS_GAITS: readonly number[] = [Gait.Cruise, Gait.Porpoise];

const mammals = system({
  id: 'mammals',
  tags: ['fauna'],
  needs: { world: WORLD, sky: SKY, calendar: CALENDAR, fauna: FAUNA, climate: FAUNA_CLIMATE, spot: SPOT },
  create: ({ world, sky, calendar, fauna, climate, spot }) => {
    const environment: AnimalEnvironment = {
      days: () => calendar.totalDays,
      comfortAt: (kind, x, y) => {
        const cell = sky.cellContainingTile(world.grid.column(x), world.grid.row(y));
        const place = placeOf(world.grid, world.seed, { x, y });
        return trapezoid(kind.temperature, climate.celsius[cell] ?? 15) * trapezoid(kind.season, seasonPhaseAtLatitude(calendar.seasonPhase, place.latitude));
      },
      busyAt: (kind, x, y) => {
        const day = daylightAt(calendar.moment, placeOf(world.grid, world.seed, { x, y })).daylight;
        return Math.min(1, Math.max(0, kind.night + (kind.day - kind.night) * day + kind.dusk * 4 * day * (1 - day)));
      },
    };
    const animals = new Animals(world, fauna, world.seed, environment);
    animals.setFocus({ x: spot.x, y: spot.y, radius: DEFAULT_RADIUS });
    return {
      provides: [provide(ANIMALS, animals)],
      commands: {
        focus: ({ x, y, radius }: { x: number; y: number; radius: number }) => (animals.setFocus({ x, y, radius }), false),
        startle: ({ x, y }: { x: number; y: number }) => (animals.startle({ x, y }), false),
      },
      update: ({ seconds, scaled }) => animals.update(scaled, seconds),
    };
  },
});

const listings = listingsOf('mammal', MAMMALS, (one) => ({
  speed: one.speed,
  reach: one.reach,
  rest: one.rest,
  roams: ROAMING_GAITS.includes(one.gait),
  restless: CONTINUOUS_GAITS.includes(one.gait),
  radius: turnRadiusOf(one.length),
  length: one.length,
}));

export const mammalsModule = defineModule('mammals', [mammals], { order: 150, heavy: true, listings, kind: { group: 'mammal', title: 'mammals' } });
export { Animals };
