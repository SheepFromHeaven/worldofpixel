import { CHAR, STONE, WOOD } from '../../../pixel/palette.ts';
import type { Baked, Sheets } from '../obliqueCanvas.ts';
import { frameFor, ObliqueCanvas } from '../obliqueCanvas.ts';
import type { SpriteSheetEntry } from '../propPlacementCache.ts';
import { paintGrown } from './paint.ts';
import type { Colour, Palette } from './paint.ts';
import { seedOf } from './random.ts';
import type { Grown, Limb, Tuft } from './types.ts';

const STONES = 9;

const STONE_RING = 8.4;

const LOG_REACH = 5.2;

const LOG_APART = 3.1;

const LOG_RADIUS = 1.45;

export const isCampfire = (name: string): boolean => name === 'campfire.base' || name === 'campfire.burnt';

const polar = (angle: number, away: number): readonly [number, number] => [Math.cos(angle) * away, Math.sin(angle) * away];

const colourOf = (packed: number): Colour => [(packed >>> 24) & 0xff, (packed >>> 16) & 0xff, (packed >>> 8) & 0xff];

const log = (limbs: Limb[], along: 'x' | 'y', across: number, z: number, half: number, radius: number): void => {
  const from: [number, number, number] = along === 'x' ? [-half, across, z] : [across, -half, z];
  const to: [number, number, number] = along === 'x' ? [half, across, z] : [across, half, z];
  limbs.push({ from, to, fromRadius: radius, toRadius: radius * 0.94 });
};

function campfireModel(burnt: boolean): Grown {
  const limbs: Limb[] = [];
  const tufts: Tuft[] = [];
  for (let at = 0; at < STONES; at += 1) {
    const [x, y] = polar((at / STONES) * Math.PI * 2 + 0.3, STONE_RING);
    const size = 1.5 + (at % 3) * 0.35;
    tufts.push({ at: [x, y, size * 0.55], across: size, up: size * 0.6, tone: 0.15 + (at % 3) * 0.3, open: 1 });
  }
  tufts.push({ at: [0, 0, 0.3], across: burnt ? 5.2 : 4.6, up: 0.6, tone: 0, open: 1 });
  if (burnt) {
    log(limbs, 'x', -LOG_APART * 0.6, LOG_RADIUS * 0.8, 3.8, LOG_RADIUS * 0.8);
    log(limbs, 'y', LOG_APART * 0.9, LOG_RADIUS * 0.8, 3.2, LOG_RADIUS * 0.75);
    limbs.push({ from: [-2.6, 2.4, 1], to: [1.6, 0.4, 2.6], fromRadius: 0.9, toRadius: 0.8 });
  } else {
    log(limbs, 'x', -LOG_APART, LOG_RADIUS, LOG_REACH, LOG_RADIUS);
    log(limbs, 'x', LOG_APART, LOG_RADIUS, LOG_REACH, LOG_RADIUS);
    log(limbs, 'y', -LOG_APART * 0.55, LOG_RADIUS * 3, LOG_REACH * 0.95, LOG_RADIUS);
    log(limbs, 'y', LOG_APART * 0.55, LOG_RADIUS * 3, LOG_REACH * 0.95, LOG_RADIUS);
  }
  return { limbs, tufts, ragged: 0.12, holes: 0, clump: 0, envelope: 0.15, bark: 0 };
}

export function bakeCampfire(_sheets: Sheets, crown: SpriteSheetEntry): Baked {
  const burnt = crown.name === 'campfire.burnt';
  const grown = campfireModel(burnt);
  let peak = 1;
  for (const tuft of grown.tufts) peak = Math.max(peak, tuft.at[2] + tuft.up);
  for (const limb of grown.limbs) peak = Math.max(peak, limb.to[2] + limb.toRadius, limb.from[2] + limb.fromRadius);
  const frame = frameFor(crown, peak);
  const palette: Palette = { leaves: STONE.slice(0, 6).map(colourOf), bark: (burnt ? CHAR : [CHAR[1]!, ...WOOD]).map(colourOf) };
  const canvas = new ObliqueCanvas(frame);
  paintGrown(canvas, frame, grown, palette, seedOf(crown.name));
  return canvas.baked();
}
