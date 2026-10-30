import { PEOPLE } from '../people/api.ts';
import { WORLD } from '../../sim/capabilities.ts';
import { provide, system } from '../../sim/kernel/kernel.ts';
import { ITEMS } from './api.ts';
import './layer.ts';
import type { Offer, Offers } from '../../sim/offers.ts';
import { ITEM_NAMES } from './items.ts';
import type { ItemType } from './items.ts';
import { NOBODY } from '../people/api.ts';
import type { EmitterSource } from '../fire/api.ts';
import { BURNING_BRANCH, LYING_IDS } from '../fire/api.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const titled = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const itemStore = system({
  id: 'itemStore',
  needs: { world: WORLD },
  create: ({ world }) => ({ provides: [provide(ITEMS, world.items)] }),
});

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

export const itemsModule = defineModule('items', [itemStore, itemVerbs], { order: 80, stage: true, offers: [offers], emitters: [lying] });
