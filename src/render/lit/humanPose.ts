import { ItemType } from '../../sim/people/items.ts';
import type { People } from '../../sim/people/people.ts';
import { EntityState, PICK_SECONDS } from '../../sim/people/people.ts';

const GROUND_WORK: ReadonlySet<number> = new Set([
  EntityState.ExperimentingKnapping,
  EntityState.Wondering,
  EntityState.Chopping,
  EntityState.Drinking,
  EntityState.Lighting,
  EntityState.Planting,
  EntityState.Feeding,
  EntityState.Foraging,
  EntityState.Roasting,
]);

const BEND_END = 0.4;

const GRIP_END = 0.55;

const GROUND_REACH = 0.19;

const GROUND_HEIGHT = 0.12;

const CARRY_REACH = 0.2;

const CARRY_HEIGHT = 0.57;

export const HELD_MODEL_HEIGHT = 11;

export const PERSON_SCALES: readonly number[] = [1, 0.94];

export const STANDING_TEXELS = 27;

export const HAND_TILT = 0.4;

export const HAND_UP = 0.917;

export interface HandSpot {
  x: number;
  y: number;
  up: number;
}

export function handSpot(pose: HumanPose, who: number, heading: number, texel: number): HandSpot {
  const standing = STANDING_TEXELS * (PERSON_SCALES[who] ?? 1);
  const snapped = Math.round(heading / (Math.PI / 4)) * (Math.PI / 4);
  const forward = pose.reach * standing * texel;
  return {
    x: Math.cos(snapped) * forward,
    y: HAND_TILT * Math.sin(snapped) * forward,
    up: (pose.height * standing * HAND_UP - HELD_MODEL_HEIGHT * 0.75) * texel,
  };
}

export interface HumanPose {
  carry: number;
  stoop: number;
  item: ItemType;
  reach: number;
  height: number;
}

const ease = (t: number): number => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

const mix = (from: number, to: number, t: number): number => from + (to - from) * t;

export const drawnAsModel = (people: People, person: number): boolean => !people.isLying(person) && !GROUND_WORK.has(people.state[person]!);

export function humanPose(people: People, person: number): HumanPose {
  const held = people.heldItemType[person] as ItemType;
  if (people.state[person] !== EntityState.PickingUp || held !== ItemType.None) {
    const carrying = held !== ItemType.None;
    return { carry: carrying ? 1 : 0, stoop: 0, item: held, reach: CARRY_REACH, height: CARRY_HEIGHT };
  }
  const t = 1 - Math.min(1, Math.max(0, people.timer[person]! / PICK_SECONDS));
  const rising = ease((t - GRIP_END) / (1 - GRIP_END));
  const stoop = t < BEND_END ? ease(t / BEND_END) : t < GRIP_END ? 1 : 1 - rising;
  const gripped = t >= GRIP_END;
  return {
    carry: gripped ? rising : 0,
    stoop,
    item: gripped ? (people.taskItem[person] as ItemType) : ItemType.None,
    reach: mix(GROUND_REACH, CARRY_REACH, rising),
    height: mix(GROUND_HEIGHT, CARRY_HEIGHT, rising),
  };
}
