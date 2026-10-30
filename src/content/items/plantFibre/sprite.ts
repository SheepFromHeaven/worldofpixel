import { capsule } from '../../../pixel/field.ts';
import { ITEM_FIBRE } from '../../../pixel/palette.ts';
import type { Region } from '../../../pixel/shade.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, polar, SMALL_SIZE } from '../../../pixel/ground/kit.ts';
import type { Piece, Stacked } from '../../../pixel/ground/kit.ts';

const pieceOf: Piece = (at, reach, angle) =>
  [-1.5, -0.5, 0.5, 1.5].map((offset, i) => {
    const across = polar(at, angle + Math.PI / 2, offset * reach * 0.35);
    const near = polar(across, angle, -reach);
    const far = polar(across, angle + (i % 2 === 0 ? 0.25 : -0.25), reach);
    return { mask: capsule(near.x, near.y, far.x, far.y, Math.max(0.7, reach * 0.18)), material: material(ITEM_FIBRE, 1, 0.3, 0.3) };
  });

function small(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const regions: Region[] = Array.from({ length: 4 }, (_, i) => {
    const angle = variant * 0.6 + i * 0.35;
    const near = polar(foot, angle, -3.2);
    const mid = polar(foot, angle + 0.5 * (i % 2 === 0 ? 1 : -1), 0.4);
    return { mask: capsule(near.x, near.y + (i - 1.5) * 1.3, mid.x, mid.y + (i - 1.5) * 1.3, 0.7), material: material(ITEM_FIBRE, 1, 0.3, 0.3) };
  });
  return piece(SMALL_SIZE, regions, 1);
}

export const sprite: Stacked = { piece: pieceOf, reach: 3, height: 2, small };
