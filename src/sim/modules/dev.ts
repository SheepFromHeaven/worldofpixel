import { CALENDAR, FAUNA as FAUNA_STOCK, WORLD } from '../capabilities.ts';
import { DAY_SECONDS } from '../calendar.ts';
import { LIVES, LIFE_COUNT, STAGES } from '../fauna/life.ts';
import { system } from '../kernel/kernel.ts';
import type { Kernel, Tick } from '../kernel/kernel.ts';
import { speciesOf } from '../plants/species.ts';
import { defineModule } from './module.ts';

const NATURE = 'nature';
const WEATHER = 'weather';
const FAUNA = 'fauna';
const FAST_STEP_DAYS = 0.25;
const YEAR_DAYS = 32;

export interface Census {
  plants: Record<string, number>;
  animals: Record<string, number>;
}

const matches = (key: string, filter: string): boolean => filter === '' || key.includes(filter);

const dev = system({
  id: 'dev',
  needs: { world: WORLD, calendar: CALENDAR },
  create: ({ world, calendar }) => ({
    commands: {
      simulate: ({ years = 1, step, fast = 0, fauna = 0, weather = 0 }: { years?: number; step?: number; fast?: number; fauna?: number; weather?: number }, kernel: Kernel): { days: number; step: number } => {
        const days = step ?? (fast ? FAST_STEP_DAYS : world.plants.faithfulStepDays());
        const tick: Tick = { seconds: days * DAY_SECONDS, scaled: days * DAY_SECONDS };
        const steps = Math.ceil((years * YEAR_DAYS) / days);
        for (let step = 0; step < steps; step += 1) {
          kernel.update(tick, NATURE);
          if (fauna) kernel.update(tick, FAUNA);
          if (weather) kernel.update(tick, WEATHER);
        }
        return { days: calendar.elapsedDays, step: days };
      },
      census: ({ match = '' }: { match?: string }, kernel: Kernel): Census => {
        const plants: Record<string, number> = {};
        const { canopy, under, herb } = world.plants;
        for (const layer of [canopy, under, herb]) {
          for (let tile = 0; tile < layer.length; tile += 1) {
            const species = speciesOf(layer[tile]!);
            if (species && matches(species.key, match)) plants[species.key] = (plants[species.key] ?? 0) + 1;
          }
        }
        const animals: Record<string, number> = {};
        const fauna = kernel.find(FAUNA_STOCK);
        if (fauna) {
          const patches = fauna.stock.length / (LIFE_COUNT * STAGES);
          for (const life of LIVES) {
            if (!matches(life.key, match)) continue;
            let adults = 0;
            for (let patch = 0; patch < patches; patch += 1) adults += fauna.stock[(patch * LIFE_COUNT + life.index) * STAGES + (STAGES - 1)]!;
            if (adults >= 0.5) animals[life.key] = Math.round(adults);
          }
        }
        return { plants, animals };
      },
    },
  }),
});

export const devModule = defineModule('dev', [dev]);
