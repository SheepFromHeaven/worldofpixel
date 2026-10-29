import { CALENDAR, FAUNA, FISH, PEOPLE, SKY, WATERS, WORLD } from '../capabilities.ts';
import { DAY_SECONDS } from '../calendar.ts';
import { daylightAt, placeOf } from '../daylight.ts';
import { Fish } from '../fish/fish.ts';
import type { FishEnvironment } from '../fish/fish.ts';
import { provide, system } from '../kernel/kernel.ts';
import { defineModule } from './module.ts';

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
      provides: [provide(FISH, shoals), provide(WATERS, waters)],
      update: ({ scaled }) => {
        if (scaled > 0) shoals.update(scaled, scaled / DAY_SECONDS, waters);
      },
    };
  },
});

export const fishModule = defineModule('fish', [fish]);
