import { CALENDAR, CLOCK, EVENTS, PEOPLE, TRIAL, WORLD } from '../capabilities.ts';
import { commitTrial } from '../commands.ts';
import type { TrialOutcome } from '../discovery/trial.ts';
import { provide, system } from '../kernel/kernel.ts';
import type { ItemType } from '../people/items.ts';
import { defineModule } from './module.ts';

const discovery = system({
  id: 'discovery',
  needs: { world: WORLD, people: PEOPLE, clock: CLOCK, calendar: CALENDAR, events: EVENTS },
  create: ({ world, people, clock, calendar, events }) => {
    const trial = { open: false };
    people.subscribe((event) => {
      if (event.kind !== 'trial' || trial.open) return;
      const { items } = world;
      const kinds = items.at(event.tile).map((slot) => items.kind[slot]! as ItemType);
      trial.open = true;
      clock.hold();
      events.emit({ kind: 'trial', person: event.person, tile: event.tile, items: kinds, seed: world.seed ^ Math.floor(calendar.elapsedDays * 1e4) });
    });
    return {
      provides: [provide(TRIAL, trial)],
      commands: {
        commitTrial: ({ person, outcome }: { person: number; outcome: TrialOutcome }) => {
          commitTrial(world, people, person, outcome);
          trial.open = false;
          clock.release();
          return true;
        },
      },
    };
  },
});

export const discoveryModule = defineModule('discovery', [discovery]);
