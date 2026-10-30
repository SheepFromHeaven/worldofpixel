import { blob } from '../../../pixel/field.ts';
import { CHAR, ITEM_STRAW } from '../../../pixel/palette.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, SMALL_SIZE } from '../../../pixel/ground/kit.ts';
import type { Piece, Stacked } from '../../../pixel/ground/kit.ts';

const pieceOf: Piece = (at, reach, _angle, seed) => [
  { mask: blob(at.x, at.y, reach * 1.1, reach * 0.9, 0.14, seed), material: material(ITEM_STRAW, 1.6, 0.4, 0.3) },
  { mask: blob(at.x, at.y - 0.4, reach * 0.65, reach * 0.5, 0.1, seed + 3), material: material(CHAR, 1.2, 0.5, 0.4) },
];

function small(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  return piece(
    SMALL_SIZE,
    [
      { mask: blob(foot.x, foot.y, 3.4, 2.7, 0.14, variant * 5 + 2), material: material(ITEM_STRAW, 1.6, 0.4, 0.3) },
      { mask: blob(foot.x, foot.y - 0.4, 2, 1.5, 0.1, variant * 5 + 9), material: material(CHAR, 1.2, 0.5, 0.4) },
    ],
    2,
  );
}

export const sprite: Stacked = { piece: pieceOf, reach: 3, height: 3, small };
