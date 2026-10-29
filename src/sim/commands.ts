import type { TrialOutcome } from './discovery/trial.ts';
import type { People } from './people/people.ts';
import type { World } from './world.ts';

export function commitTrial(world: World, people: People, person: number, outcome: TrialOutcome): void {
  const { items } = world;
  for (const slot of [...items.at(outcome.tile)]) items.remove(slot);
  for (const kind of outcome.kept) items.add(outcome.tile, kind);
  if (outcome.axe) people.knowledge.hasDiscoveredFlintKnapping = true;
  people.endTrial(person);
}
