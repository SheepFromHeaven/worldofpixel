import { blob } from '../../../pixel/field.ts';
import { ITEM_BERRY } from '../../../pixel/palette.ts';
import { cone } from '../../../pixel/shade.ts';
import type { Region } from '../../../pixel/shade.ts';
import type { Standing } from '../../../pixel/ground/objects.ts';
import { material, middle, piece, polar, SMALL_SIZE } from '../../../pixel/ground/kit.ts';
import type { Piece, Stacked } from '../../../pixel/ground/kit.ts';

const pieceOf: Piece = (at, reach, angle, seed) =>
  [0, 1, 2].map((i) => {
    const place = polar(at, angle + i * 2.1, reach * 0.4);
    return { mask: blob(place.x, place.y, reach * 0.5, reach * 0.48, 0.12, seed + i), material: material(ITEM_BERRY, 1.6, 0.4, 0.3, cone) };
  });

function small(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const regions: Region[] = [0, 1, 2].map((i) => {
    const at = polar(foot, variant * 0.9 + i * 2.1, 1.3);
    return { mask: blob(at.x, at.y, 1.5, 1.45, 0.12, variant * 7 + i), material: material(ITEM_BERRY, 1.6, 0.4, 0.3, cone) };
  });
  return piece(SMALL_SIZE, regions, 2);
}

export const sprite: Stacked = { piece: pieceOf, reach: 2.4, height: 2, small };
