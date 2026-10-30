import { blob, capsule } from '../../../pixel/field.ts';
import { CHAR, ITEM_STRAW, CORD, WOOD } from '../../../pixel/palette.ts';
import type { Region } from '../../../pixel/shade.ts';
import type { LitProp, Standing } from '../../../pixel/ground/objects.ts';
import { lit } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, polar, STILL } from '../../../pixel/ground/kit.ts';

function hut(): Standing {
  const size = 30;
  const foot = middle(size);
  const regions: Region[] = [{ mask: blob(foot.x, foot.y + 1.5, 10.4, 8.6, 0.1, 71), material: material(WOOD, 1.6, 0.4, 0.3) }];
  regions.push({ mask: blob(foot.x, foot.y - 0.8, 10, 8.2, 0.14, 73), material: material(ITEM_STRAW, 2.4, 0.6, 0.35) });
  regions.push({ mask: blob(foot.x, foot.y - 2.4, 6, 4.6, 0.2, 75), material: material(ITEM_STRAW, 1.6, 0.4, 0.3) });
  for (let i = 0; i < 6; i += 1) {
    const at = polar(foot, (i / 6) * Math.PI * 2 + 0.2, 8.6);
    regions.push({ mask: capsule(at.x, at.y - 1, foot.x, foot.y - 5.6, 0.8), material: material(CORD, 1, 0.2, 0.3) });
  }
  regions.push({ mask: blob(foot.x, foot.y + 6.2, 2.6, 2.8, 0.1, 79), material: material(CHAR, 1, 0.2, 0.3) });
  return piece(size, regions, 3);
}

export const sprites = (): LitProp[] => [
  lit('structure.hut', {}, hut(), 1, STILL),
];
