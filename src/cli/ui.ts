import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { magnify } from '../pixel/grid.ts';
import type { Grid } from '../pixel/grid.ts';
import { encodePng } from '../pixel/png.ts';
import { fontSheet } from '../pixel/ui/font.ts';
import { iconSheet } from '../pixel/ui/icons.ts';
import { FONT_SCALES, ICON_SCALE, PLATE_SCALE } from '../pixel/ui/metrics.ts';
import { plates } from '../pixel/ui/plates.ts';
import { surfaces } from '../pixel/ui/surfaces.ts';

const directory = resolve(process.cwd(), 'public/ui');
mkdirSync(directory, { recursive: true });

function write(name: string, grid: Grid, scale: number): void {
  const pixels = magnify(grid, scale);
  const size = grid.size * scale;
  writeFileSync(resolve(directory, `${name}.png`), encodePng(pixels, size, size));
  console.log(`${name}: ${grid.size}x${grid.size} at ${scale}x -> ${size}x${size}`);
}

const font = fontSheet();
for (const scale of FONT_SCALES) write(`font-${scale}x`, font, scale);

write('icons', iconSheet(), ICON_SCALE);

for (const plate of plates()) write(plate.name, plate.grid, PLATE_SCALE);

for (const face of surfaces()) write(face.name, face.grid, PLATE_SCALE);
