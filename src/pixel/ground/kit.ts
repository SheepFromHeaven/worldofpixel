import type { Ramp } from '../color.ts';
import { blob, capsule } from '../field.ts';
import { CORD, WOOD } from '../palette.ts';
import type { Material, Region } from '../shade.ts';
import { dome } from '../shade.ts';
import type { LitProp, Standing, Traits } from './objects.ts';
import { lit } from './objects.ts';


export const STILL: Traits = { sway: 0, canopy: false, bend: false };

export const INKED: Traits = { sway: 0, canopy: false, bend: false, inked: true };

export const GLOW: Traits = { sway: 0, canopy: false, bend: false, emit: true };

export const material = (ramp: Ramp, relief = 1.5, grit = 0.2, speckle = 0.25, profile = dome): Material => ({
  ramp,
  profile,
  relief,
  ambient: 0.1,
  contrast: 0.85,
  speckle,
  grit,
});

export const middle = (size: number): { x: number; y: number } => ({ x: Math.floor(size / 2), y: Math.floor(size / 2) });

export const piece = (size: number, regions: readonly Region[], height: number): Standing => ({
  size,
  foot: middle(size),
  shadow: () => false,
  height,
  regions,
});

export const polar = (from: { x: number; y: number }, angle: number, reach: number): { x: number; y: number } => ({
  x: from.x + Math.cos(angle) * reach,
  y: from.y + Math.sin(angle) * reach,
});

export const SMALL_SIZE = 12;

export const STACK_STAGES = 5;

const TILE_SIZE = 16;

const PIECES_PER_STAGE: readonly number[] = [1, 5, 9, 14, 20];

const HEAP_RADIUS = 6.2;

const SPIRAL = 2.39996;

type Spot = { x: number; y: number };

export type Piece = (at: Spot, reach: number, angle: number, seed: number) => Region[];

export function heap(make: Piece, reach: number, stage: number, height: number): Standing {
  const foot = middle(TILE_SIZE);
  const count = PIECES_PER_STAGE[stage]!;
  if (count === 1) return piece(TILE_SIZE, make(foot, reach, 0.4, 3), height);

  const spacing = Math.min(reach * 1.7, (HEAP_RADIUS * 1.15) / Math.sqrt(count));
  const regions: Region[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = polar(foot, i * SPIRAL + stage, spacing * Math.sqrt(i + 0.5));
    regions.push(...make(at, reach, i * 1.7 + stage, stage * 31 + i * 3));
  }
  return piece(TILE_SIZE, regions, height + stage);
}

export function plot(): Standing {
  const size = 18;
  const foot = middle(size);
  const reach = 7;
  const arm = 3;
  const cord = material(CORD, 1, 0.2, 0.3);
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sy) => ({ x: foot.x + sx * reach, y: foot.y + sy * reach, sx, sy })));
  return piece(
    size,
    corners.flatMap((corner) => [
      { mask: capsule(corner.x, corner.y, corner.x - corner.sx * arm, corner.y, 0.7), material: cord },
      { mask: capsule(corner.x, corner.y, corner.x, corner.y - corner.sy * arm, 0.7), material: cord },
      { mask: blob(corner.x, corner.y, 1.2, 1.2, 0.05, corner.sx * 3 + corner.sy), material: material(WOOD, 1.2, 0.3, 0.3) },
    ]),
    2,
  );
}

export interface Stacked {
  readonly piece: Piece;
  readonly reach: number;
  readonly height: number;
  readonly small: (variant: number) => Standing;
}

export const stackedSprites = (art: string, sprite: Stacked): LitProp[] => [
  lit(`item.${art}.held`, {}, sprite.small(0), 1, INKED),
  ...Array.from({ length: STACK_STAGES }, (_, stage) => lit(`item.${art}.s${stage}`, {}, heap(sprite.piece, sprite.reach, stage, sprite.height), 1, INKED)),
];

export const stackedCloseUp = (art: string, sprite: Stacked): readonly [string, Standing] => [art, heap(sprite.piece, sprite.reach, 0, sprite.height)];

