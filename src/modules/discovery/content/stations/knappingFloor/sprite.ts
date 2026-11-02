import { blob } from '../../../../../pixel/field.ts';
import { ITEM_LIMESTONE } from '../../../../../pixel/palette.ts';
import type { Region } from '../../../../../pixel/shade.ts';
import type { LitProp, Standing } from '../../../../../pixel/ground/objects.ts';
import { lit } from '../../../../../pixel/ground/objects.ts';
import { material, middle, piece, polar, STILL } from '../../../../../pixel/ground/kit.ts';

function floorRing(): Standing {
  const size = 18;
  const foot = middle(size);
  const regions: Region[] = [];
  const pebbles = 14;
  for (let i = 0; i < pebbles; i += 1) {
    const angle = (i / pebbles) * Math.PI * 2 + 0.2;
    const at = polar(foot, angle, 7.2 + (i % 3) * 0.3);
    regions.push({ mask: blob(at.x, at.y, 0.9 + (i % 2) * 0.3, 0.8, 0.2, 120 + i), material: material(ITEM_LIMESTONE, 1.6, 0.3, 0.2) });
  }
  return piece(size, regions, 1);
}

export const sprites = (): LitProp[] => [
  lit('marker.floor', {}, floorRing(), 1, STILL),
];
