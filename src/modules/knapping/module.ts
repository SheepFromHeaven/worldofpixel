import { PEOPLE } from '../people/api.ts';
import { system } from '../../sim/kernel/kernel.ts';
import { NOBODY } from '../people/api.ts';
import { defineModule } from '../../sim/kernel/module.ts';

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

export const knappingModule = defineModule('knapping', [knapping], { order: 230, stage: true });
