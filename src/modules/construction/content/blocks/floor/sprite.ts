import { capsule } from '../../../../../pixel/field.ts';
import { WOOD } from '../../../../../pixel/palette.ts';
import type { Region } from '../../../../../pixel/shade.ts';
import type { LitProp, Standing } from '../../../../../pixel/ground/objects.ts';
import { lit } from '../../../../../pixel/ground/objects.ts';
import { material, middle, piece, STILL } from '../../../../../pixel/ground/kit.ts';

function floor(): Standing {
  const size = 18;
  const foot = middle(size);
  const wood = material(WOOD, 1.2, 0.4, 0.3);
  const regions: Region[] = [];
  for (let row = -3; row <= 3; row += 1) regions.push({ mask: capsule(foot.x - 7.2, foot.y + row * 2.3, foot.x + 7.2, foot.y + row * 2.3, 1), material: wood });
  return piece(size, regions, 1);
}

export const sprites = (): LitProp[] => [lit('block.floor', {}, floor(), 1, STILL)];
