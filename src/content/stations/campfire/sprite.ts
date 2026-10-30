import { blob, capsule } from '../../../pixel/field.ts';
import { CHAR, FIRE, STONE, WOOD } from '../../../pixel/palette.ts';
import type { Region } from '../../../pixel/shade.ts';
import type { LitProp, Standing } from '../../../pixel/ground/objects.ts';
import { lit } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, polar, STILL, GLOW } from '../../../pixel/ground/kit.ts';

function hearth(): Standing {
  const size = 24;
  const foot = middle(size);
  const regions: Region[] = [
    { mask: blob(foot.x, foot.y, 6.2, 6.2, 0.1, 31), material: material(CHAR, 0.8, 0.3, 0.4) },
  ];
  for (let i = 0; i < 9; i += 1) {
    const at = polar(foot, (i / 9) * Math.PI * 2 + 0.3, 7.4);
    regions.push({ mask: blob(at.x, at.y, 1.9, 1.7, 0.2, 41 + i), material: material(STONE, 2, 0.5, 0.3) });
  }
  for (let i = 0; i < 3; i += 1) {
    const angle = 0.4 + i * 2.1;
    const near = polar(foot, angle, -4.4);
    const far = polar(foot, angle, 4.4);
    regions.push({ mask: capsule(near.x, near.y, far.x, far.y, 1.1), material: material(WOOD, 1.4, 0.5, 0.4) });
  }
  return piece(size, regions, 3);
}

function burnt(): Standing {
  const size = 24;
  const foot = middle(size);
  const regions: Region[] = [
    { mask: blob(foot.x, foot.y, 6.4, 6.4, 0.2, 33), material: material(STONE, 0.8, 0.3, 0.4) },
    { mask: blob(foot.x, foot.y, 4.4, 4.2, 0.3, 35), material: material(CHAR, 0.8, 0.3, 0.4) },
  ];
  for (let i = 0; i < 9; i += 1) {
    const at = polar(foot, (i / 9) * Math.PI * 2 + 0.3, 7.4);
    regions.push({ mask: blob(at.x, at.y, 1.9, 1.7, 0.2, 41 + i), material: material(STONE, 2, 0.5, 0.3) });
  }
  for (let i = 0; i < 3; i += 1) {
    const angle = 0.9 + i * 2.1;
    const near = polar(foot, angle, -4.2);
    const far = polar(foot, angle, 4.2);
    regions.push({ mask: capsule(near.x, near.y, far.x, far.y, 1), material: material(CHAR, 0.6, 0.4, 0.4) });
  }
  return piece(size, regions, 2);
}

const FLAME_SCALE = [0.38, 0.58, 0.8, 1, 1.28] as const;

const FLAME_BODY = [1, 1, 2, 2, 3] as const;

const FLAME_LEAN = [2, 3, 3, 4, 5] as const;

const FLAME_CORE = [4, 5, 6, 7, 7] as const;

const FLAME_SPARKS = [0, 0, 2, 3, 3] as const;

function blaze(frame: number, tier: number): Standing {
  const size = 16;
  const foot = middle(size);
  const grow = FLAME_SCALE[tier]!;
  const lean = polar(foot, frame * 1.9, 0.9 * grow);
  const regions: Region[] = [
    { mask: blob(foot.x, foot.y, (4.6 + (frame % 2) * 0.5) * grow, (4.2 + (frame % 3) * 0.3) * grow, 0.3, 61 + frame), material: material([FIRE[FLAME_BODY[tier]!]!], 0.5, 0, 0) },
    { mask: blob(lean.x, lean.y, 3.2 * grow, 3 * grow, 0.3, 67 + frame), material: material([FIRE[FLAME_LEAN[tier]!]!], 0.5, 0, 0) },
    { mask: blob(foot.x, foot.y, 1.8 * grow, 1.8 * grow, 0.3, 71 + frame), material: material([FIRE[FLAME_CORE[tier]!]!], 0.5, 0, 0) },
  ];
  for (let i = 0; i < FLAME_SPARKS[tier]!; i += 1) {
    const at = polar(foot, frame * 1.3 + i * 2.2, Math.min(6.4, 5.6 * grow) + ((frame + i) % 2) * 0.8);
    regions.push({ mask: blob(at.x, at.y, 0.6, 0.6, 0.1, 80 + i), material: material([FIRE[5]!], 0.4, 0, 0) });
  }
  return piece(size, regions, 4);
}

export const sprites = (): LitProp[] => [
  lit('campfire.base', {}, hearth(), 1, STILL),
  lit('campfire.burnt', {}, burnt(), 1, STILL),
  ...Array.from({ length: FLAME_SCALE.length }, (_, tier) => Array.from({ length: 4 }, (_, frame) => lit(`campfire.flame.${tier}.${frame}`, {}, blaze(frame, tier), 1, GLOW))).flat(),
];
