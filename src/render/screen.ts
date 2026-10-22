
export const SCALE = 2;

let buffer: HTMLCanvasElement | null = null;

export interface Buffer {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

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

export function present(ctx: CanvasRenderingContext2D, from: Buffer): void {
  if (!buffer) return;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, 0, 0, from.width * SCALE, from.height * SCALE);
  ctx.imageSmoothingEnabled = smoothing;
}
