import { MODE, WORLD } from '../../sim/capabilities.ts';
import { STRUCTURES } from '../construction/api.ts';
import { PEOPLE } from '../people/api.ts';
import { Cave } from '../../sim/geology/caves.ts';
import { geologyOf } from '../../sim/geology/geology.ts';
import { system } from '../../sim/kernel/kernel.ts';
import type { Offer, Offers } from '../../sim/offers.ts';
import { NOBODY } from '../people/api.ts';
import { FUEL_CAPACITY } from './sources/fuel.ts';
import { burnSystem } from '../../sim/kernel/systems.ts';
import { defineModule } from '../../sim/kernel/module.ts';

export const fireVerbs = system({
  id: 'hearth',
  needs: { world: WORLD, structures: STRUCTURES, people: PEOPLE, mode: MODE },
  create: ({ world, structures, people, mode }) => ({
    commands: {
      addFuel: ({ tile }: { tile: number }) => {
        const who = people.feederFor(tile);
        if (who !== NOBODY) people.sendToFeed(who, tile);
        return true;
      },
      lightTorch: ({ tile }: { tile: number }) => {
        const who = people.lighterFor(tile);
        if (who !== NOBODY) people.sendToLight(who, tile);
        return true;
      },
      roast: ({ tile }: { tile: number }) => {
        const who = people.roasterFor(tile);
        if (who !== NOBODY) people.sendToRoast(who, tile);
        return true;
      },
      plantTorch: ({ tile }: { tile: number }) => {
        if (mode === 'discover') {
          structures.plant(tile);
          return true;
        }
        const who = people.planterFor(tile);
        if (who !== NOBODY) people.sendToPlant(who, tile);
        return true;
      },
      plantDeepTorch: ({ tile, elevation }: { tile: number; elevation: number }) => {
        const { x, y } = world.grid.centre(tile);
        const here = geologyOf(world).sample(x, y, elevation, { rock: 0, mineral: 0, cave: 0, above: 0, life: 0 });
        if (here.cave === Cave.Open || here.cave === Cave.Dripstone) structures.plant(tile, elevation);
        return true;
      },
    },
  }),
});

const offers: Offers = (context, tile) => {
  const { world, people } = context;
  const out: Offer[] = [];
  if (world.structures.isFire(tile)) {
    const fuelled = people.feederFor(tile) !== NOBODY;
    out.push({ label: 'Add Fuel', reason: !fuelled ? 'needs a branch or kindling in hand' : world.structures.fuelAt(tile) >= FUEL_CAPACITY ? 'it is full' : null, command: { kind: 'addFuel', tile } });
    out.push({ label: 'Light Torch', reason: people.lighterFor(tile) === NOBODY ? 'needs a branch in hand' : null, command: { kind: 'lightTorch', tile } });
    if (context.knows('cooked')) out.push({ label: 'Roast Food', reason: people.roasterFor(tile) === NOBODY ? 'needs raw food in hand or lying about' : null, command: { kind: 'roast', tile } });
  }
  if (context.depth > 0) {
    const reason = world.structures.isDeepTorch(tile) ? 'a torch is already here' : context.deepCaveAt(tile) ? null : 'needs open cave air';
    out.push({ label: 'Place Torch', reason, command: { kind: 'plantDeepTorch', tile, elevation: context.plane } });
  } else if (context.mode === 'discover' || people.planterFor(tile) !== NOBODY) {
    out.push({ label: 'Torch', reason: world.structures.plantable(tile) ? null : 'cannot stand a torch here', command: { kind: 'plantTorch', tile }, group: 'erect' });
  }
  return out;
};

export const fireModule = defineModule('fire', [burnSystem, fireVerbs], { order: 30, stage: true, offers: [offers] });
