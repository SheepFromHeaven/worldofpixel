import { STRUCTURES } from '../capabilities.ts';
import { system } from '../kernel/kernel.ts';
import type { Offer, Offers } from '../offers.ts';
import { standable } from '../offers.ts';
import { defineModule } from './module.ts';

export const storageVerbs = system({
  id: 'storage',
  needs: { structures: STRUCTURES },
  create: ({ structures }) => ({
    commands: {
      designateStorage: ({ tile }: { tile: number }) => (structures.designate(tile), true),
      clearStorage: ({ tile }: { tile: number }) => (structures.release(tile), true),
      layFloor: ({ tile }: { tile: number }) => (structures.layFloor(tile), true),
      clearFloor: ({ tile }: { tile: number }) => (structures.unfloor(tile), true),
    },
  }),
});

const offers: Offers = (context, tile) => {
  const { world } = context;
  const out: Offer[] = [];
  if (world.structures.isStorage(tile)) out.push({ label: 'Clear Storage', reason: null, command: { kind: 'clearStorage', tile } });
  else if (world.structures.isFloor(tile)) out.push({ label: 'Clear Knapping Floor', reason: null, command: { kind: 'clearFloor', tile } });
  else {
    out.push({ label: 'Storage', reason: standable(context, tile), command: { kind: 'designateStorage', tile }, group: 'erect' });
    if (context.knows('tool')) out.push({ label: 'Knapping Floor', reason: standable(context, tile), command: { kind: 'layFloor', tile }, group: 'erect', earned: true });
  }
  return out;
};

export const storageModule = defineModule('storage', [storageVerbs], { offers: [offers] });
