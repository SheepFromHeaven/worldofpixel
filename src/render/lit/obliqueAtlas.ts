import type { Baked } from './obliqueCanvas.ts';

export const ATLAS_WIDTH = 1024;
export const SWAY_PADDING_TEXELS = 3;

export interface PlacedSprite {
  x: number;
  y: number;
  size: number;
  foot: { x: number; y: number };
  layered: boolean;
  low: { x: number; y: number };
  high: { x: number; y: number };
}

export interface PackedAtlas {
  width: number;
  height: number;
  albedo: Uint8Array;
  normals: Uint8Array;
  placed: Map<string, PlacedSprite>;
}

export function packBaked(baked: ReadonlyMap<string, Baked>): PackedAtlas {
  const placed = new Map<string, PlacedSprite>();
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const [name, sprite] of baked) {
    const span = sprite.woodAlbedo ? sprite.size * 2 : sprite.size;
    if (x + span > ATLAS_WIDTH) {
      x = 0;
      y += shelf;
      shelf = 0;
    }
    placed.set(name, { x, y, size: sprite.size, foot: sprite.foot, layered: sprite.woodAlbedo !== undefined, low: sprite.low, high: sprite.high });
    x += span;
    shelf = Math.max(shelf, sprite.size);
  }
  const height = Math.max(4, Math.ceil((y + shelf) / 4) * 4);
  const albedo = new Uint8Array(ATLAS_WIDTH * height * 4);
  const normals = new Uint8Array(ATLAS_WIDTH * height * 4);
  for (const [name, sprite] of baked) {
    const at = placed.get(name)!;
    for (let row = 0; row < sprite.size; row += 1) {
      const from = row * sprite.size * 4;
      const to = ((at.y + row) * ATLAS_WIDTH + at.x) * 4;
      albedo.set(sprite.albedo.subarray(from, from + sprite.size * 4), to);
      normals.set(sprite.normals.subarray(from, from + sprite.size * 4), to);
      if (sprite.woodAlbedo && sprite.woodNormals) {
        albedo.set(sprite.woodAlbedo.subarray(from, from + sprite.size * 4), to + sprite.size * 4);
        normals.set(sprite.woodNormals.subarray(from, from + sprite.size * 4), to + sprite.size * 4);
      }
    }
  }
  return { width: ATLAS_WIDTH, height, albedo, normals, placed };
}

export function cropBytes(placed: ReadonlyMap<string, PlacedSprite>, width: number, height: number): Uint8Array {
  const crop = new Uint8Array(width * height * 4);
  for (const sprite of placed.values()) {
    const empty = sprite.high.x < sprite.low.x;
    const corner = (sprite.y * width + sprite.x) * 4;
    crop[corner] = empty ? 0 : Math.max(0, sprite.low.x - SWAY_PADDING_TEXELS);
    crop[corner + 1] = empty ? 0 : Math.max(0, sprite.low.y - SWAY_PADDING_TEXELS);
    crop[corner + 2] = empty ? sprite.size : Math.min(sprite.size, sprite.high.x + 1 + SWAY_PADDING_TEXELS);
    crop[corner + 3] = empty ? sprite.size : Math.min(sprite.size, sprite.high.y + 1 + SWAY_PADDING_TEXELS);
  }
  return crop;
}
