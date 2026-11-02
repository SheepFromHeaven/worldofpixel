import { blob, capsule } from '../../../pixel/field.ts';
import { CHAR, ITEM_CHESTNUT } from '../../../pixel/palette.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, polar, SMALL_SIZE } from '../../../pixel/ground/kit.ts';
import type { Piece, Stacked } from '../../../pixel/ground/kit.ts';

const pieceOf: Piece = (at, reach, angle, seed) => {
  const near = polar(at, angle, -reach);
  const far = polar(at, angle, reach);
  return [
    { mask: capsule(near.x, near.y, far.x, far.y, Math.max(1.1, reach * 0.34)), material: material(ITEM_CHESTNUT, 1.4, 0.5, 0.4) },
    { mask: blob(far.x, far.y, Math.max(1, reach * 0.4), Math.max(1, reach * 0.4), 0.15, seed), material: material(CHAR, 1.2, 0.5, 0.4) },
  ];
};

function small(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const angle = variant * 0.8 + 0.3;
  const near = polar(foot, angle, -3.4);
  const far = polar(foot, angle, 3.4);
  const bark = material(ITEM_CHESTNUT, 1.4, 0.5, 0.4);
  return piece(
    SMALL_SIZE,
    [
      { mask: capsule(near.x, near.y, far.x, far.y, 1.15), material: bark },
      { mask: blob(far.x, far.y, 1.5, 1.5, 0.15, variant * 7 + 5), material: material(CHAR, 1.2, 0.5, 0.4) },
    ],
    2,
  );
}

export const sprite: Stacked = { piece: pieceOf, reach: 3.4, height: 3, small };
