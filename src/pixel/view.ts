import type { Rgba } from './color.ts';
import { blob } from './field.ts';
import type { Mask } from './field.ts';
import { at, put } from './grid.ts';
import type { Grid } from './grid.ts';

/**
 * The one view every drawing on the map is made in: three-quarter, from about 45 degrees.
 *
 * The ground is seen from above and everything on it stands up. A pool, a ring of stones, the
 * spread of a shadow — anything lying flat — is foreshortened to `TILT` of its width; a trunk,
 * a wall, a person — anything standing — keeps its height and shows its front. It is the view a
 * person standing on a hill has, and the only one in which a villager, a well and a tree can be
 * on the same map: drawn straight down a person is a disc of hair, drawn from the side a well is
 * a line.
 *
 * It was not one view before, and nothing looked wrong until things stood next to each other.
 * The buildings were heightfields lit from overhead, the villager was drawn from the front, the
 * trees as crowns from above — three cameras on one map. Every new drawing goes through here.
 */

/** How tall a circle on the ground is drawn, as a share of how wide: the cosine of 45 degrees. */
export const TILT = Math.SQRT1_2;

/**
 * A tile's grid, and the square of floor inside it.
 *
 * A tile is square and a square of floor is `TILT` of it, so a drawing that has to *meet the next
 * square* — a trough running from one to the next — has to live in exactly these rows, and the
 * painter has to anchor it on exactly this line. Both sides read the numbers from here: a sprite
 * drawn to one footprint and laid out against another leaves a seam a pixel or two wide at every
 * join, which reads as a row of separate planks rather than as one run.
 */
export const TILE_CELLS = 32;
export const FLOOR_TOP = 5;
export const FLOOR_ROWS = Math.round(TILE_CELLS * TILT);
/** Where the front edge of the square falls in the tile, as a share of its height. */
export const FLOOR_FOOT = (FLOOR_TOP + FLOOR_ROWS) / TILE_CELLS;

/**
 * The shadow a standing thing casts, as a mask on the ground.
 *
 * Every standing thing gets one, and that is not decoration: it is what pins an upright drawing
 * to the ground it stands on. Without it a tree drawn from the front floats over the grass like
 * a sticker. The sun is up and to the left, so the shadow lies down and to the right of the
 * foot, flattened like anything else on the ground.
 */
export function groundShadow(footX: number, footY: number, width: number, seed: number, reach = 0.35): Mask {
  return blob(footX + width * reach, footY, width * 0.55, width * 0.55 * TILT * 0.6, 0.08, seed);
}

/** Lays a shadow into a tile wherever the drawing has left the ground showing. */
export function castShadow(grid: Grid, shadow: Mask, color: Rgba): void {
  for (let y = 0; y < grid.size; y += 1) {
    for (let x = 0; x < grid.size; x += 1) {
      if (shadow(x, y) && (at(grid, x, y) & 0xff) === 0) put(grid, x, y, color);
    }
  }
}
