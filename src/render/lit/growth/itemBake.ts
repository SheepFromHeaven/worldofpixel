import type { Baked, Sheets } from '../obliqueCanvas.ts';
import { frameFor, ObliqueCanvas } from '../obliqueCanvas.ts';
import type { SpriteSheetEntry } from '../propPlacementCache.ts';
import { paintGrown } from './paint.ts';
import type { Palette } from './paint.ts';
import { rolesOf } from './plantBake.ts';
import { seedOf } from './random.ts';
import { HELD_LIFT_TEXELS } from '../treeView.ts';
import type { Grown, Limb, Tuft } from './types.ts';

const ITEM_NAME = /^item\.([a-z]+)\.(?:s(\d)|held)$/;

const PIECES_PER_STAGE: readonly number[] = [1, 5, 9, 14, 20];

const HEAP_RADIUS = 6.2;

const SPIRAL = 2.39996;

const SINGLE_ANGLE = 0.4;

const REACH: Readonly<Record<string, number>> = { flint: 1.9, stone: 2.7, kindling: 3, branch: 3.4, torch: 3.4 };

export const isItem = (name: string): boolean => ITEM_NAME.test(name);

type Spot = readonly [number, number];

interface Parts {
  limbs: Limb[];
  tufts: Tuft[];
}

const polar = (from: Spot, angle: number, away: number): Spot => [from[0] + Math.cos(angle) * away, from[1] + Math.sin(angle) * away];

const stick = (parts: Parts, near: Spot, far: Spot, radius: number, lift = 0.4): void => {
  parts.limbs.push({ from: [near[0], near[1], radius], to: [far[0], far[1], radius + lift], fromRadius: radius, toRadius: radius * 0.9 });
};

function flint(parts: Parts, at: Spot, reach: number, angle: number): void {
  const side = polar(at, angle, reach * 0.45);
  parts.tufts.push({ at: [at[0], at[1], reach * 0.6], across: reach * 1.2, up: reach * 0.65, tone: 0.35, open: 1 });
  parts.tufts.push({ at: [side[0], side[1], reach * 0.5], across: reach * 0.8, up: reach * 0.5, tone: 0.5, open: 1 });
}

function stone(parts: Parts, at: Spot, reach: number): void {
  parts.tufts.push({ at: [at[0], at[1], reach * 0.7], across: reach * 0.95, up: reach * 0.75, tone: 0.5, open: 1 });
}

function kindling(parts: Parts, at: Spot, reach: number, angle: number): void {
  const across = Math.max(0.85, reach * 0.25);
  for (const offset of [-1, 0, 1]) {
    const base = polar(at, angle + Math.PI / 2, offset * reach * 0.6);
    stick(parts, polar(base, angle, -reach), polar(base, angle, reach), across, offset === 0 ? 1.1 : 0.3);
  }
}

function branch(parts: Parts, at: Spot, reach: number, angle: number): void {
  const radius = Math.max(1.1, reach * 0.34);
  const joint = polar(at, angle, reach * 0.15);
  const twig = polar(joint, angle + 0.9, reach * 0.7);
  stick(parts, polar(at, angle, -reach), polar(at, angle, reach), radius, 0.5);
  parts.limbs.push({ from: [joint[0], joint[1], radius], to: [twig[0], twig[1], radius + reach * 0.4], fromRadius: Math.max(0.85, reach * 0.24), toRadius: 0.6 });
}

function torch(parts: Parts, at: Spot, reach: number, angle: number): void {
  const far = polar(at, angle, reach);
  stick(parts, polar(at, angle, -reach), far, Math.max(1.1, reach * 0.34), 0.5);
  parts.tufts.push({ at: [far[0], far[1], Math.max(1.1, reach * 0.34) + 0.5], across: 1.7, up: 1.6, tone: 0.05, open: 1 });
}

function axe(parts: Parts): void {
  const angle = -0.5;
  const butt = polar([0, 0], angle, -6);
  const neck = polar([0, 0], angle, 4);
  const head = polar([0, 0], angle, 5);
  parts.limbs.push({ from: [butt[0], butt[1], 1], to: [neck[0], neck[1], 1.5], fromRadius: 1, toRadius: 1 });
  parts.tufts.push({ at: [head[0], head[1], 2], across: 2.6, up: 2.2, tone: 0.1, open: 1 });
}

function piece(kind: string, parts: Parts, at: Spot, reach: number, angle: number): void {
  if (kind === 'flint') flint(parts, at, reach, angle);
  else if (kind === 'stone') stone(parts, at, reach);
  else if (kind === 'kindling') kindling(parts, at, reach, angle);
  else if (kind === 'branch') branch(parts, at, reach, angle);
  else torch(parts, at, reach, angle);
}

function itemModel(name: string): Grown {
  const [, kind, stageText] = ITEM_NAME.exec(name)!;
  const parts: Parts = { limbs: [], tufts: [] };
  const stage = stageText === undefined ? 0 : Number(stageText);
  if (kind === 'axe') {
    axe(parts);
  } else {
    const reach = REACH[kind!] ?? 2;
    const count = PIECES_PER_STAGE[stage]!;
    if (count === 1) {
      piece(kind!, parts, [0, 0], reach, SINGLE_ANGLE);
    } else {
      const spacing = Math.min(reach * 1.7, (HEAP_RADIUS * 1.15) / Math.sqrt(count));
      for (let at = 0; at < count; at += 1) piece(kind!, parts, polar([0, 0], at * SPIRAL + stage, spacing * Math.sqrt(at + 0.5)), reach, at * 1.7 + stage);
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
