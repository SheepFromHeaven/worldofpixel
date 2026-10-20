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

/**
 * A border stone: an upright marker set at intervals round the edge of a town's claim.
 *
 * A stone and not a line because a line round a claim is a map of the claim, and a row of stones
 * is the claim itself, set out on the ground the way people mark land — and it takes its place
 * among the trees and the buildings in the three-quarter view (`view.ts`) like anything else that
 * stands there. Knee-high on a villager — any taller and a row of them is a wall of monuments
 * round the town — with a band of the town's red so a row of them reads as one border from a
 * distance, where a grey stone alone would be another pebble.
 */
/**
 * A cut block: square sides, a flat top, its two top corners knocked off. Squared, because the
 * ground round it is full of things about its size — wildflowers in the same red and white, stones
 * and tufts — and every one of them is round. A rounded marker was one more flower; a block with
 * straight edges is the one thing in the meadow somebody made.
 */
const STONE_BODY = (x: number, y: number): boolean =>
  x >= 6 && x <= 10 && y >= 7 && y <= 13 && !(y === 7 && (x === 6 || x === 10));

/**
 * The painted top, not a band round the middle. It has to survive being halved for the rung one
 * out, where a band a cell high averaged away into the stone and a row of markers came out as a
 * row of brown specks; the top of the block in red is still red at half the size.
 */
const CAP = and(STONE_BODY, (_x, y) => y <= 9);

/** Where it stands, for its shadow and for the renderer: the bottom of the stone. */
export const STONE_FOOT = { x: 8, y: 13 };

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

/**
 * Pale stone and a red top: the two things nothing else on the map is. A grey stone is a boulder
 * on rock and a pebble on a road, and was lost against both; whitewashed limestone stands out from
 * every ground there is, and the red says whose.
 */
const REGIONS: readonly Region[] = [
  { mask: STONE_BODY, material: { ramp: BONE, relief: 1.6, ambient: 0.3, contrast: 0.75, speckle: 0.1 } },
  // Painted on, so it follows the stone's light: a lit side and a shaded one, in the town's red.
  { mask: CAP, material: { ramp: EMBER, relief: 1.6, ambient: 0.25, contrast: 0.75 } },
];

function draw(lights: readonly Light[]): Grid {
  const grid = shade(CELLS, REGIONS, lights);
  outline(grid, INK);
  castShadow(grid, groundShadow(STONE_FOOT.x, STONE_FOOT.y, 3.5, 813, 0.45), SHADOW);
  return grid;
}

/**
 * Where the stone sits on the line it marks. The drawing is centred in its tile and the block is
 * in the lower part of it, so this is what the painter both lifts the tile by and sorts it on —
 * it was a constant of its own in `townLayer.ts` before, which is one place too many.
 */
const STONE_PIECES: readonly Piece[] = [{ clip: 'default', foot: 14.02 }];

export const borderStone: Sprite = {
  name: 'border-stone',
  cells: CELLS,
  lights: [SUN],
  pieces: STONE_PIECES,
  draw,
};
