import type { Baked, Frame, Sheets } from '../obliqueCanvas.ts';
import { crownRadius, frameFor, ObliqueCanvas, OPAQUE, texelOf } from '../obliqueCanvas.ts';
import type { SpriteSheetEntry } from '../propPlacementCache.ts';
import type { Colour, Palette } from './paint.ts';
import { paintGrown } from './paint.ts';
import type { Blade, PlantSpec } from './plants.ts';
import { growPlant, familyOf, PLANT_SPECS, roleOf } from './plants.ts';
import { hash3, seedOf } from './random.ts';

const SHADES = 5;
const SAMPLE = 0.5;
const FOLIAGE_ALPHA = 255;
const DARKEST = 0.04;
const LIGHTEST = 0.96;
const SATURATED = 35;
const PALE_BRIGHTNESS = 150;

const brightness = (colour: Colour): number => colour[0] * 0.3 + colour[1] * 0.55 + colour[2] * 0.15;
const spread = (colour: Colour): number => Math.max(...colour) - Math.min(...colour);
const isGreen = (colour: Colour): boolean => colour[1] >= colour[0] * 0.95 && colour[1] >= colour[2] * 1.05;

const quantiles = (colours: readonly Colour[], count: number, fallback: readonly Colour[]): Colour[] => {
  if (colours.length < 6) return fallback.length > 0 ? [...fallback] : Array.from({ length: count }, () => [90, 110, 70] as Colour);
  const sorted = [...colours].sort((a, b) => brightness(a) - brightness(b));
  return Array.from({ length: count }, (_, shade) => sorted[Math.floor((DARKEST + ((LIGHTEST - DARKEST) * shade) / (count - 1)) * (sorted.length - 1))]!);
};

interface Roles {
  greens: Colour[];
  blooms: Colour[];
  pales: Colour[];
}

function rolesOf(sheets: Sheets, entry: SpriteSheetEntry): Roles {
  const all: Colour[] = [];
  for (let y = 0; y < entry.size; y += 1) {
    for (let x = 0; x < entry.size; x += 1) {
      const at = texelOf(sheets.albedo, entry, x, y);
      if (sheets.albedo.data[at + 3]! < OPAQUE) continue;
      all.push([sheets.albedo.data[at]!, sheets.albedo.data[at + 1]!, sheets.albedo.data[at + 2]!]);
    }
  }
  const greens = quantiles(all.filter(isGreen), SHADES, quantiles(all, SHADES, []));
  const blooms = quantiles(all.filter((colour) => !isGreen(colour) && spread(colour) >= SATURATED), SHADES, greens);
  const pales = quantiles(all.filter((colour) => spread(colour) < SATURATED && brightness(colour) > PALE_BRIGHTNESS), 4, greens);
  return { greens, blooms, pales };
}

const browned = (colour: Colour): Colour => [colour[0] * 0.6, colour[1] * 0.5, colour[2] * 0.4];

function palettesFor(spec: PlantSpec, roles: Roles): { palette: Palette; blades: Colour[] } {
  const { greens, blooms, pales } = roles;
  const darkGreens = greens.slice(0, 4);
  switch (spec.kind) {
    case 'blades':
    case 'fern':
    case 'flowers':
      return { palette: { leaves: blooms, bark: darkGreens }, blades: greens };
    case 'mushrooms':
      return { palette: { leaves: blooms, bark: pales }, blades: greens };
    case 'shrub':
    case 'palm':
      return { palette: { leaves: greens, bark: greens.slice(0, 4).map(browned) }, blades: greens };
    case 'cactus':
    case 'barrel':
    case 'culms':
      return { palette: { leaves: greens, bark: darkGreens }, blades: greens };
  }
}

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

function paintBlade(canvas: ObliqueCanvas, frame: Frame, blade: Blade, colours: readonly Colour[], seed: number): void {
  const length = Math.hypot(blade.lean[0], blade.lean[1], blade.height);
  const steps = Math.max(4, Math.ceil(length / 0.5));
  const side = Math.hypot(blade.lean[0], blade.lean[1]) || 1;
  const facing: readonly [number, number] = [(blade.lean[0] / side) * 0.6, (blade.lean[1] / side) * 0.6];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const along = Math.pow(t, 1.7);
    const x = blade.base[0] + blade.lean[0] * along;
    const y = blade.base[1] + blade.lean[1] * along;
    const z = blade.height * (t - blade.droop * t * t * t);
    const envelope = blade.serrate ? 0.4 + 0.5 * Math.sin(Math.PI * (0.08 + 0.84 * t)) : 1 - t * (1 - blade.tip);
    const notch = blade.serrate && step % 2 === 1 ? 0.55 : 1;
    const radius = Math.max(0.5, blade.width * 0.5 * envelope * notch);
    const tone = clamp(0.2 + 0.55 * t + (blade.tone - 0.5) * 0.35);
    const shade = 0.62 + 0.38 * Math.pow(t, 0.6);
    const colour = colours[Math.min(colours.length - 1, Math.round(tone * (colours.length - 1)))]!;
    for (let dz = -radius; dz <= radius; dz += SAMPLE) {
      for (let dy = -radius; dy <= radius; dy += SAMPLE) {
        for (let dx = -radius; dx <= radius; dx += SAMPLE) {
          if (Math.hypot(dx, dy, dz) > radius) continue;
          const noise = hash3(Math.floor((x + dx) * 2), Math.floor((y + dy) * 2), Math.floor((z + dz) * 2), seed);
          const lit = shade * (0.9 + 0.2 * noise);
          canvas.put(frame.footX + x + dx, frame.footY + y + dy, z + dz, colour, lit, FOLIAGE_ALPHA, facing[0] + dx / radius * 0.3, facing[1] + dy / radius * 0.3, 255);
        }
      }
    }
  }
}

export const isPlant = (name: string): boolean => familyOf(name) in PLANT_SPECS;

export function bakePlant(sheets: Sheets, crown: SpriteSheetEntry): Baked {
  const spec = PLANT_SPECS[familyOf(crown.name)]!;
  const radius = crownRadius(sheets, crown);
  const seed = seedOf(crown.name);
  const model = growPlant(spec, radius, seed, roleOf(crown.name));
  let peak = 1;
  for (const blade of model.blades) peak = Math.max(peak, blade.height);
  for (const tuft of model.grown.tufts) peak = Math.max(peak, tuft.at[2] + tuft.up);
  for (const limb of model.grown.limbs) peak = Math.max(peak, limb.to[2], limb.from[2]);
  const frame = frameFor(crown, peak);
  const { palette, blades } = palettesFor(spec, rolesOf(sheets, crown));
  const canvas = new ObliqueCanvas(frame);
  paintGrown(canvas, frame, model.grown, palette, seed);
  for (const blade of model.blades) paintBlade(canvas, frame, blade, blades, seed + 11);
  return canvas.baked();
}
