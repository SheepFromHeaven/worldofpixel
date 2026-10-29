import { DAY_SECONDS } from '../calendar.ts';
import { MIND, PEOPLE, STRUCTURES, SURROUNDINGS, TRAILS } from '../capabilities.ts';
import { system } from '../kernel/kernel.ts';

export const burnSystem = system({
  id: 'burn',
  needs: { structures: STRUCTURES },
  create: ({ structures }) => ({ update: ({ scaled }) => structures.burn(scaled) }),
});

export const peopleSystem = system({
  id: 'people',
  needs: { people: PEOPLE, surroundings: SURROUNDINGS },
  create: ({ people, surroundings }) => ({ update: ({ scaled }) => people.update(scaled, surroundings) }),
});

export const mindSystem = system({
  id: 'mind',
  needs: { mind: MIND },
  create: ({ mind }) => ({ update: ({ scaled }) => mind.update(scaled) }),
});

export const fadeSystem = system({
  id: 'fade',
  needs: { trails: TRAILS },
  create: ({ trails }) => ({ update: ({ scaled }) => trails.fade(scaled / DAY_SECONDS) }),
});
