import { capsule } from '../../../pixel/field.ts';
import { ITEM_CHESTNUT } from '../../../pixel/palette.ts';
import type { Region } from '../../../pixel/shade.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, polar, SMALL_SIZE } from '../../../pixel/ground/kit.ts';
import type { Piece, Stacked } from '../../../pixel/ground/kit.ts';

const pieceOf: Piece = (at, reach, angle) =>
  [-1, 0, 1].map((offset, i) => {
    const near = polar(polar(at, angle + Math.PI / 2, offset * reach * 0.3), angle + i * 0.4, -reach);
    const far = polar(polar(at, angle + Math.PI / 2, offset * reach * 0.3), angle - i * 0.3, reach);
    return { mask: capsule(near.x, near.y, far.x, far.y, Math.max(0.7, reach * 0.2)), material: material(ITEM_CHESTNUT, 1, 0.3, 0.3) };
  });

function small(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const regions: Region[] = [0, 1, 2].map((i) => {
    const angle = variant * 0.5 + i * 1.05;
    const near = polar(foot, angle, -2.6);
    const far = polar(foot, angle, 2.6);
    return { mask: capsule(near.x, near.y, far.x, far.y, 0.7), material: material(ITEM_CHESTNUT, 1, 0.3, 0.3) };
  });
  return piece(SMALL_SIZE, regions, 1);
}

export const sprite: Stacked = { piece: pieceOf, reach: 3, height: 2, small };
