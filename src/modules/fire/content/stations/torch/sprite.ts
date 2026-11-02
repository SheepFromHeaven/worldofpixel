import { blob } from '../../../../../pixel/field.ts';
import { noise } from '../../../../../pixel/field.ts';
import { CHAR, FIRE, STONE, WOOD } from '../../../../../pixel/palette.ts';
import type { LitProp, Standing, Traits } from '../../../../../pixel/ground/objects.ts';
import { lit } from '../../../../../pixel/ground/objects.ts';
import type { Region } from '../../../../../pixel/shade.ts';
import { dome } from '../../../../../pixel/shade.ts';
import { material, middle, piece, polar, STILL } from '../../../../../pixel/ground/kit.ts';

const FLAME: Traits = { sway: 0, canopy: false, bend: false, emit: true };

function post(seed: number, size = 9): Standing {
  const foot = middle(size);
  const regions: Region[] = [];
  const stones = 5;
  for (let i = 0; i < stones; i += 1) {
    const at = polar(foot, (i / stones) * Math.PI * 2 + noise(seed, i) * 0.4, 2.6);
    regions.push({ mask: blob(at.x, at.y, 1, 0.9, 0.2, seed + i), material: { ramp: STONE, profile: dome, relief: 1, ambient: 0.08, contrast: 0.8, speckle: 0.3, grit: 0.5 } });
  }
  regions.push(
    { mask: blob(foot.x, foot.y, 1.9, 1.9, 0.1, seed + 9), material: material([CHAR[1]!], 0.5, 0.4, 0.3) },
    { mask: blob(foot.x, foot.y, 1, 1, 0.08, seed + 10), material: material(WOOD.slice(1, 4), 0.8, 0.5, 0.3) },
  );
  return piece(size, regions, 2);
}

function flame(seed: number, frame: number, size = 9): Standing {
  const foot = middle(size);
  const turn = noise(seed, frame) * Math.PI * 2;
  const regions: Region[] = [
    { mask: blob(foot.x, foot.y, 1.8 + noise(seed, frame + 3) * 0.4, 1.8 + noise(seed, frame + 5) * 0.4, 0.35, seed + frame * 17), material: material([FIRE[2]!], 0.5, 0, 0) },
    { mask: blob(foot.x, foot.y, 1.2 + noise(seed, frame + 7) * 0.3, 1.2 + noise(seed, frame + 9) * 0.3, 0.3, seed + frame * 19), material: material([FIRE[4]!], 0.5, 0, 0) },
    { mask: blob(foot.x, foot.y, 0.7, 0.7, 0.3, seed + frame * 23), material: material([FIRE[7]!], 0.5, 0, 0) },
  ];
  for (let i = 0; i < 2; i += 1) {
    const at = polar(foot, turn + i * 3.1 + noise(seed, frame * 7 + i), 2.7 + noise(seed, frame * 5 + i + 20) * 0.8);
    regions.push({ mask: blob(at.x, at.y, 0.45, 0.45, 0.1, seed + i), material: material([FIRE[5]!], 0.4, 0, 0) });
  }
  return piece(size, regions, 3);
}

export const sprites = (): LitProp[] => [
  lit('torch.post', {}, post(5), 1, STILL),
  ...Array.from({ length: 4 }, (_, frame) => lit(`torch.flame.${frame}`, {}, flame(11, frame), 1, FLAME)),
];
