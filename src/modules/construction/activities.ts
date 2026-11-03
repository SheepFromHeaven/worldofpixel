import { NOWHERE } from '../../sim/grid.ts';
import { Blueprint } from './structures.ts';
import { isBuildPlan } from '../../content/buildables.ts';
import { ItemType } from '../items/api.ts';
import { registerActivity } from '../people/api.ts';
import { arriveLabour, beginLabour, beginPlanned, finishCampfire, finishLabour, finishRelight, missing, nextBuildStep } from './build.ts';
import { EntityState, Task } from '../people/api.ts';

registerActivity({
  id: 'build',
  rest: { priority: 80, choose: (people, person, { sheltering }) => !sheltering && beginPlanned(people, person) },
  pickedUp: { priority: 10, run: (people, person) => people.buildTile[person] !== NOWHERE && nextBuildStep(people, person) },
  carried: {
    before: (people, person, here) => {
      const goal = people.buildTile[person]!;
      if (!(goal !== NOWHERE && here === goal && people.heldItemType[person] === ItemType.BurningBranch)) return false;
      finishCampfire(people, person, goal);
      return true;
    },
    after: (people, person, here) => {
      const { structures } = people.world;
      const goal = people.buildTile[person]!;
      if (goal !== NOWHERE && here === goal && (structures.plan[goal] === Blueprint.Relight || structures.plan[goal] === Blueprint.Kindle) && missing(people, goal) === ItemType.None) {
        finishRelight(people, person, goal);
        return true;
      }
      if (goal !== NOWHERE && here === goal && isBuildPlan(structures.plan[goal]!) && missing(people, goal) === ItemType.None) {
        beginLabour(people, person, goal, here);
        return true;
      }
      return goal !== NOWHERE && nextBuildStep(people, person);
    },
  },
});

registerActivity({
  id: 'labour',
  busy: [EntityState.Labouring],
  arrives: { task: Task.Labour, begin: arriveLabour },
  finishes: { state: EntityState.Labouring, finish: finishLabour },
});
