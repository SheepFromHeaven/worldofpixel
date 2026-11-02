import { hash2 } from '../../sim/rng.ts';
import { TEXEL } from '../../render/terrainPixels.ts';
import type { Drawable } from '../clientSlots.ts';
import { drawnAsModel, humanPose } from '../people/api.ts';
import { ITEM_ART, ItemType, stackStage } from './items.ts';

const KIND_SLOTS = 8;

const SHARED_TILE_OFFSETS: readonly (readonly [number, number])[] = [
  [-3, -3],
  [3, 3],
  [3, -3],
  [-3, 3],
];

const LYING_TORCH_HEAD = [3.1, 1.3] as const;

export const piles: Drawable = {
  id: 'items',
  order: 0,
  draw(world, people, stamp) {
    const { items, grid } = world;
    const counts = new Map<number, number>();
    const kindsOn = new Map<number, number>();
    for (let slot = 0; slot < items.used; slot += 1) {
      const kind = items.kind[slot]!;
      if (kind === ItemType.None) continue;
      const key = items.tile[slot]! * KIND_SLOTS + kind;
      const before = counts.get(key) ?? 0;
      counts.set(key, before + 1);
      if (before === 0) kindsOn.set(items.tile[slot]!, (kindsOn.get(items.tile[slot]!) ?? 0) + 1);
    }

    for (let person = 0; person < people.count; person += 1) {
      if (!drawnAsModel(people, person) || humanPose(people, person).item === ItemType.None || people.heldItemType[person] !== ItemType.None) continue;
      const key = people.taskTile[person]! * KIND_SLOTS + people.taskItem[person]!;
      const left = (counts.get(key) ?? 0) - 1;
      if (left > 0) counts.set(key, left);
      else counts.delete(key);
    }

    const placed = new Map<number, number>();
    for (const [key, count] of counts) {
      const tile = Math.floor(key / KIND_SLOTS);
      const kind = key % KIND_SLOTS;
      const at = grid.centre(tile);
      if (!stamp.seen(at.x, at.y)) continue;

      const name = `item.${ITEM_ART[kind]}.s${stackStage(count)}`;
      const height = stamp.height(name);
      if (height === undefined) continue;
      const order = placed.get(tile) ?? 0;
      placed.set(tile, order + 1);
      const apart = (kindsOn.get(tile) ?? 1) > 1 ? SHARED_TILE_OFFSETS[order % SHARED_TILE_OFFSETS.length]! : ([0, 0] as const);
      const x = at.x + apart[0] * TEXEL;
      const y = at.y + apart[1] * TEXEL;
      const torch = (kind === ItemType.Torch || kind === ItemType.BurningBranch) && count === 1;
      stamp.place(name, x, y, torch ? false : hash2(tile, kind, 9) > 0.5, { rimmed: true });
      if (torch) stamp.flame(x, y, LYING_TORCH_HEAD[0], LYING_TORCH_HEAD[1], height);
    }
  },
};
