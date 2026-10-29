import { CALENDAR, PEOPLE, SKY, WORLD } from '../capabilities.ts';
import { daylightAt, placeOf } from '../daylight.ts';
import { capability, provide, system } from '../kernel/kernel.ts';
import { thoughtsFor } from '../people/thoughts.ts';
import type { Thought } from '../people/thoughts.ts';
import { defineModule } from './module.ts';

const THOUGHT_SECONDS = 0.5;

export const THOUGHTS = capability<{ all: Thought[][]; revision: number }>('thoughts');

const thoughts = system({
  id: 'thoughts',
  needs: { world: WORLD, calendar: CALENDAR, sky: SKY, people: PEOPLE },
  create: ({ world, calendar, sky, people }) => {
    const state: { all: Thought[][]; revision: number } = { all: [], revision: 0 };
    let clock = 0;
    const rethink = (): void => {
      state.revision += 1;
      state.all = [];
      for (let person = 0; person < people.count; person += 1) {
        const x = people.posX[person]!;
        const y = people.posY[person]!;
        const cell = sky.cellContainingTile(world.grid.column(x), world.grid.row(y));
        state.all.push(
          thoughtsFor(people, person, {
            rain: sky.precipitation.rain[cell]!,
            snow: sky.precipitation.snowfall[cell]!,
            gloom: daylightAt(calendar.moment, placeOf(world.grid, world.seed, { x, y })).gloom,
          }),
        );
      }
    };
    return {
      provides: [provide(THOUGHTS, state)],
      update: ({ seconds }) => {
        clock -= seconds;
        if (clock > 0) return;
        clock = THOUGHT_SECONDS;
        rethink();
      },
    };
  },
});

export const thoughtsModule = defineModule('thoughts', [thoughts]);
