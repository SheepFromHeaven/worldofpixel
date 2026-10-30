import { blob } from '../../../pixel/field.ts';
import { ITEM_LIMESTONE } from '../../../pixel/palette.ts';
import { cone } from '../../../pixel/shade.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, SMALL_SIZE } from '../../../pixel/ground/kit.ts';
import type { Piece, Stacked } from '../../../pixel/ground/kit.ts';

const pieceOf: Piece = (at, reach, _angle, seed) => [
  { mask: blob(at.x, at.y, reach, reach * 0.88, 0.3, seed), material: material(ITEM_LIMESTONE, 2.4, 0.4, 0.25, cone) },
];

function small(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const reach = 2.7 + variant * 0.25;
  return piece(SMALL_SIZE, [{ mask: blob(foot.x, foot.y, reach, reach * 0.88, 0.3, variant * 5 + 3), material: material(ITEM_LIMESTONE, 2.4, 0.4, 0.25, cone) }], 3);
}

export const sprite: Stacked = { piece: pieceOf, reach: 2.7, height: 4, small };
