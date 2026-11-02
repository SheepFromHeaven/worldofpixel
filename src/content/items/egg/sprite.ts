import { blob } from '../../../pixel/field.ts';
import { ITEM_EGG } from '../../../pixel/palette.ts';
import { cone } from '../../../pixel/shade.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, SMALL_SIZE } from '../../../pixel/ground/kit.ts';
import type { Piece, Stacked } from '../../../pixel/ground/kit.ts';

const pieceOf: Piece = (at, reach, _angle, seed) => [{ mask: blob(at.x, at.y, reach * 0.7, reach * 0.9, 0.08, seed), material: material(ITEM_EGG, 1.6, 0.3, 0.2, cone) }];

function small(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  return piece(SMALL_SIZE, [{ mask: blob(foot.x, foot.y, 2.1, 2.7, 0.08, variant * 3 + 1), material: material(ITEM_EGG, 1.6, 0.3, 0.2, cone) }], 2);
}

export const sprite: Stacked = { piece: pieceOf, reach: 2.6, height: 2, small };
