import { BIOME_COLORS } from '../render/palette.ts';
import { SEA_LEVEL } from '../sim/terrain/heightmap.ts';
import type { FieldProgress } from '../sim/terrain/worldfield.ts';
import { Biome } from '../sim/types.ts';

export const PREVIEW_WIDTH = 256;

type Rgb = readonly [number, number, number];

const rgbOf = (hex: string): Rgb => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const COLOURS: readonly Rgb[] = BIOME_COLORS.map(rgbOf);

const LAND_HEIGHT_SPAN = 0.5;

const LOWEST_SHADE = 0.65;

const SHADE_SPAN = 0.6;

const colourOf = (index: number): Rgb => COLOURS[index] ?? COLOURS[Biome.Meadow]!;

export function previewHeight(grid: FieldProgress['grid']): number {
  return Math.round((PREVIEW_WIDTH * grid.rows) / grid.columns);
}

export function drawPreview(ctx: CanvasRenderingContext2D, progress: FieldProgress): void {
  const { grid, height, water, biome } = progress;
  const width = PREVIEW_WIDTH;
  const rows = previewHeight(grid);
  const image = ctx.createImageData(width, rows);
  const sea = colourOf(Biome.Ocean);
  const lake = colourOf(Biome.Lake);

  for (let y = 0; y < rows; y += 1) {
    const row = Math.min(grid.rows - 1, Math.floor((y * grid.rows) / rows));
    for (let x = 0; x < width; x += 1) {
      const cell = row * grid.columns + Math.min(grid.columns - 1, Math.floor((x * grid.columns) / width));
      let colour: Rgb;
      const kind = water ? water[cell]! : 0;
      if (biome) colour = colourOf(biome[cell]!);
      else if (kind === 1) colour = sea;
      else if (kind === 2) colour = lake;
      else {
        const rise = height ? Math.min(1, Math.max(0, (height[cell]! - SEA_LEVEL) / LAND_HEIGHT_SPAN)) : 0;
        const shade = LOWEST_SHADE + SHADE_SPAN * rise;
        const land = colourOf(Biome.Meadow);
        colour = [land[0] * shade, land[1] * shade, land[2] * shade];
      }
      const at = (y * width + x) * 4;
      image.data[at] = colour[0];
      image.data[at + 1] = colour[1];
      image.data[at + 2] = colour[2];
      image.data[at + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}
