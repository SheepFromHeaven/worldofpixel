import { CALENDAR, WORLD } from '../../sim/capabilities.ts';
import { FAUNA, FAUNA_CLIMATE, FAUNA_GROUPS } from './api.ts';
import { FISH_SIM, WATERS } from '../fish/api.ts';
import { SKY } from '../weather/api.ts';
import { DAY_SECONDS } from '../../sim/calendar.ts';
import type { Calendar } from '../../sim/calendar.ts';
import { DEFAULT_TUNING, Fauna } from './fauna.ts';
import type { FaunaWeather } from './fauna.ts';
import { PATCH_TILES } from './life.ts';
import { provide, system } from '../../sim/kernel/kernel.ts';
import type { Sky } from '../weather/api.ts';
import { seasonalTemperatureSwing, yearlyTemperatureCycle } from '../weather/api.ts';
import { clampBetween } from '../weather/api.ts';
import type { World } from '../../sim/world.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const CLIMATE_SECONDS = 2;
const SPIN_UP_SWEEPS = 8;
const SPIN_UP_DAYS = 0.25;

function climateFor(world: World, sky: Sky, calendar: Calendar, fauna: Fauna): { weather: FaunaWeather; refresh: () => void } {
  const { columns, count } = fauna.patches;
  const cellOf = new Int32Array(count);
  for (let patch = 0; patch < count; patch += 1) {
    const column = Math.min(world.grid.columns - 1, (patch % columns) * PATCH_TILES + PATCH_TILES / 2);
    const row = Math.min(world.grid.rows - 1, Math.floor(patch / columns) * PATCH_TILES + PATCH_TILES / 2);
    cellOf[patch] = sky.cellContainingTile(column, row);
  }
  const celsius = new Float32Array(sky.temperature.surfaceTemperature.length);
  const refresh = (): void => {
    const weather = world.field.weather;
    const cycle = yearlyTemperatureCycle(calendar.seasonPhase);
    for (let cell = 0; cell < celsius.length; cell += 1) {
      celsius[cell] = weather.warmth[cell]! + cycle * seasonalTemperatureSwing(weather.latitude[cell]!, clampBetween(weather.standing[cell]!));
    }
  };
  refresh();
  return { weather: { celsius, snow: sky.groundSurface.snowCover, cellOf }, refresh };
}

const fauna = system({
  id: 'fauna',
  needs: { world: WORLD, sky: SKY, calendar: CALENDAR, groups: FAUNA_GROUPS },
  tags: ['fauna'],
  create: ({ world, sky, calendar, groups }) => {
    const web = new Fauna(world, world.seed, { ...DEFAULT_TUNING, maxStep: SPIN_UP_DAYS }, groups);
    const { weather, refresh } = climateFor(world, sky, calendar, web);
    let climateClock = 0;
    return {
      provides: [provide(FAUNA, web), provide(FAUNA_CLIMATE, weather)],
      start: (kernel) => {
        const fish = kernel.find(FISH_SIM);
        const waters = kernel.find(WATERS);
        web.populate();
        for (let sweep = 0; sweep < SPIN_UP_SWEEPS; sweep += 1) {
          if (fish && waters) fish.update(0, SPIN_UP_DAYS, waters);
          web.sweep(SPIN_UP_DAYS, weather);
        }
      },
      update: ({ seconds, scaled }) => {
        if (scaled <= 0) return;
        climateClock += seconds;
        if (climateClock >= CLIMATE_SECONDS) {
          climateClock = 0;
          refresh();
        }
        web.update(scaled / DAY_SECONDS, weather);
      },
    };
  },
});

export const faunaModule = defineModule('fauna', [fauna], { order: 140, heavy: true });
