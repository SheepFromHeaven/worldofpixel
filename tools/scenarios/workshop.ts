import { buildableIdOf } from '../../src/content/buildables.ts';
import { ItemType } from '../../src/modules/items/api.ts';
import { NEURON_COUNT, neuronIndex } from '../../src/modules/mind/api.ts';
import { Run } from './harness.ts';
import type { Scenario } from './harness.ts';

export const sorting: Scenario = {
  name: 'sorting',
  summary: 'a storage that refuses stone takes the branch and leaves the stone for another storage, and a branch refused later is carried out to a third that takes only branches',
  start: () =>
    Run.stage({
      humans: [[0, 0]],
      items: [
        [4, 0, ItemType.Stone],
        [4, 2, ItemType.Branch],
      ],
    }),
  run(run) {
    const { structures, items } = run.world;
    const here = run.tile(-3, 0);
    const there = run.tile(-3, 4);
    structures.place(here, buildableIdOf('storage'));
    run.apply({ kind: 'allowStorage', tile: here, item: ItemType.Stone, allowed: false });
    run.expect('stone is refused', !structures.allows(here, ItemType.Stone) && structures.allows(here, ItemType.Branch));
    run.until('the branch is stored', () => items.tally(here, ItemType.Branch) === 1, 600);
    run.advance(120);
    run.expect('the stone is left lying', items.tally(here, ItemType.Stone) === 0 && items.tally(run.tile(4, 0), ItemType.Stone) === 1);
    structures.place(there, buildableIdOf('storage'));
    run.until('the stone goes to a storage that allows it', () => items.tally(there, ItemType.Stone) === 1, 600);
    const third = run.tile(-6, 2);
    for (const slot of [...items.at(third)].reverse()) items.remove(slot);
    structures.place(third, buildableIdOf('storage'));
    for (const kind of Object.values(ItemType)) if (kind !== ItemType.Branch) run.apply({ kind: 'allowStorage', tile: third, item: kind, allowed: false });
    run.apply({ kind: 'allowStorage', tile: here, item: ItemType.Branch, allowed: false });
    run.until('a branch refused after it was stored is moved out', () => items.tally(here, ItemType.Branch) === 0 && items.tally(third, ItemType.Branch) >= 1, 900);
    const saved = structures.snapshot();
    const kept = saved.refused?.find(([tile]) => tile === here)?.[1] ?? [];
    run.expect('the filter is saved', JSON.stringify(kept) === JSON.stringify([ItemType.Stone, ItemType.Branch]), JSON.stringify(kept));
  },
};

export const queue: Scenario = {
  name: 'queue',
  summary: 'three hand axes queued on a knapping floor are made one after another, and the order is not on the radial menu',
  start: () =>
    Run.stage({
      humans: [[0, 0]],
      items: [
        [2, 2, ItemType.Flint, 3],
        [2, 3, ItemType.Stone, 3],
        [3, 2, ItemType.Branch, 3],
        [3, 3, ItemType.PlantFibre, 3],
      ],
    }),
  run(run) {
    for (let neuron = 0; neuron < NEURON_COUNT; neuron += 1) run.mind.learn(neuron, 0);
    const floor = run.tile(-2, -2);
    run.world.structures.place(floor, buildableIdOf('knappingFloor'));
    run.expect('the wheel has no knapping order', !run.labels(floor).some((label) => label === 'Knap Hand Axe'), run.labels(floor).join(', '));
    const tool = neuronIndex('tool');
    for (let order = 0; order < 3; order += 1) run.apply({ kind: 'order', tile: floor, result: tool });
    const queued = (): number => run.mind.view().hypotheses.filter((hypothesis) => hypothesis.order && hypothesis.tile === floor).length;
    run.expect('three are queued', queued() === 3, `${queued()}`);
    let most = 0;
    const axes = (): number => {
      let count = 0;
      for (let slot = 0; slot < run.world.items.used; slot += 1) if (run.world.items.kind[slot] === ItemType.HandAxe) count += 1;
      for (let person = 0; person < run.people.count; person += 1) if (run.people.heldItemType[person] === ItemType.HandAxe) count += 1;
      return count;
    };
    run.until('three axes are made', () => axes() >= 3, 2400, () => {
      most = Math.max(most, run.mind.view().hypotheses.filter((hypothesis) => hypothesis.order && hypothesis.tryer >= 0).length);
    });
    run.expect('one at a time', most === 1, `${most} at once`);
    run.expect('the queue is empty', queued() === 0, `${queued()}`);
  },
};
