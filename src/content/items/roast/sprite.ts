import { blob } from '../../../pixel/field.ts';
import { ITEM_CHESTNUT, ITEM_EGG } from '../../../pixel/palette.ts';
import { cone } from '../../../pixel/shade.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, SMALL_SIZE } from '../../../pixel/ground/kit.ts';
import type { Piece, Stacked } from '../../../pixel/ground/kit.ts';

const pieceOf: Piece = (at, reach, _angle, seed) => [
  { mask: blob(at.x, at.y, reach * 0.8, reach * 0.95, 0.12, seed), material: material(ITEM_CHESTNUT, 1.6, 0.4, 0.3, cone) },
  { mask: blob(at.x - 0.6, at.y - 0.7, reach * 0.3, reach * 0.35, 0.05, seed + 1), material: material(ITEM_EGG, 1, 0.2, 0.2) },
];

function small(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  return piece(
    SMALL_SIZE,
    [
      { mask: blob(foot.x, foot.y, 2.4, 2.9, 0.12, variant * 3 + 5), material: material(ITEM_CHESTNUT, 1.6, 0.4, 0.3, cone) },
      { mask: blob(foot.x - 0.6, foot.y - 0.7, 0.9, 1.1, 0.05, variant + 1), material: material(ITEM_EGG, 1, 0.2, 0.2) },
    ],
    2,
  );
}

export const sprite: Stacked = { piece: pieceOf, reach: 2.8, height: 3, small };
