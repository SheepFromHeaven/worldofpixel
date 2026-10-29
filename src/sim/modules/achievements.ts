import { Achievements } from '../achievements.ts';
import { ACHIEVEMENTS, EVENTS, MODE, PEOPLE, SAVED, SPOT, WORLD } from '../capabilities.ts';
import { provide, system } from '../kernel/kernel.ts';
import { defineModule } from './module.ts';

const OPENED_CONFINE_TILES = 24;

const achievements = system({
  id: 'achievements',
  needs: { world: WORLD, people: PEOPLE, spot: SPOT, mode: MODE, saved: SAVED, events: EVENTS },
  create: ({ world, people, spot, mode, saved, events }) => {
    const earned = new Achievements();
    const widen = (): void => {
      if (mode !== 'discover') world.movement.confine(world.grid.atPoint(spot), OPENED_CONFINE_TILES);
    };
    earned.subscribe((achievement) => {
      widen();
      events.emit({ kind: 'achievement', achievement });
    });
    if (saved) {
      earned.restore(saved.achievements);
      if (mode === 'settle' && earned.has('fire')) widen();
    }
    return {
      provides: [provide(ACHIEVEMENTS, earned)],
      save: () => ({ achievements: [...earned.ids] }),
      update: () => earned.check(people),
    };
  },
});

export const achievementsModule = defineModule('achievements', [achievements]);
