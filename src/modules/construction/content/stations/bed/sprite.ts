import { blob, capsule } from '../../../../../pixel/field.ts';
import { ITEM_STRAW, ITEM_FIBRE, WOOD } from '../../../../../pixel/palette.ts';
import type { Region } from '../../../../../pixel/shade.ts';
import type { LitProp, Standing } from '../../../../../pixel/ground/objects.ts';
import { lit } from '../../../../../pixel/ground/objects.ts';
import { material, middle, piece, STILL } from '../../../../../pixel/ground/kit.ts';

function bed(): Standing {
  const size = 22;
  const foot = middle(size);
  const wood = material(WOOD, 1.4, 0.4, 0.3);
  const regions: Region[] = [];
  for (const sy of [-1, 1]) regions.push({ mask: capsule(foot.x - 8, foot.y + sy * 4.6, foot.x + 8, foot.y + sy * 4.6, 1.1), material: wood });
  for (const sx of [-1, 1]) regions.push({ mask: capsule(foot.x + sx * 7.6, foot.y - 4.6, foot.x + sx * 7.6, foot.y + 4.6, 1.1), material: wood });
  regions.push({ mask: blob(foot.x, foot.y, 7.2, 4.2, 0.18, 61), material: material(ITEM_FIBRE, 2.2, 0.5, 0.3) });
  regions.push({ mask: blob(foot.x - 4.6, foot.y, 2, 2.6, 0.2, 63), material: material(ITEM_STRAW, 1.4, 0.3, 0.2) });
  return piece(size, regions, 1);
}

export const sprites = (): LitProp[] => [
  lit('structure.bed', {}, bed(), 1, STILL),
];
