import { capsule } from '../../../pixel/field.ts';
import { ITEM_STRAW } from '../../../pixel/palette.ts';
import type { Region } from '../../../pixel/shade.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, polar, SMALL_SIZE } from '../../../pixel/ground/kit.ts';
import type { Piece, Stacked } from '../../../pixel/ground/kit.ts';

const pieceOf: Piece = (at, reach, angle) =>
  [-1, 0, 1].map((offset, i) => {
    const across = polar(at, angle + Math.PI / 2, offset * reach * 0.6);
    const near = polar(across, angle, -reach);
    const far = polar(across, angle, reach);
    return { mask: capsule(near.x, near.y, far.x, far.y, Math.max(0.85, reach * 0.25 + i * 0.02)), material: material(ITEM_STRAW, 1, 0.3, 0.3) };
  });

function small(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const regions: Region[] = Array.from({ length: 3 }, (_, i) => {
    const angle = variant * 0.7 + i * 0.5;
    const near = polar(foot, angle, -3);
    const far = polar(foot, angle, 3);
    return { mask: capsule(near.x, near.y + (i - 1) * 1.8, far.x, far.y + (i - 1) * 1.8, 0.85), material: material(ITEM_STRAW, 1, 0.3, 0.3) };
  });
  return piece(SMALL_SIZE, regions, 1);
}

export const sprite: Stacked = { piece: pieceOf, reach: 3, height: 2, small };
