import { PEOPLE } from '../capabilities.ts';
import { system } from '../kernel/kernel.ts';
import type { Offer, Offers } from '../offers.ts';
import { ITEM_NAMES } from '../people/items.ts';
import type { ItemType } from '../people/items.ts';
import { NOBODY } from '../people/people.ts';
import type { EmitterSource } from '../sources/emitters.ts';
import { BURNING_BRANCH, LYING_IDS } from '../sources/emitters.ts';
import { defineModule } from './module.ts';

const titled = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export const itemVerbs = system({
  id: 'items',
  needs: { people: PEOPLE },
  create: ({ people }) => ({
    commands: {
      pickUp: ({ tile, item }: { tile: number; item: ItemType }) => {
        const who = people.pickerFor(tile);
        if (who !== NOBODY) people.sendToPick(who, tile, item);
        return true;
      },
      bringHere: ({ tile }: { tile: number }) => {
        const who = people.carrierFor(tile);
        if (who !== NOBODY) people.sendToBring(who, tile);
        return true;
      },
    },
  }),
});

const offers: Offers = ({ world, people }, tile) => {
  const out: Offer[] = [];
  const here = world.tile(tile);
  for (const item of world.items.kindsAt(tile)) {
    out.push({ label: `Pick Up ${titled(ITEM_NAMES[item] ?? 'item')}`, reason: people.pickerFor(tile) === NOBODY ? 'hands are full' : null, command: { kind: 'pickUp', tile, item } });
  }
  const carrier = people.carrierFor(tile);
  if (carrier !== NOBODY) {
    const held = people.heldItemType[carrier]! as ItemType;
    const reason = !here.passable
      ? 'cannot stand here'
      : world.structures.isStorage(tile) && !world.structures.storageAccepts(tile, held)
        ? 'storage holds something else'
        : world.structures.isFloor(tile) && world.structures.floorSpace(tile) === 0
          ? 'the floor is full'
          : null;
    out.push({ label: 'Bring Here', reason, command: { kind: 'bringHere', tile } });
  }
  return out;
};

const lying: EmitterSource = (world, _people, out) => {
  for (const tile of world.items.burningTiles()) {
    const at = world.grid.centre(tile);
    out.push({ id: LYING_IDS + tile, kind: BURNING_BRANCH, x: at.x, y: at.y, level: 1 });
  }
};

export const itemsModule = defineModule('items', [itemVerbs], { offers: [offers], emitters: [lying] });
