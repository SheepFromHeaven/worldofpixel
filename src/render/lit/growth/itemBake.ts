import type { Baked, Sheets } from '../obliqueCanvas.ts';
import { frameFor, ObliqueCanvas } from '../obliqueCanvas.ts';
import type { SpriteSheetEntry } from '../propPlacementCache.ts';
import { paintGrown } from './paint.ts';
import type { Palette } from './paint.ts';
import { rolesOf } from './plantBake.ts';
import { seedOf } from './random.ts';
import { HELD_LIFT_TEXELS } from '../treeView.ts';
import type { Grown } from './types.ts';
import type { Parts } from './itemParts.ts';
import { polar } from './itemParts.ts';
import { ITEM_MODELS } from '../../../content/items/art.ts';

const ITEM_NAME = /^item\.([a-z]+)\.(?:s(\d)|held)$/;

const PIECES_PER_STAGE: readonly number[] = [1, 5, 9, 14, 20];

const HEAP_RADIUS = 6.2;

const SPIRAL = 2.39996;

const SINGLE_ANGLE = 0.4;

export const isItem = (name: string): boolean => {
  const match = ITEM_NAME.exec(name);
  return match !== null && ITEM_MODELS[match[1]!] !== undefined;
};

function itemModel(name: string): Grown {
  const [, kind, stageText] = ITEM_NAME.exec(name)!;
  const parts: Parts = { limbs: [], tufts: [] };
  const stage = stageText === undefined ? 0 : Number(stageText);
  const model = ITEM_MODELS[kind!]!;
  if (model.single) {
    model.single(parts);
  } else {
    const { reach } = model;
    const piece = model.piece!;
    const count = PIECES_PER_STAGE[stage]!;
    if (count === 1) {
      piece(parts, [0, 0], reach, SINGLE_ANGLE);
    } else {
      const spacing = Math.min(reach * 1.7, (HEAP_RADIUS * 1.15) / Math.sqrt(count));
      for (let at = 0; at < count; at += 1) piece(parts, polar([0, 0], at * SPIRAL + stage, spacing * Math.sqrt(at + 0.5)), reach, at * 1.7 + stage);
    }
  }
  const lift = stageText === undefined ? HELD_LIFT_TEXELS : 0;
  if (lift > 0) {
    for (const limb of parts.limbs) {
      limb.from = [limb.from[0], limb.from[1], limb.from[2] + lift];
      limb.to = [limb.to[0], limb.to[1], limb.to[2] + lift];
    }
    for (const tuft of parts.tufts) tuft.at = [tuft.at[0], tuft.at[1], tuft.at[2] + lift];
  }
  return { limbs: parts.limbs, tufts: parts.tufts, ragged: 0.1, holes: 0, clump: 0, envelope: 0.25, bark: 0 };
}

export function bakeItem(sheets: Sheets, crown: SpriteSheetEntry): Baked {
  const grown = itemModel(crown.name);
  let peak = 1;
  for (const tuft of grown.tufts) peak = Math.max(peak, tuft.at[2] + tuft.up);
  for (const limb of grown.limbs) peak = Math.max(peak, limb.to[2] + limb.toRadius, limb.from[2] + limb.fromRadius);
  const frame = frameFor(crown, peak);
  const { greens } = rolesOf(sheets, crown);
  const palette: Palette = { leaves: greens, bark: greens.slice(1) };
  const canvas = new ObliqueCanvas(frame);
  paintGrown(canvas, frame, grown, palette, seedOf(crown.name));
  return canvas.baked();
}
