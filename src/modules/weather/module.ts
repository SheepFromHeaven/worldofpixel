import { AMBIENT, CALENDAR, CLOCK, WORLD } from '../../sim/capabilities.ts';
import { SKY } from './api.ts';
import { daylightAt, placeOf } from '../../sim/daylight.ts';
import { provide, system } from '../../sim/kernel/kernel.ts';
import { NOWHERE } from '../../sim/grid.ts';
import { FORCED_WEATHER_CHOICES } from './forcedWeather.ts';
import { Sky } from './sky.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const weather = system({
  id: 'weather',
  needs: { world: WORLD, calendar: CALENDAR, clock: CLOCK },
  tags: ['weather'],
  create: ({ world, calendar, clock }) => {
    const sky = new Sky(world, calendar.elapsedDays);
    const sync = (): void => {
      sky.setCalendar(calendar.timeOfDay, calendar.seasonPhase);
      sky.advanceTo(calendar.elapsedDays);
    };
    clock.onChange(sync);
    return {
      provides: [
        provide(SKY, sky),
        provide(AMBIENT, {
          temperatureAt: (tile) => sky.temperature.surfaceTemperature[sky.cellContainingTile(world.grid.columnOf(tile), world.grid.rowOf(tile))]!,
          gloomAt: (x, y) => daylightAt(calendar.moment, placeOf(world.grid, world.seed, { x, y })).gloom,
        }),
      ],
      update: sync,
      commands: {
        setForced: ({ index }: { index: number }) => {
          sky.forcedWeather = FORCED_WEATHER_CHOICES[index] ?? null;
          return true;
        },
        'use.bolt': ({ tile }: { tile: number }) => {
          if (tile === NOWHERE) return false;
          sky.lightning.strikeGroundAt(tile);
          return true;
        },
      },
    };
  },
});

export const weatherModule = defineModule('weather', [weather], { order: 270 });
