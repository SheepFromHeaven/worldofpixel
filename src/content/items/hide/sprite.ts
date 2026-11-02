import { blob } from '../../../pixel/field.ts';
import { ITEM_CHESTNUT, ITEM_FUR } from '../../../pixel/palette.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import type { Region } from '../../../pixel/shade.ts';
import { cone } from '../../../pixel/shade.ts';
import { material, middle, piece, polar, SMALL_SIZE } from '../../../pixel/ground/kit.ts';
import type { Piece, Stacked } from '../../../pixel/ground/kit.ts';

const pieceOf: Piece = (at, reach, angle, seed) => {
  const left = polar(at, angle + 2.2, reach * 0.55);
  const right = polar(at, angle - 2.2, reach * 0.55);
  const tail = polar(at, angle + Math.PI, reach * 0.8);
  return [
    { mask: blob(at.x, at.y, reach * 1.05, reach * 0.8, 0.2, seed), material: material(ITEM_FUR, 1.2, 0.4, 0.3) },
    { mask: blob(left.x, left.y, reach * 0.4, reach * 0.3, 0.15, seed + 1), material: material(ITEM_FUR, 1, 0.3, 0.3) },
    { mask: blob(right.x, right.y, reach * 0.4, reach * 0.3, 0.15, seed + 2), material: material(ITEM_FUR, 1, 0.3, 0.3) },
    { mask: blob(tail.x, tail.y, reach * 0.3, reach * 0.22, 0.1, seed + 3), material: material(ITEM_CHESTNUT, 1, 0.3, 0.3, cone) },
  ];
};

function small(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const regions: Region[] = pieceOf(foot, 2.6, variant * 0.7, variant * 5 + 2);
  return piece(SMALL_SIZE, regions, 1);
}

export const sprite: Stacked = { piece: pieceOf, reach: 3, height: 2, small };
