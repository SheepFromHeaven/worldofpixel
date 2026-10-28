import type { Baked, Sheets } from '../obliqueCanvas.ts';
import { crownRadius, frameFor, ObliqueCanvas, OPAQUE, texelOf } from '../obliqueCanvas.ts';
import type { SpriteSheetEntry } from '../propPlacementCache.ts';
import { GROWERS, GROWTH_AGE } from './index.ts';
import type { Colour, Palette } from './paint.ts';
import { paintGrown } from './paint.ts';
import { seedOf } from './random.ts';

const LEAF_SHADES = 5;
const BARK_SHADES = 4;
const DARKEST = 0.04;
const LIGHTEST = 0.96;

function paletteOf(sheets: Sheets, entry: SpriteSheetEntry, count: number): Colour[] {
  const colours: Colour[] = [];
  for (let y = 0; y < entry.size; y += 1) {
    for (let x = 0; x < entry.size; x += 1) {
      const at = texelOf(sheets.albedo, entry, x, y);
      if (sheets.albedo.data[at + 3]! < OPAQUE) continue;
      colours.push([sheets.albedo.data[at]!, sheets.albedo.data[at + 1]!, sheets.albedo.data[at + 2]!]);
    }
  }
  const brightness = (colour: Colour): number => colour[0] * 0.3 + colour[1] * 0.55 + colour[2] * 0.15;
  colours.sort((a, b) => brightness(a) - brightness(b));
  return Array.from({ length: count }, (_, shade) => colours[Math.floor((DARKEST + ((LIGHTEST - DARKEST) * shade) / (count - 1)) * (colours.length - 1))] ?? [90, 90, 90]);
}

const PALE_BARK: Colour = [222, 218, 206];

const paled = (colour: Colour, amount: number): Colour => [colour[0] + (PALE_BARK[0] - colour[0]) * amount, colour[1] + (PALE_BARK[1] - colour[1]) * amount, colour[2] + (PALE_BARK[2] - colour[2]) * amount];

export const isGrown = (art: string): boolean => art in GROWERS;

export function bakeGrown(sheets: Sheets, art: string, storey: string, crown: SpriteSheetEntry, trunk: SpriteSheetEntry | undefined, name: string): Baked {
  const radius = crownRadius(sheets, crown);
  const grown = GROWERS[art]!({ radius, age: GROWTH_AGE[storey] ?? 1, seed: seedOf(name) });
  let peak = 1;
  for (const tuft of grown.tufts) peak = Math.max(peak, tuft.at[2] + tuft.up);
  for (const limb of grown.limbs) peak = Math.max(peak, limb.to[2]);
  const frame = frameFor(crown, peak);
  const leaves = paletteOf(sheets, crown, LEAF_SHADES);
  const bark = trunk ? paletteOf(sheets, trunk, BARK_SHADES) : leaves.map((colour) => [colour[0] * 0.6, colour[1] * 0.5, colour[2] * 0.4] as Colour);
  const palette: Palette = { leaves, bark: bark.map((colour, shade) => paled(colour, grown.bark * (shade / Math.max(1, bark.length - 1)))) };
  const canvas = new ObliqueCanvas(frame);
  paintGrown(canvas, frame, grown, palette, seedOf(name));
  return canvas.baked();
}
