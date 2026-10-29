import type { Vec2 } from '../geometry.ts';
import { MIND, PEOPLE, WORLD } from '../capabilities.ts';
import { provide, system } from '../kernel/kernel.ts';
import { Mind } from '../mind/mind.ts';
import { People, POPULATION } from '../people/people.ts';
import { defineModule } from './module.ts';

const IDLE_START_SECONDS = 4;

export interface Placed {
  at: Vec2;
  heading: number;
}

export const stageModule = (humans: readonly Placed[], onTrial: (person: number, tile: number) => void) =>
  defineModule('stage', [
    system({
      id: 'stageFolk',
      needs: { world: WORLD },
      create: ({ world }) => {
        const people = new People(world, null, Math.min(POPULATION, humans.length));
        humans.slice(0, people.count).forEach(({ at, heading }, person) => {
          people.posX[person] = at.x;
          people.posY[person] = at.y;
          people.targetX[person] = at.x;
          people.targetY[person] = at.y;
          people.heading[person] = heading;
          people.timer[person] = IDLE_START_SECONDS;
        });
        const mind = new Mind(people);
        people.mind = mind;
        people.knowledge.hasDiscoveredFire = true;
        people.knowledge.hasDiscoveredFlintKnapping = true;
        people.subscribe((event) => {
          if (event.kind === 'trial') onTrial(event.person, event.tile);
        });
        return { provides: [provide(PEOPLE, people), provide(MIND, mind)] };
      },
    }),
  ]);
