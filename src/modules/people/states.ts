export const EntityState = {
  Idle: 0,
  Wander: 1,
  WalkingToItem: 2,
  PickingUp: 3,
  Carrying: 4,
  ExperimentingKnapping: 5,
  Huddling: 6,
  Chopping: 7,
  Lighting: 8,
  Planting: 9,
  Sleeping: 10,
  Drinking: 11,
  Feeding: 12,
  Foraging: 13,
  Wondering: 14,
  Roasting: 16,
  Fishing: 17,
} as const;

export type EntityState = (typeof EntityState)[keyof typeof EntityState];

export const BODY_TEMP_NORMAL = 37;

export const BODY_TEMP_COLD = 35.2;

export const BODY_TEMP_CRITICAL = 34.5;

export const BODY_TEMP_FLOOR = 30;
