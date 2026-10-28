import type { Frame } from '../obliqueCanvas.ts';
import { ObliqueCanvas, WOOD_ALPHA } from '../obliqueCanvas.ts';
import { hash3 } from './random.ts';
import type { Grown, Limb, Tuft } from './types.ts';
import { between, distance, unit } from './vec.ts';
import type { Vec3 } from './vec.ts';

export type Colour = readonly [number, number, number];

export interface Palette {
  leaves: readonly Colour[];
  bark: readonly Colour[];
}

const SAMPLE = 0.5;
const LOBE = 2;
const FOLIAGE_ALPHA = 255;
const OCCLUSION_REACH = 2.2;
const OCCLUSION_WEIGHT = 0.6;
const OCCLUSION_DARKEST = 0.62;
const BARK_FLOOR = 0.25;

const pick = (palette: readonly Colour[], level: number): Colour => palette[Math.min(palette.length - 1, Math.max(0, Math.round(level * (palette.length - 1))))]!;

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

function occlusionAt(grown: Grown, at: Vec3): number {
  let covered = 0;
  for (const tuft of grown.tufts) {
    const above = tuft.at[2] - at[2];
    const gap = Math.hypot(tuft.at[0] - at[0], tuft.at[1] - at[1], above > 0 ? above * 0.6 : above * 1.5);
    covered += Math.max(0, 1 - gap / (tuft.across * OCCLUSION_REACH));
  }
  return Math.min(1, covered * OCCLUSION_WEIGHT);
}

function paintLimb(canvas: ObliqueCanvas, frame: Frame, grown: Grown, limb: Limb, palette: Palette, seed: number): void {
  const thinnest = Math.max(0.5, Math.min(limb.fromRadius, limb.toRadius));
  const steps = Math.max(1, Math.ceil(distance(limb.from, limb.to) / Math.max(0.5, thinnest * 0.5)));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const centre = between(limb.from, limb.to, t);
    const radius = Math.max(0.6, limb.fromRadius + (limb.toRadius - limb.fromRadius) * t);
    const covered = 1 - (1 - OCCLUSION_DARKEST) * occlusionAt(grown, centre);
    for (let dz = -radius; dz <= radius; dz += SAMPLE) {
      for (let dy = -radius; dy <= radius; dy += SAMPLE) {
        for (let dx = -radius; dx <= radius; dx += SAMPLE) {
          const reach = Math.hypot(dx, dy, dz);
          if (reach > radius) continue;
          const nx = dx / radius;
          const ny = dy / radius;
          const nz = dz / radius;
          const noise = hash3(Math.floor((centre[0] + dx) * 2), Math.floor((centre[1] + dy) * 2), Math.floor((centre[2] + dz) * 2), seed);
          const tone = clamp(BARK_FLOOR + 0.45 * (nz * 0.5 + 0.5) + 0.2 * (0.5 - nx * 0.5) + (noise - 0.5) * 0.3) * Math.min(1, 0.35 + radius * 0.4);
          canvas.put(frame.footX + centre[0] + dx, frame.footY + centre[1] + dy, centre[2] + dz, pick(palette.bark, tone), covered, WOOD_ALPHA, nx, ny, 255, true);
        }
      }
    }
  }
}

interface Crown {
  centre: Vec3;
  extent: number;
  bottom: number;
  top: number;
}

function crownOf(grown: Grown): Crown {
  let x = 0;
  let y = 0;
  let z = 0;
  let bottom = Infinity;
  let top = -Infinity;
  for (const tuft of grown.tufts) {
    x += tuft.at[0];
    y += tuft.at[1];
    z += tuft.at[2];
    bottom = Math.min(bottom, tuft.at[2]);
    top = Math.max(top, tuft.at[2] + tuft.up);
  }
  const count = Math.max(1, grown.tufts.length);
  const centre: Vec3 = [x / count, y / count, z / count];
  let extent = 1;
  for (const tuft of grown.tufts) extent = Math.max(extent, distance(tuft.at, centre) + tuft.across);
  return { centre, extent, bottom, top };
}

function paintTuft(canvas: ObliqueCanvas, frame: Frame, grown: Grown, crown: Crown, tuft: Tuft, palette: Palette, seed: number): void {
  const { across, up } = tuft;
  for (let dz = -up; dz <= up; dz += SAMPLE) {
    for (let dy = -across; dy <= across; dy += SAMPLE) {
      for (let dx = -across; dx <= across; dx += SAMPLE) {
        const nx = dx / across;
        const ny = dy / across;
        const nz = dz / up;
        const reach = Math.hypot(nx, ny, nz);
        if (reach > 1) continue;
        const px = tuft.at[0] + dx;
        const py = tuft.at[1] + dy;
        const pz = tuft.at[2] + dz;
        const noise = hash3(Math.floor(px * 2), Math.floor(py * 2), Math.floor(pz * 2), seed);
        if (reach > 1 - grown.ragged * (1 - noise)) continue;
        if (grown.clump > 0 && reach > 1 - grown.clump * (1 - hash3(Math.floor(px / LOBE), Math.floor(py / LOBE), Math.floor(pz / LOBE), seed + 3))) continue;
        if (reach < 0.75 && hash3(Math.floor(px * 2), Math.floor(py * 2), Math.floor(pz * 2), seed + 1) < grown.holes) continue;
        const along = reach > 1e-3 ? 1 / reach : 0;
        const away = unit([px - crown.centre[0], py - crown.centre[1], (pz - crown.centre[2]) * 1.4]);
        const own = unit([nx * along, ny * along, nz * along]);
        const blend = grown.envelope;
        const normal = unit([own[0] + (away[0] - own[0]) * blend, own[1] + (away[1] - own[1]) * blend, own[2] + (away[2] - own[2]) * blend]);
        const height = clamp((pz - crown.bottom) / (crown.top - crown.bottom || 1));
        const crownTone = 0.15 + 0.5 * height + 0.3 * (normal[2] * 0.5 + 0.5);
        const base = tuft.tone + (crownTone - tuft.tone) * blend;
        const tone = clamp(base + 0.3 * own[2] * (1 - blend) + (noise - 0.5) * 0.45);
        const shade = (0.6 + 0.4 * tuft.open) * (0.84 + 0.16 * reach);
        canvas.put(frame.footX + px, frame.footY + py, pz, pick(palette.leaves, tone), shade, FOLIAGE_ALPHA, normal[0], normal[1], 255);
      }
    }
  }
}

export function paintGrown(canvas: ObliqueCanvas, frame: Frame, grown: Grown, palette: Palette, seed: number): void {
  const crown = crownOf(grown);
  for (const limb of grown.limbs) paintLimb(canvas, frame, grown, limb, palette, seed);
  for (const tuft of grown.tufts) paintTuft(canvas, frame, grown, crown, tuft, palette, seed + 7);
}
