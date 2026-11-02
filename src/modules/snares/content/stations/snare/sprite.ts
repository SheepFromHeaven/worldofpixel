import { blob, capsule } from '../../../../../pixel/field.ts';
import { ITEM_CHESTNUT, WOOD } from '../../../../../pixel/palette.ts';
import type { Region } from '../../../../../pixel/shade.ts';
import type { LitProp, Standing } from '../../../../../pixel/ground/objects.ts';
import { lit } from '../../../../../pixel/ground/objects.ts';
import { material, middle, piece, polar, STILL } from '../../../../../pixel/ground/kit.ts';

function snare(): Standing {
  const size = 18;
  const foot = middle(size);
  const cord = material(ITEM_CHESTNUT, 1, 0.3, 0.3);
  const regions: Region[] = [];
  for (let i = 0; i < 10; i += 1) {
    const a = polar(foot, (i / 10) * Math.PI * 2, 3.8);
    const b = polar(foot, ((i + 1) / 10) * Math.PI * 2, 3.8);
    regions.push({ mask: capsule(a.x, a.y, b.x, b.y, 0.55), material: cord });
  }
  regions.push({ mask: capsule(foot.x + 3.8, foot.y, foot.x + 7.4, foot.y - 2.8, 0.7), material: material(WOOD, 1.2, 0.3, 0.3) });
  regions.push({ mask: blob(foot.x + 7.4, foot.y - 2.8, 1.1, 1.1, 0.1, 83), material: material(WOOD, 1.2, 0.3, 0.3) });
  return piece(size, regions, 1);
}

export const sprites = (): LitProp[] => [
  lit('structure.snare', {}, snare(), 1, STILL),
];
