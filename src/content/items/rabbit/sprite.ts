import { blob } from '../../../pixel/field.ts';
import { ITEM_FUR } from '../../../pixel/palette.ts';
import { cone } from '../../../pixel/shade.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, polar, SMALL_SIZE } from '../../../pixel/ground/kit.ts';
import type { Piece, Stacked } from '../../../pixel/ground/kit.ts';

const pieceOf: Piece = (at, reach, angle, seed) => {
  const ear = polar(at, angle - 1.2, reach * 0.9);
  return [
    { mask: blob(at.x, at.y, reach * 1, reach * 0.8, 0.12, seed), material: material(ITEM_FUR, 1.6, 0.4, 0.3, cone) },
    { mask: blob(ear.x, ear.y, reach * 0.38, reach * 0.28, 0.1, seed + 2), material: material(ITEM_FUR, 1, 0.2, 0.2) },
  ];
};

function small(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const ear = polar(foot, variant * 0.5 - 1.2, 2.6);
  return piece(
    SMALL_SIZE,
    [
      { mask: blob(foot.x, foot.y, 2.8, 2.2, 0.12, variant * 3 + 7), material: material(ITEM_FUR, 1.6, 0.4, 0.3, cone) },
      { mask: blob(ear.x, ear.y, 1.1, 0.8, 0.1, variant + 2), material: material(ITEM_FUR, 1, 0.2, 0.2) },
    ],
    2,
  );
}

export const sprite: Stacked = { piece: pieceOf, reach: 3, height: 3, small };
