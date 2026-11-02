import { blob, capsule } from '../../../pixel/field.ts';
import { ITEM_FISH } from '../../../pixel/palette.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, polar, SMALL_SIZE } from '../../../pixel/ground/kit.ts';
import type { Piece, Stacked } from '../../../pixel/ground/kit.ts';

const pieceOf: Piece = (at, reach, angle, seed) => {
  const near = polar(at, angle, -reach * 0.7);
  const far = polar(at, angle, reach * 0.7);
  const tail = polar(at, angle, -reach * 1.05);
  return [
    { mask: capsule(near.x, near.y, far.x, far.y, Math.max(0.9, reach * 0.34)), material: material(ITEM_FISH, 1.4, 0.3, 0.3) },
    { mask: blob(tail.x, tail.y, reach * 0.3, reach * 0.38, 0.1, seed), material: material(ITEM_FISH, 1, 0.2, 0.2) },
  ];
};

function small(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const near = polar(foot, variant * 0.6, -2.4);
  const far = polar(foot, variant * 0.6, 2.4);
  const tail = polar(foot, variant * 0.6, -3.4);
  return piece(
    SMALL_SIZE,
    [
      { mask: capsule(near.x, near.y, far.x, far.y, 1.2), material: material(ITEM_FISH, 1.4, 0.3, 0.3) },
      { mask: blob(tail.x, tail.y, 1, 1.3, 0.1, variant + 4), material: material(ITEM_FISH, 1, 0.2, 0.2) },
    ],
    1,
  );
}

export const sprite: Stacked = { piece: pieceOf, reach: 3, height: 2, small };
