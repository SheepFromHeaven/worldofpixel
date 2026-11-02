import { TEXEL } from '../../render/terrainPixels.ts';
import { HELD_LIFT_TEXELS, TREE_VIEW } from '../../render/lit/treeView.ts';
import type { Drawable } from '../clientSlots.ts';
import { ITEM_ART, ItemType } from '../items/api.ts';
import { EntityState } from './states.ts';
import { STRIKE_INTERVAL, Task } from './tuning.ts';
import { bodyScale, drawnAsModel, handSpot, humanPose } from './pose.ts';

const PEOPLE_NAMES: readonly string[] = ['adam', 'eve'];

const HELD_TORCH_HEAD = [3.25, 1] as const;

const HAND_REACH_TEXELS: Record<string, number> = { stand: 4, walk2: 3, walk1: 3, walk0: 3, walkM1: 3, walkM2: 3, kneel: 7, reach: 8, lie: 2 };

const SPARK_SECONDS = 0.25;

const SPARK_ANGLES = [0.3, 1.5, 2.6, 3.9, 5.2];

const BREATH_BELOW_CELSIUS = 8;

const BREATH_PERIOD_SECONDS = 3.2;

const BREATH_SECONDS = 1.2;

const BREATH_FRAMES = 3;

const BREATH_MOUTH_TEXELS = 3.5;

const BREATH_DRIFT_TEXELS = 5;

const BREATH_RISE_TEXELS = 3;

const SHIVER_BEAT = 8;

const COLD_SHIVER = 35.6;

const GAIT: readonly string[] = ['walk2', 'walk1', 'walk0', 'walkM1', 'walkM2', 'walkM1', 'walk0', 'walk1'];

const STRIDE_PER_FRAME = 0.11;

const RAISE_HELD_TEXELS = 2;

const HAND_SORT_BIAS = 0.06;

export const folk: Drawable = {
  id: 'people',
  order: 100,
  draw(_world, people, stamp) {
    const sparks = stamp.has('marker.spark');
    for (let person = 0; person < people.count; person += 1) {
      const state = people.state[person]!;
      const heading = people.heading[person]!;
      const across = Math.abs(Math.cos(heading)) >= Math.abs(Math.sin(heading));
      const west = across && Math.cos(heading) < 0;
      const facing = across ? 'e' : Math.sin(heading) > 0 ? 's' : 'n';
      const forwardX = across ? (west ? -1 : 1) : 0;
      const forwardY = across ? 0 : facing === 's' ? 1 : -1;

      const kneeling = state === EntityState.ExperimentingKnapping || state === EntityState.Chopping || state === EntityState.Drinking || state === EntityState.Wondering || state === EntityState.Fishing || (state === EntityState.Foraging && people.task[person] === Task.Scavenge);
      const pose = people.isLying(person)
        ? 'lie'
        : kneeling
          ? 'kneel'
          : state === EntityState.PickingUp || state === EntityState.Lighting || state === EntityState.Planting || state === EntityState.Feeding || state === EntityState.Foraging || state === EntityState.Roasting
            ? 'reach'
            : people.moveSpeed[person]! > 0
              ? GAIT[Math.floor(people.stride[person]! / STRIDE_PER_FRAME) % GAIT.length]!
              : 'stand';

      const name = `person.${PEOPLE_NAMES[people.female[person]!]}.${pose}.${facing}`;
      const height = stamp.height(name);
      if (height === undefined) continue;

      const shiver = people.bodyTemp[person]! < COLD_SHIVER ? (Math.floor(stamp.time * SHIVER_BEAT + person) % 2 === 0 ? 1 : -1) * TEXEL : 0;
      const x = people.posX[person]! + shiver;
      const y = people.posY[person]!;
      if (!stamp.seen(x, y)) continue;
      const model = drawnAsModel(people, person);
      if (!model) stamp.flat(name, x, y, { flip: west });

      const hands = model ? humanPose(people, person) : null;
      const held = hands ? hands.item : people.heldItemType[person]!;
      const carriedName = `item.${ITEM_ART[held]}.held`;
      const reach = (HAND_REACH_TEXELS[pose] ?? 4) * TEXEL;
      const above = height + RAISE_HELD_TEXELS;
      if (held !== ItemType.None && stamp.has(carriedName)) {
        const spot = hands ? handSpot(hands, bodyScale(people, person), heading, TEXEL) : null;
        const handX = spot ? x + spot.x : x + forwardX * reach;
        const handY = spot ? y + spot.y + HAND_SORT_BIAS : y + forwardY * reach;
        const raise = spot ? spot.up : 0;
        stamp.place(carriedName, handX, handY, false, { height: above, rimmed: true, raise });
        if (held === ItemType.Torch || held === ItemType.BurningBranch) stamp.flame(handX, handY - raise, HELD_TORCH_HEAD[0], HELD_TORCH_HEAD[1] - HELD_LIFT_TEXELS * TREE_VIEW.k, above);
      }

      if (people.air[person]! < BREATH_BELOW_CELSIUS) {
        const cycle = (stamp.time + person * 1.7) % BREATH_PERIOD_SECONDS;
        if (cycle < BREATH_SECONDS) {
          const along = cycle / BREATH_SECONDS;
          const bitter = people.air[person]! < 0 ? 1 : 0;
          const reachOut = (BREATH_MOUTH_TEXELS + along * BREATH_DRIFT_TEXELS) * TEXEL;
          stamp.flat(`marker.breath.${Math.min(BREATH_FRAMES - 1, Math.floor(along * BREATH_FRAMES) + bitter)}`, x + forwardX * reachOut, y + forwardY * reachOut - along * BREATH_RISE_TEXELS * TEXEL, { height: above });
        }
      }

      if (kneeling && sparks) {
        const since = STRIKE_INTERVAL - people.strikeClock[person]!;
        if (since >= 0 && since < SPARK_SECONDS) {
          const spread = ((since / SPARK_SECONDS) * 5 + 1) * TEXEL;
          for (const angle of SPARK_ANGLES) {
            stamp.flat('marker.spark', x + forwardX * reach + Math.cos(angle + person) * spread, y + forwardY * reach + Math.sin(angle + person) * spread, { height: above });
          }
        }
      }
    }
  },
};
