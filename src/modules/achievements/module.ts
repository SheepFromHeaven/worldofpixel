import { Achievements } from './achievements.ts';
import { EVENTS, MODE, SAVED, SPOT, WORLD } from '../../sim/capabilities.ts';
import { EARNED } from './api.ts';
import { PEOPLE } from '../people/api.ts';
import { FRONTIER } from '../../sim/frontier.ts';
import { provide, system } from '../../sim/kernel/kernel.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const achievements = system({
  id: 'achievements',
  needs: { world: WORLD, people: PEOPLE, spot: SPOT, mode: MODE, saved: SAVED, events: EVENTS },
  create: ({ world, people, spot, mode, saved, events }) => {
    const earned = new Achievements();
    const widen = (): void => {
      if (mode !== 'discover') world.movement.confine(world.grid.atPoint(spot), FRONTIER.walkersOpened);
    };
    earned.subscribe((achievement) => {
      if (achievement.id === 'fire') widen();
      events.emit({ kind: 'achievement', achievement });
    });
    if (saved) {
      earned.restore(saved.achievements);
      if (mode === 'settle' && earned.has('fire')) widen();
    }
    return {
      provides: [provide(EARNED, earned)],
      save: () => ({ achievements: [...earned.ids] }),
      update: () => earned.check(people),
    };
  },
});

export const achievementsModule = defineModule('achievements', [achievements], { order: 200 });
