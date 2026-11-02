import { capsule } from '../../../../../pixel/field.ts';
import { CORD, WOOD } from '../../../../../pixel/palette.ts';
import type { Region } from '../../../../../pixel/shade.ts';
import type { LitProp, Standing } from '../../../../../pixel/ground/objects.ts';
import { lit } from '../../../../../pixel/ground/objects.ts';
import { material, middle, piece, STILL } from '../../../../../pixel/ground/kit.ts';

function wall(): Standing {
  const size = 18;
  const foot = middle(size);
  const wood = material(WOOD, 1.6, 0.4, 0.3);
  const cord = material(CORD, 1, 0.2, 0.3);
  const regions: Region[] = [];
  for (let post = -3; post <= 3; post += 1) regions.push({ mask: capsule(foot.x + post * 2.3, foot.y - 6, foot.x + post * 2.3, foot.y + 6, 1.2), material: wood });
  for (const row of [-3, 3]) regions.push({ mask: capsule(foot.x - 7.4, foot.y + row, foot.x + 7.4, foot.y + row, 0.7), material: cord });
  return piece(size, regions, 4);
}

export const sprites = (): LitProp[] => [lit('block.wall', {}, wall(), 1, STILL)];
