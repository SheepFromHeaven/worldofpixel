import { blob, capsule } from '../../../pixel/field.ts';
import { CHAR, ITEM_CHESTNUT, ITEM_FUR, WOOD } from '../../../pixel/palette.ts';
import type { LitProp, Standing } from '../../../pixel/ground/objects.ts';
import { lit } from '../../../pixel/ground/objects.ts';
import type { Region } from '../../../pixel/shade.ts';
import { material, middle, piece, polar, STILL } from '../../../pixel/ground/kit.ts';

function tipi(): Standing {
  const size = 30;
  const foot = middle(size);
  const top = { x: foot.x, y: foot.y - 7 };
  const regions: Region[] = [
    { mask: blob(foot.x, foot.y + 1.8, 11, 8.8, 0.08, 91), material: material(ITEM_CHESTNUT, 1.6, 0.4, 0.3) },
    { mask: blob(foot.x, foot.y - 0.4, 10.2, 8.2, 0.12, 93), material: material(ITEM_FUR, 2.4, 0.6, 0.35) },
    { mask: blob(foot.x, foot.y - 2.8, 6.2, 4.8, 0.2, 95), material: material(ITEM_FUR, 1.6, 0.4, 0.3) },
  ];
  for (let i = 0; i < 7; i += 1) {
    const at = polar(foot, (i / 7) * Math.PI * 2 + 0.3, 9.4);
    regions.push({ mask: capsule(at.x, at.y - 0.6, top.x, top.y, 0.7), material: material(WOOD, 1.2, 0.3, 0.3) });
  }
  regions.push({ mask: blob(top.x, top.y - 0.6, 1.5, 1.2, 0.1, 97), material: material(CHAR, 1, 0.2, 0.3) });
  regions.push({ mask: blob(foot.x, foot.y + 6.6, 2.3, 3, 0.1, 99), material: material(CHAR, 1, 0.2, 0.3) });
  return piece(size, regions, 3);
}

export const sprites = (): LitProp[] => [lit('structure.tipi', {}, tipi(), 1, STILL)];
