import { CALENDAR, WORLD } from '../../sim/capabilities.ts';
import { FAUNA } from '../fauna/api.ts';
import { FISH_SIM, WATERS } from './api.ts';
import { PEOPLE } from '../people/api.ts';
import { SKY } from '../weather/api.ts';
import { DAY_SECONDS } from '../../sim/calendar.ts';
import { daylightAt, placeOf } from '../../sim/daylight.ts';
import { Fish } from './fish.ts';
import type { FishEnvironment } from './fish.ts';
import { provide, system } from '../../sim/kernel/kernel.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const ANGLE_REACH_TILES = 8;
const FISH_SEEK_TILES = 120;
const WATER_FOLLOWS_YEAR = 0.7;

const fish = system({
  id: 'fish',
  needs: { world: WORLD, sky: SKY, calendar: CALENDAR, people: PEOPLE, fauna: FAUNA },
  tags: ['fauna'],
  create: ({ world, sky, calendar, people, fauna }) => {
    const waters: FishEnvironment = {
      temperatureAt: (tile) => {
        const cell = sky.cellContainingTile(world.grid.columnOf(tile), world.grid.rowOf(tile));
        return WATER_FOLLOWS_YEAR * world.field.temperature[tile]! + (1 - WATER_FOLLOWS_YEAR) * sky.temperature.surfaceTemperature[cell]!;
      },
      daylightAt: (x, y) => daylightAt(calendar.moment, placeOf(world.grid, world.seed, { x, y })).daylight,
    };
    const shoals = new Fish(world, world.seed, fauna);
    shoals.populate(waters);
    shoals.measure();
    people.catchFish = (x, y) => shoals.take(x, y, ANGLE_REACH_TILES);
    people.findFish = (x, y) => shoals.nearestFresh(x, y, FISH_SEEK_TILES);
    return {
      provides: [provide(FISH_SIM, shoals), provide(WATERS, waters)],
      update: ({ scaled }) => {
        if (scaled > 0) shoals.update(scaled, scaled / DAY_SECONDS, waters);
      },
    };
  },
});

export const fishModule = defineModule('fish', [fish], { order: 130, heavy: true });
