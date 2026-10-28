import type { Baked, Sheets } from '../obliqueCanvas.ts';
import { frameFor, ObliqueCanvas } from '../obliqueCanvas.ts';
import type { SpriteSheetEntry } from '../propPlacementCache.ts';
import { paintGrown } from './paint.ts';
import type { Palette } from './paint.ts';
import { rolesOf } from './plantBake.ts';
import { seedOf } from './random.ts';
import type { Grown, Limb, Tuft } from './types.ts';

const CORNER_REACH = 7;

const CORD_ARM = 3;

const PEBBLES = 14;

const PEBBLE_RING = 7.2;

const STAKE_HEIGHT: Readonly<Record<string, number>> = { 'marker.storage': 5.5, 'marker.plan': 3 };

export const isMarker = (name: string): boolean => name === 'marker.storage' || name === 'marker.plan' || name === 'marker.floor';

function stakes(name: string): Grown {
  const height = STAKE_HEIGHT[name]!;
  const limbs: Limb[] = [];
  const tufts: Tuft[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const x = sx * CORNER_REACH;
      const y = sy * CORNER_REACH;
      limbs.push({ from: [x, y, 0], to: [x, y, height], fromRadius: 0.9, toRadius: 0.7 });
      limbs.push({ from: [x, y, height - 0.6], to: [x - sx * CORD_ARM, y, height * 0.35], fromRadius: 0.45, toRadius: 0.4 });
      limbs.push({ from: [x, y, height - 0.6], to: [x, y - sy * CORD_ARM, height * 0.35], fromRadius: 0.45, toRadius: 0.4 });
      tufts.push({ at: [x, y, height], across: 1, up: 0.8, tone: 0.2, open: 1 });
    }
  }
  return { limbs, tufts, ragged: 0.05, holes: 0, clump: 0, envelope: 0.25, bark: 0 };
}

function pebbles(): Grown {
  const tufts: Tuft[] = [];
  for (let at = 0; at < PEBBLES; at += 1) {
    const angle = (at / PEBBLES) * Math.PI * 2 + 0.2;
    const away = PEBBLE_RING + (at % 3) * 0.3;
    const size = 1.1 + (at % 2) * 0.35;
    tufts.push({ at: [Math.cos(angle) * away, Math.sin(angle) * away, size * 0.55], across: size, up: size * 0.7, tone: 0.5 + (at % 3) * 0.15, open: 1 });
  }
  return { limbs: [], tufts, ragged: 0.1, holes: 0, clump: 0, envelope: 0.25, bark: 0 };
}

export function bakeMarker(sheets: Sheets, crown: SpriteSheetEntry): Baked {
  const grown = crown.name === 'marker.floor' ? pebbles() : stakes(crown.name);
  let peak = 1;
  for (const tuft of grown.tufts) peak = Math.max(peak, tuft.at[2] + tuft.up);
  for (const limb of grown.limbs) peak = Math.max(peak, limb.to[2] + limb.toRadius, limb.from[2] + limb.fromRadius);
  const frame = frameFor(crown, peak);
  const { greens } = rolesOf(sheets, crown);
  const palette: Palette = { leaves: greens, bark: greens.slice(0, Math.max(2, Math.ceil(greens.length / 2))) };
  const canvas = new ObliqueCanvas(frame);
  paintGrown(canvas, frame, grown, palette, seedOf(crown.name));
  return canvas.baked();
}
