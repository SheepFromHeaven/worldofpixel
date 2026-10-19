/**
 * The low-resolution buffer the whole game is drawn into, then magnified to fill the window.
 *
 * This is what lets the zoom run free. A texel is a fixed size in the world, so on a window-
 * resolution canvas it can only stay crisp at whole-number scales — which is why the zoom used
 * to climb a ladder. Drawn into a buffer instead, the grid the eye locks onto is the *buffer's*,
 * and that one is always exactly `SCALE` screen pixels and always aligned. Terrain sampled into
 * it at an awkward scale comes out with some texels a buffer-pixel wide and some two, which
 * reads as variation in the ground rather than as a fault, because nothing is ever blurred or
 * half-covered. So the camera can sit anywhere it likes.
 *
 * It is also the whole of the answer to the far tiers looking different: everything goes through
 * here, so the world map and the country map are made of the same pixels as the parcel map.
 *
 * **Sizes inside the buffer are buffer pixels, not screen pixels.** Stroke weights, marker
 * sizes, text — all of it is `SCALE` times smaller than it used to be and `SCALE` times chunkier
 * on screen. That is the look, but it means any number that used to be "screen pixels" in a
 * draw function now means something else.
 */

/** Screen pixels to a buffer pixel. Whole, or the buffer's own grid stops being square. */
export const SCALE = 2;

let buffer: HTMLCanvasElement | null = null;

export interface Buffer {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

/** The buffer for a viewport, resized as needed. Sizes are in buffer pixels. */
export function bufferFor(width: number, height: number): Buffer | null {
  const wanted = { width: Math.ceil(width / SCALE), height: Math.ceil(height / SCALE) };

  if (!buffer) buffer = document.createElement('canvas');
  if (buffer.width !== wanted.width || buffer.height !== wanted.height) {
    buffer.width = wanted.width;
    buffer.height = wanted.height;
  }

  const ctx = buffer.getContext('2d');
  if (!ctx) return null;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { ctx, width: wanted.width, height: wanted.height };
}

/**
 * Magnifies the buffer onto the visible canvas. Drawn at a whole multiple of its own size rather
 * than stretched to the viewport: a buffer that does not divide the window exactly would
 * otherwise be scaled by a hair over `SCALE` and every pixel in the game would shimmer.
 */
export function present(ctx: CanvasRenderingContext2D, from: Buffer): void {
  if (!buffer) return;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, 0, 0, from.width * SCALE, from.height * SCALE);
  ctx.imageSmoothingEnabled = smoothing;
}
