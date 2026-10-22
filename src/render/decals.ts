import { LIVE_MIPS, decalCells } from './groundSprites.ts';
import type { DecalCells, Placement } from './groundSprites.ts';
import { TEXEL, levelFor } from './terrainPixels.ts';

const canvases = new Map<string, HTMLCanvasElement>();

function canvasOf(key: string, cells: DecalCells): HTMLCanvasElement | undefined {
  const known = canvases.get(key);
  if (known) return known;
  const canvas = document.createElement('canvas');
  canvas.width = cells.width;
  canvas.height = cells.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  const image = ctx.createImageData(cells.width, cells.height);
  cells.cells.forEach((color, at) => {
    if ((color & 0xff) !== 0xff) return;
    image.data[at * 4] = (color >>> 24) & 0xff;
    image.data[at * 4 + 1] = (color >>> 16) & 0xff;
    image.data[at * 4 + 2] = (color >>> 8) & 0xff;
    image.data[at * 4 + 3] = color & 0xff;
  });
  ctx.putImageData(image, 0, 0);
  canvases.set(key, canvas);
  return canvas;
}

export function drawnLive(zoom: number): boolean {
  const mip = Math.round(Math.log2(levelFor(zoom).texel / TEXEL));
  return mip >= 0 && mip < LIVE_MIPS;
}

export function drawDecal(ctx: CanvasRenderingContext2D, placement: Placement): boolean {
  const transform = ctx.getTransform();
  if (transform.b !== 0 || transform.c !== 0) return false;

  const level = levelFor(Math.abs(transform.a));
  const mip = Math.round(Math.log2(level.texel / TEXEL));
  if (mip < 0 || mip >= LIVE_MIPS) return false;

  const cells = decalCells(placement.decal, mip);
  const canvas = canvasOf(`${placement.decal.name}|${mip}`, cells);
  if (!canvas) return false;

  const texel = level.texel;
  const leftWorld = (Math.round(placement.x / texel) - cells.foot.x) * texel;
  const topWorld = (Math.round(placement.y / texel) - cells.foot.y) * texel;
  const left = Math.round(transform.a * leftWorld + transform.e);
  const top = Math.round(transform.d * topWorld + transform.f);
  const width = Math.round(transform.a * (leftWorld + cells.width * texel) + transform.e) - left;
  const height = Math.round(transform.d * (topWorld + cells.height * texel) + transform.f) - top;

  const smoothing = ctx.imageSmoothingEnabled;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, left, top, width, height);
  ctx.restore();
  ctx.imageSmoothingEnabled = smoothing;
  return true;
}
