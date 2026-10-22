import { and } from '../field.ts';
import { outline } from '../grid.ts';
import type { Grid } from '../grid.ts';
import type { Light } from '../light.ts';
import { BONE, EMBER, INK, SHADOW } from '../palette.ts';
import { shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Piece, Sprite } from '../sprite.ts';
import { castShadow, groundShadow } from '../view.ts';

const CELLS = 16;

const STONE_BODY = (x: number, y: number): boolean =>
  x >= 6 && x <= 10 && y >= 7 && y <= 13 && !(y === 7 && (x === 6 || x === 10));

const CAP = and(STONE_BODY, (_x, y) => y <= 9);

export const STONE_FOOT = { x: 8, y: 13 };

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

const REGIONS: readonly Region[] = [
  { mask: STONE_BODY, material: { ramp: BONE, relief: 1.6, ambient: 0.3, contrast: 0.75, speckle: 0.1 } },
  { mask: CAP, material: { ramp: EMBER, relief: 1.6, ambient: 0.25, contrast: 0.75 } },
];

function draw(lights: readonly Light[]): Grid {
  const grid = shade(CELLS, REGIONS, lights);
  outline(grid, INK);
  castShadow(grid, groundShadow(STONE_FOOT.x, STONE_FOOT.y, 3.5, 813, 0.45), SHADOW);
  return grid;
}

const STONE_PIECES: readonly Piece[] = [{ clip: 'default', foot: 14.02 }];

export const borderStone: Sprite = {
  name: 'border-stone',
  cells: CELLS,
  lights: [SUN],
  pieces: STONE_PIECES,
  draw,
};
