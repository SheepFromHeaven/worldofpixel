import { blob, capsule } from '../../../pixel/field.ts';
import { ITEM_CHESTNUT, ITEM_FLINT } from '../../../pixel/palette.ts';
import { cone } from '../../../pixel/shade.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, polar } from '../../../pixel/ground/kit.ts';

function small(variant: number): Standing {
  const size = 20;
  const foot = middle(size);
  const angle = variant * 0.7 - 0.5;
  const butt = polar(foot, angle, -6);
  const neck = polar(foot, angle, 4);
  const head = polar(foot, angle, 5);
  return piece(
    size,
    [
      { mask: capsule(butt.x, butt.y, neck.x, neck.y, 1), material: material(ITEM_CHESTNUT, 1.4, 0.4, 0.3) },
      { mask: blob(head.x, head.y, 2.6, 3.4, 0.2, variant + 9), material: material(ITEM_FLINT, 2, 0.5, 0.2, cone) },
    ],
    3,
  );
}

export const single = small;
