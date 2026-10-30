import { capsule } from '../../../pixel/field.ts';
import { ITEM_GRUB } from '../../../pixel/palette.ts';
import type { Region } from '../../../pixel/shade.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, polar, SMALL_SIZE } from '../../../pixel/ground/kit.ts';
import type { Piece, Stacked } from '../../../pixel/ground/kit.ts';

const pieceOf: Piece = (at, reach, angle) =>
  [0, 1].map((i) => {
    const across = polar(at, angle + Math.PI / 2, (i - 0.5) * reach * 0.7);
    const near = polar(across, angle, -reach * 0.7);
    const far = polar(across, angle, reach * 0.7);
    return { mask: capsule(near.x, near.y, far.x, far.y, Math.max(0.9, reach * 0.3)), material: material(ITEM_GRUB, 1.2, 0.3, 0.3) };
  });

function small(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const regions: Region[] = [0, 1].map((i) => {
    const angle = variant * 0.7 + i * 1.2;
    const near = polar(foot, angle, -2.4);
    const far = polar(foot, angle, 2.4);
    return { mask: capsule(near.x, near.y + (i - 0.5) * 2.4, far.x, far.y + (i - 0.5) * 2.4, 1.1), material: material(ITEM_GRUB, 1.2, 0.3, 0.3) };
  });
  return piece(SMALL_SIZE, regions, 1);
}

export const sprite: Stacked = { piece: pieceOf, reach: 2.4, height: 2, small };
