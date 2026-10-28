import type { People } from '../../sim/people/people.ts';
import { EntityState } from '../../sim/people/people.ts';

const GROUND_WORK: ReadonlySet<number> = new Set([
  EntityState.ExperimentingKnapping,
  EntityState.Chopping,
  EntityState.Drinking,
  EntityState.PickingUp,
  EntityState.Lighting,
  EntityState.Planting,
  EntityState.Feeding,
  EntityState.Foraging,
]);

export const drawnAsModel = (people: People, person: number): boolean => !people.isLying(person) && !GROUND_WORK.has(people.state[person]!);
