import { PEOPLE } from '../people/api.ts';
import { system } from '../../sim/kernel/kernel.ts';
import type { Offer, Offers } from '../../sim/offers.ts';
import { NOBODY } from '../people/api.ts';
import { Cover } from '../../sim/world.ts';
import { defineModule } from '../../sim/kernel/module.ts';

export const labourVerbs = system({
  id: 'labour',
  needs: { people: PEOPLE },
  create: ({ people }) => ({
    commands: {
      chopWood: ({ tile }: { tile: number }) => {
        const who = people.chopperFor(tile);
        if (who !== NOBODY) people.sendToChop(who, tile);
        return true;
      },
      gather: ({ on }: { on: boolean }) => (people.setGathering(on), true),
      angle: ({ on }: { on: boolean }) => (people.setAngling(on), true),
    },
  }),
});

const offers: Offers = ({ world, people, knows }, tile) => {
  const out: Offer[] = [];
  if (people.knowledge.hasDiscoveredFlintKnapping && world.tile(tile).cover === Cover.Tree) {
    out.push({ label: 'Chop Wood', reason: people.chopperFor(tile) === NOBODY ? 'needs an axe in hand' : null, command: { kind: 'chopWood', tile } });
  }
  const needsStorage = world.structures.storageTiles.length === 0 ? 'needs a storage' : null;
  const gathering = people.gathering[0] === 1;
  const angling = people.angling[0] === 1;
  if (knows('basket')) out.push({ label: gathering ? 'Stop Gathering' : 'Gather Food', reason: needsStorage, command: { kind: 'gather', on: !gathering }, group: 'orders' });
  if (knows('spear')) out.push({ label: angling ? 'Stop Fishing' : 'Go Fishing', reason: needsStorage, command: { kind: 'angle', on: !angling }, group: 'orders' });
  return out;
};

export const labourModule = defineModule('labour', [labourVerbs], { order: 100, stage: true, offers: [offers] });
