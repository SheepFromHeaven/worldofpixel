import type { Baked, Sheets } from '../obliqueCanvas.ts';
import { frameFor, ObliqueCanvas } from '../obliqueCanvas.ts';
import type { SpriteSheetEntry } from '../propPlacementCache.ts';
import { paintGrown } from './paint.ts';
import type { Palette } from './paint.ts';
import { rolesOf } from './plantBake.ts';
import { seedOf } from './random.ts';
import type { Grown, Limb, Tuft } from './types.ts';

export const TORCH_HEIGHT = 16;

const NO_GROWN: Grown = { limbs: [], tufts: [], ragged: 0, holes: 0, clump: 0, envelope: 0.3, bark: 0 };

export const isTorch = (name: string): boolean => name === 'torch.post';

function post(): Grown {
  const limbs: Limb[] = [{ from: [0, 0, 0], to: [0, 0, TORCH_HEIGHT], fromRadius: 1.3, toRadius: 1.05 }];
  const tufts: Tuft[] = [{ at: [0, 0, TORCH_HEIGHT], across: 1.7, up: 1.9, tone: 0.1, open: 1 }];
  return { ...NO_GROWN, limbs, tufts };
}

export function bakeTorch(sheets: Sheets, crown: SpriteSheetEntry): Baked {
  const grown = post();
  let peak = 1;
  for (const tuft of grown.tufts) peak = Math.max(peak, tuft.at[2] + tuft.up);
  for (const limb of grown.limbs) peak = Math.max(peak, limb.to[2]);
  const frame = frameFor(crown, peak);
  const { greens } = rolesOf(sheets, crown);
  const palette: Palette = { leaves: greens.slice(0, 2), bark: greens.slice(1) };
  const canvas = new ObliqueCanvas(frame);
  paintGrown(canvas, frame, grown, palette, seedOf(crown.name));
  return canvas.baked();
}
