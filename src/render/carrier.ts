import type { Vec2 } from '../sim/geometry.ts';
import { CarrierState } from '../sim/types.ts';
import type { Carrier } from '../sim/types.ts';
import { drawItemIcon } from './icons.ts';
import { drawTile } from './sprites.ts';
import { TEXEL } from './terrainPixels.ts';
import type { Heading } from './sprites.ts';

export const CARRIER_SCALE = 0.1;

export const CARRIER_FEET = 16;
const CARRIER_CELLS = 16;
export const CARRIER_LIFT = (CARRIER_FEET - CARRIER_CELLS / 2) * TEXEL;

const MOVING: CarrierState[] = [
  CarrierState.MovingToSource,
  CarrierState.MovingToDest,
  CarrierState.MovingToWork,
  CarrierState.MovingToNeed,
];

const IDLE_FPS = 2;
const CHOP_FPS = 4;
const DIG_FPS = 3;

export type Build = 'woman' | 'man';

export function buildOf(id: string): Build {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
  return sum % 2 === 0 ? 'woman' : 'man';
}

export function headingOf(heading: { x: number; y: number }): Heading {
  const eighth = Math.round(Math.atan2(heading.y, heading.x) / (Math.PI / 4));
  return (['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const)[((eighth % 8) + 8) % 8]!;
}

export interface CarrierPose {
  build: Build;
  heading: Heading;
  preparing?: { tool: 'chop' | 'dig'; toward: 'w' | 'e' };
  position: Vec2;
  phase: number;
  facing: number;
  carrying: Carrier['carryingItem'];
  working: boolean;
  walking: boolean;
  clock: number;
}

export function poseOf(carrier: Carrier, position: Vec2, time: number): CarrierPose {
  const walking = MOVING.includes(carrier.state);
  const handling =
    carrier.state === CarrierState.PickingUp || carrier.state === CarrierState.DroppingOff;
  return {
    build: buildOf(carrier.id),
    heading: headingOf(carrier.heading),
    position,
    phase: walking ? carrier.walked * 0.22 : handling ? time * 7 : 0,
    facing: carrier.heading.x >= 0 ? 1 : -1,
    carrying: carrier.carryingItem,
    working: handling,
    walking,
    clock: time,
  };
}

export function drawCarrier(ctx: CanvasRenderingContext2D, pose: CarrierPose, scale = 1): void {
  const { position, phase } = pose;
  const bob = pose.walking ? Math.abs(Math.sin(phase)) * 1.6 : pose.working ? Math.sin(phase) * 0.8 : 0;

  const clip = pose.preparing
    ? `${pose.preparing.tool}-${pose.preparing.toward}`
    : pose.walking
      ? `${pose.carrying ? 'carry' : 'walk'}-${pose.heading}`
      : 'idle';
  const step = pose.preparing
    ? Math.floor(pose.clock * (pose.preparing.tool === 'chop' ? CHOP_FPS : DIG_FPS)) & 3
    : pose.walking
    ? Math.floor(pose.phase / (Math.PI / 2)) & 3
    : pose.carrying
      ? 0
      : Math.floor(pose.clock * IDLE_FPS) & 1;

  if (drawTile(ctx, `villager-${pose.build}`, position.x, position.y - CARRIER_LIFT - bob * scale, clip, step)) {
    if (pose.carrying) {
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.scale(scale, scale);
      drawItemIcon(ctx, pose.carrying, 0, -16 - bob, 5);
      ctx.restore();
    }
  }
}
