import type { SpriteSheetEntry } from './propPlacementCache.ts';
import { TREE_VIEW } from './treeView.ts';

export const OPAQUE = 128;
export const WOOD_ALPHA = 200;
export const LARGEST_SPRITE = 255;

export interface Frame {
  size: number;
  footX: number;
  footY: number;
  squash: number;
  rise: number;
  offsetX: number;
  peak: number;
}

export interface Sheets {
  albedo: ImageData;
  normals: ImageData;
}

export interface Baked {
  size: number;
  foot: { x: number; y: number };
  albedo: Uint8Array;
  normals: Uint8Array;
  woodAlbedo?: Uint8Array;
  woodNormals?: Uint8Array;
  low: { x: number; y: number };
  high: { x: number; y: number };
}

export const smooth = (from: number, to: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from || 1)));
  return t * t * (3 - 2 * t);
};

export const texelOf = (pixels: ImageData, entry: SpriteSheetEntry, x: number, y: number): number => ((entry.y + y) * pixels.width + entry.x + x) * 4;

export function frameFor(crown: SpriteSheetEntry, peak: number): Frame {
  const squash = Math.sqrt(Math.max(0, 1 - TREE_VIEW.k * TREE_VIEW.k));
  const rise = Math.ceil(peak * TREE_VIEW.k) + 2;
  const size = Math.min(LARGEST_SPRITE, crown.size + rise);
  return { size, footX: crown.foot.x, footY: crown.foot.y, squash, rise, offsetX: Math.floor((size - crown.size) / 2), peak };
}

export function crownRadius(sheets: Sheets, crown: SpriteSheetEntry): number {
  let radius = 1;
  for (let y = 0; y < crown.size; y += 1) {
    for (let x = 0; x < crown.size; x += 1) {
      if (sheets.albedo.data[texelOf(sheets.albedo, crown, x, y) + 3]! < OPAQUE) continue;
      radius = Math.max(radius, Math.hypot(x + 0.5 - crown.foot.x, y + 0.5 - crown.foot.y));
    }
  }
  return radius;
}

export class ObliqueCanvas {
  readonly closeness: Float32Array;
  readonly albedo: Uint8Array;
  readonly normals: Uint8Array;
  readonly woodCloseness: Float32Array;
  readonly woodAlbedo: Uint8Array;
  readonly woodNormals: Uint8Array;
  wooded = false;
  low = { x: Infinity, y: Infinity };
  high = { x: -Infinity, y: -Infinity };

  constructor(private readonly shape: Frame) {
    this.closeness = new Float32Array(shape.size * shape.size).fill(-Infinity);
    this.albedo = new Uint8Array(shape.size * shape.size * 4);
    this.normals = new Uint8Array(shape.size * shape.size * 4);
    this.woodCloseness = new Float32Array(shape.size * shape.size).fill(-Infinity);
    this.woodAlbedo = new Uint8Array(shape.size * shape.size * 4);
    this.woodNormals = new Uint8Array(shape.size * shape.size * 4);
  }

  private write(albedo: Uint8Array, normals: Uint8Array, at: number, z: number, colour: readonly number[], shade: number, alpha: number, nx: number, ny: number, normalAlpha: number): void {
    albedo[at] = Math.min(255, Math.round(colour[0]! * shade));
    albedo[at + 1] = Math.min(255, Math.round(colour[1]! * shade));
    albedo[at + 2] = Math.min(255, Math.round(colour[2]! * shade));
    albedo[at + 3] = alpha;
    normals[at] = Math.round((Math.max(-1, Math.min(1, nx)) * 0.5 + 0.5) * 255);
    normals[at + 1] = Math.round((Math.max(-1, Math.min(1, ny)) * 0.5 + 0.5) * 255);
    normals[at + 2] = 1 + Math.round(254 * (0.3 + 0.7 * Math.min(1, Math.max(0, z / this.shape.peak))));
    normals[at + 3] = normalAlpha;
  }

  put(planX: number, planY: number, z: number, colour: readonly number[], shade: number, alpha: number, nx: number, ny: number, normalAlpha: number, wood = false): void {
    const { shape } = this;
    const k = TREE_VIEW.k;
    const x = Math.floor(planX + shape.offsetX);
    const y = Math.floor(shape.footY + shape.rise + (planY - shape.footY) * shape.squash - z * k);
    if (x < 0 || y < 0 || x >= shape.size || y >= shape.size) return;
    const near = planY * k + z * shape.squash;
    const cell = y * shape.size + x;
    const at = cell * 4;
    if (wood && near > this.woodCloseness[cell]!) {
      this.woodCloseness[cell] = near;
      this.write(this.woodAlbedo, this.woodNormals, at, z, colour, shade, 255, nx, ny, 255);
      this.wooded = true;
    }
    if (near <= this.closeness[cell]!) return;
    this.closeness[cell] = near;
    this.write(this.albedo, this.normals, at, z, colour, shade, alpha, nx, ny, normalAlpha);
    this.low = { x: Math.min(this.low.x, x), y: Math.min(this.low.y, y) };
    this.high = { x: Math.max(this.high.x, x), y: Math.max(this.high.y, y) };
  }

  baked(): Baked {
    const { shape } = this;
    const layers = this.wooded ? { woodAlbedo: this.woodAlbedo, woodNormals: this.woodNormals } : {};
    return { size: shape.size, foot: { x: shape.footX + shape.offsetX, y: shape.footY + shape.rise }, albedo: this.albedo, normals: this.normals, ...layers, low: this.low, high: this.high };
  }
}
