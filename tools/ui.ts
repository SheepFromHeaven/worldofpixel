import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Grid } from '../src/pixel/grid.ts';
import { magnify } from '../src/pixel/grid.ts';
import { encodePng } from '../src/pixel/png.ts';
import { fontSheet } from '../src/pixel/ui/font.ts';
import { iconSheet } from '../src/pixel/ui/icons.ts';
import { logoSheet } from '../src/pixel/ui/logo.ts';
import { FONT_SCALES, ICON_SCALE, LOGO_SCALE, PLATE_SCALE } from '../src/pixel/ui/metrics.ts';
import { plates } from '../src/pixel/ui/plates.ts';
import { surfaces } from '../src/pixel/ui/surfaces.ts';

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

const logo = logoSheet();
const logoWidth = logo.width * LOGO_SCALE;
const logoHeight = logo.height * LOGO_SCALE;
writeFileSync(
  resolve(directory, 'logo.png'),
  encodePng(magnify(logo.grid, LOGO_SCALE).subarray(0, logoWidth * logoHeight * 4), logoWidth, logoHeight),
);
console.log(`logo: ${logoWidth}x${logoHeight}`);

for (const plate of plates()) write(plate.name, plate.grid, PLATE_SCALE);

for (const face of surfaces()) write(face.name, face.grid, PLATE_SCALE);
