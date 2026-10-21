import type { Vec2 } from '../sim/geometry.ts';
import { CarrierState } from '../sim/types.ts';
import type { Carrier } from '../sim/types.ts';
import { drawItemIcon } from './icons.ts';
import { drawTile } from './sprites.ts';
import { TEXEL } from './terrainPixels.ts';
import type { Heading } from './sprites.ts';

/** The scale a carried item's icon is placed at above a villager's head. */
export const CARRIER_SCALE = 0.1;

/**
 * Which row of the villager's grid it stands on, and how far above that point the tile is
 * therefore drawn — a tile is centred on the point it is given, so the lift is the gap from the
 * middle of the grid to that row, in *cells of that grid*, which are texels.
 *
 * It is the bottom of the grid rather than `villager.ts`'s `GROUND`, which is only where the legs
 * stop: the soles and the shadow under them go on the rows below it, and what the figure stands on
 * is the bottom of the shadow. Two cells out is a figure drawn two pixels high on the map and a
 * line through its ankles on the bench, which is where this was settled.
 *
 * Written as six of the pencil figure's own units it was a *third* thing again, since a figure
 * unit is a tenth of a world unit where a texel is an eighth.
 */
export const CARRIER_FEET = 16;
const CARRIER_CELLS = 16;
export const CARRIER_LIFT = (CARRIER_FEET - CARRIER_CELLS / 2) * TEXEL;

const MOVING: CarrierState[] = [
  CarrierState.MovingToSource,
  CarrierState.MovingToDest,
  CarrierState.MovingToWork,
  CarrierState.MovingToNeed,
];

/** Matches the idle clip's own rate in `villager.ts`; slower, or a standing figure vibrates. */
const IDLE_FPS = 2;
/** A blow a second, the chop clip's own rate; a spadeful a little slower. */
const CHOP_FPS = 4;
const DIG_FPS = 3;

/** Which of the two villagers a carrier is. */
export type Build = 'woman' | 'man';

/**
 * Fixed by the carrier's id, so the same person is the same person every frame and on every
 * load — and since a town hires `carrier-1`, `carrier-2`, … in turn, it alternates as it grows.
 */
export function buildOf(id: string): Build {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
  return sum % 2 === 0 ? 'woman' : 'man';
}

/**
 * The heading a carrier is walking, in eighths of a turn. y runs down the map, so a heading of
 * (0, 1) is `s` — towards the viewer.
 */
export function headingOf(heading: { x: number; y: number }): Heading {
  const eighth = Math.round(Math.atan2(heading.y, heading.x) / (Math.PI / 4));
  return (['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const)[((eighth % 8) + 8) % 8]!;
}

export interface CarrierPose {
  build: Build;
  heading: Heading;
  /** Preparing a site: felling with an axe or digging with a spade, the work to this side. */
  preparing?: { tool: 'chop' | 'dig'; toward: 'w' | 'e' };
  position: Vec2;
  /** Walk-cycle phase in radians, taken from distance walked so the stride matches the speed. */
  phase: number;
  facing: number;
  carrying: Carrier['carryingItem'];
  working: boolean;
  walking: boolean;
  /** Seconds since start, for the loops that run on the clock rather than on the stride. */
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

/**
 * A villager, as its tile. The bob is a rectified sine at twice the stride frequency: a body rises
 * once per step, not once per cycle. Nothing is drawn until the strip has decoded.
 */
export function drawCarrier(ctx: CanvasRenderingContext2D, pose: CarrierPose, scale = 1): void {
  const { position, phase } = pose;
  const bob = pose.walking ? Math.abs(Math.sin(phase)) * 1.6 : pose.working ? Math.sin(phase) * 0.8 : 0;

  // Which loop, and how far through it. A walk's frame comes from the stride rather than the
  // clock — `phase` is distance walked — so the feet keep up with the villager however fast it
  // is going. Standing still runs on the clock instead, slowly, or it vibrates.
  //
  // Walking and carrying are drawn eight ways round, each lit from the left like everything else,
  // so the tile is never mirrored: standing still is the ninth case, facing the viewer.
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

  // The tile goes down in world units, one cell to the ground's own texel, so it is never
  // stretched to the figure's scale. The bob moves it by whole texels on its way up and down.
  if (drawTile(ctx, `villager-${pose.build}`, position.x, position.y - CARRIER_LIFT - bob * scale, clip, step)) {
    if (pose.carrying) {
      // Carried over the head, where the arms are: the one place on a ten-pixel figure that is
      // never covered by the figure itself, whichever way it is facing.
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.scale(scale, scale);
      drawItemIcon(ctx, pose.carrying, 0, -16 - bob, 5);
      ctx.restore();
    }
  }
}
