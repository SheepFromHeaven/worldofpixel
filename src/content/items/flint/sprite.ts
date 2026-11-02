import { blob } from '../../../pixel/field.ts';
import { ITEM_FLINT } from '../../../pixel/palette.ts';
import { cone } from '../../../pixel/shade.ts';
import type { Region } from '../../../pixel/shade.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, polar, SMALL_SIZE } from '../../../pixel/ground/kit.ts';
import type { Piece, Stacked } from '../../../pixel/ground/kit.ts';

const pieceOf: Piece = (at, reach, angle, seed) => {
  const side = polar(at, angle, reach * 0.45);
  return [
    { mask: blob(at.x, at.y, reach * 1.25, reach * 0.8, 0.22, seed), material: material(ITEM_FLINT, 2, 0.5, 0.2, cone) },
    { mask: blob(side.x, side.y, reach * 0.8, reach * 0.55, 0.22, seed + 1), material: material(ITEM_FLINT, 2, 0.5, 0.2, cone) },
  ];
};

function small(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const turn = variant * 1.3;
  const regions: Region[] = [0, 1].map((i) => {
    const at = polar(foot, turn + i * Math.PI, i === 0 ? 0.9 : 1.2);
    const reach = 1.7 + ((variant + i) % 3) * 0.25;
    return { mask: blob(at.x, at.y, reach * 1.25, reach * 0.8, 0.22, variant * 11 + i), material: material(ITEM_FLINT, 2, 0.5, 0.2, cone) };
  });
  return piece(SMALL_SIZE, regions, 2);
}

export const sprite: Stacked = { piece: pieceOf, reach: 1.9, height: 3, small };
