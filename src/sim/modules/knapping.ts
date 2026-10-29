import { PEOPLE } from '../capabilities.ts';
import { system } from '../kernel/kernel.ts';
import { NOBODY } from '../people/people.ts';
import { defineModule } from './module.ts';

const knapping = system({
  id: 'knapping',
  needs: { people: PEOPLE },
  create: ({ people }) => ({
    commands: {
      experiment: ({ tile }: { tile: number }) => {
        const who = people.knapperFor(tile);
        if (who !== NOBODY) people.sendToKnap(who, tile);
        return true;
      },
    },
  }),
});

export const knappingModule = defineModule('knapping', [knapping]);
