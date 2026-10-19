import { rampAt } from './color.ts';
import type { Ramp } from './color.ts';
import { bayer, measure, noise } from './field.ts';
import type { Field, Mask } from './field.ts';
import { createGrid, put } from './grid.ts';
import type { Grid } from './grid.ts';
import { illuminate, normalize } from './light.ts';
import type { Light } from './light.ts';

/**
 * The shape of a region's cross-section, from its edge to its deepest point, as a height between
 * 0 and 1. `relief` then says what that 1 is worth in cells.
 *
 * This is the only thing that tells the lighting what kind of surface it is looking at, and it
 * is worth getting right before reaching for anything else: a bank and a pool are the same
 * silhouette lit the same way, and differ only in which way the ground goes as you walk in.
 */
export type Profile = (depth: number, deepest: number) => number;

/**
 * Rises towards the middle and rounds over: a boulder, a bank, a loaf of a hill. The usual case.
 *
 * Round, not a cone. A height that climbs at a constant rate has the same slope everywhere, so
 * the surface leans the same way everywhere and the sun has nothing to pick out — it comes back
 * as a flat sticker with an outline. The turn near the rim is what the eye reads as volume.
 */
export const dome: Profile = (depth, deepest) => {
  const t = 1 - depth / (deepest || 1);
  return Math.sqrt(Math.max(0, 1 - t * t));
};

/** Falls away towards the middle: a pool, a crater, a dent. */
export const basin: Profile = (depth, deepest) => -dome(depth, deepest);

/** Climbs at a constant rate — a heap of spoil, a ramp, anything tipped rather than swollen. */
export const cone: Profile = (depth, deepest) => depth / (deepest || 1);

/** Doesn't lean at all: a floor, a roof, a puddle of spilled paint. */
export const flat: Profile = () => 0;

export interface Material {
  ramp: Ramp;
  /**
   * The colours this material takes where a fire, rather than the sun, is doing the lighting.
   *
   * Stone by daylight and stone by firelight are not the same colour with the brightness turned
   * up — they are two sets of colours, and in pixel art both get chosen rather than computed.
   * Mixing towards a tint would invent shades that are in no ramp and the sprite stops belonging
   * to its own palette.
   *
   * Omitted means the material does not care what is lighting it, which is most of them.
   */
  warm?: Ramp;
  /** Which way the ground goes as you walk into the region. Defaults to `dome`. */
  profile?: Profile;
  /**
   * How high the region stands at its deepest point, in cells. Zero is a flat sticker. This is
   * a real height and not a knob: a boulder four cells across that stands four cells tall is
   * lit like a ball, and the same boulder with a relief of 1 is lit like a flagstone.
   */
  relief?: number;
  /** The step of the ramp an unlit cell sits on. */
  ambient?: number;
  /** How much of the ramp the light is allowed to travel. */
  contrast?: number;
  /** Darkens with depth regardless of light — water, glass, anything you see into. */
  density?: number;
  /** Breaks up a flat face by jittering which step of the ramp a cell takes. */
  speckle?: number;
}

export interface Region {
  mask: Mask;
  material: Material;
}

function normalAt(field: Field, profile: Profile, relief: number, x: number, y: number) {
  // In cells, both ways. A height normalised to the region's own size would make a big sprite
  // shallower than a small one drawn the same, which is how this first came out: every slope
  // divided by the sprite's radius, and nothing round enough for the sun to find.
  const height = (hx: number, hy: number): number =>
    profile(field.depth(hx, hy), field.deepest) * relief;

  // Central differences: the lean of the surface is how fast its height is changing, and the
  // cell either side is the only place to read that off a grid this small.
  const slopeX = (height(x + 1, y) - height(x - 1, y)) / 2;
  const slopeY = (height(x, y + 1) - height(x, y - 1)) / 2;
  return normalize([-slopeX * relief, -slopeY * relief, 1]);
}

/**
 * Draws regions in order, each one lit by the same lights, later ones painting over earlier.
 *
 * Order is how a shore or a seam gets made: the region underneath is drawn whole, and a thinner
 * region over the top of it takes the cells where the two meet.
 */
export function shade(size: number, regions: readonly Region[], lights: readonly Light[]): Grid {
  const grid = createGrid(size);

  for (const [index, region] of regions.entries()) {
    const field = measure(size, region.mask);
    const profile = region.material.profile ?? dome;
    const relief = region.material.relief ?? 2;
    const ambient = region.material.ambient ?? 0.15;
    const contrast = region.material.contrast ?? 0.7;
    const density = region.material.density ?? 0;
    const speckle = region.material.speckle ?? 0;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!region.mask(x, y)) continue;

        const normal = normalAt(field, profile, relief, x, y);
        const light = illuminate(lights, { x, y, normal });
        const sunk = density * (field.depth(x, y) / (field.deepest || 1));
        const grain = speckle === 0 ? 0 : (noise(x, y, index) - 0.5) * speckle;

        // Which palette, before which step of it. Dithered rather than switched at a threshold,
        // so a stone at the edge of the firelight stipples from grey into warm instead of
        // changing its mind along a hard line that no edge in the drawing accounts for.
        const warm = region.material.warm;
        const heat = light.total > 0 ? light.warm / light.total : 0;
        const ramp = warm && heat > bayer(x, y) ? warm : region.material.ramp;

        put(grid, x, y, rampAt(ramp, ambient + light.total * contrast - sunk + grain));
      }
    }
  }

  return grid;
}
