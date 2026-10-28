import { groundSprites } from '../render/groundSprites.ts';
import { groundPattern } from './groundTexture.ts';
import type { Terrain } from './stage.ts';

const WIDTH = 48;

const HEIGHT = 24;

const SAMPLE_AT = { x: 150, y: 200 };

const known = new Map<string, string>();

export const groundReady = (): boolean => groundSprites() !== null;

export function swatchOf(terrain: Terrain): string | null {
  const cached = known.get(terrain.key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = terrain.colour;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const pattern = groundPattern(ctx, terrain);
  if (pattern) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(-SAMPLE_AT.x, -SAMPLE_AT.y);
    ctx.fillStyle = pattern;
    ctx.fillRect(SAMPLE_AT.x, SAMPLE_AT.y, WIDTH, HEIGHT);
    ctx.restore();
  }
  if (terrain.waterColour) {
    ctx.fillStyle = terrain.waterColour;
    ctx.fillRect(0, 0, WIDTH / 2, HEIGHT);
  }
  const url = canvas.toDataURL();
  if (pattern || groundReady()) known.set(terrain.key, url);
  return url;
}
