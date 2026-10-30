import { capsule } from '../../../pixel/field.ts';
import { ITEM_CHESTNUT } from '../../../pixel/palette.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, polar, SMALL_SIZE } from '../../../pixel/ground/kit.ts';
import type { Piece, Stacked } from '../../../pixel/ground/kit.ts';

const pieceOf: Piece = (at, reach, angle) => {
  const near = polar(at, angle, -reach);
  const far = polar(at, angle, reach);
  const joint = polar(at, angle, reach * 0.15);
  const twig = polar(joint, angle + 0.9, reach * 0.7);
  const bark = material(ITEM_CHESTNUT, 1.4, 0.5, 0.4);
  return [
    { mask: capsule(near.x, near.y, far.x, far.y, Math.max(1.1, reach * 0.34)), material: bark },
    { mask: capsule(joint.x, joint.y, twig.x, twig.y, Math.max(0.85, reach * 0.24)), material: bark },
  ];
};

function small(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const angle = variant * 0.8 + 0.3;
  const near = polar(foot, angle, -3.4);
  const far = polar(foot, angle, 3.4);
  const joint = polar(foot, angle, 0.6);
  const twig = polar(joint, angle + 0.9, 2.4);
  const bark = material(ITEM_CHESTNUT, 1.4, 0.5, 0.4);
  return piece(
    SMALL_SIZE,
    [
      { mask: capsule(near.x, near.y, far.x, far.y, 1.15), material: bark },
      { mask: capsule(joint.x, joint.y, twig.x, twig.y, 0.85), material: bark },
    ],
    2,
  );
}

export const sprite: Stacked = { piece: pieceOf, reach: 3.4, height: 3, small };
