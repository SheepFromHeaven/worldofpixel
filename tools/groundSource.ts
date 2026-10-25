import { DECALS, MASKS, TEXTURE, TEXTURES } from '../src/pixel/ground/index.ts';
import { PRIORITY } from '../src/pixel/ground/masks.ts';
import { STEPS } from '../src/pixel/ground/steps.ts';
import type { GroundSprites, Variant } from '../src/render/groundSprites.ts';
import { RIDGES, mipsOf } from '../src/render/groundSprites.ts';

export function groundFromSource(): GroundSprites {
  const variants = new Map<string, Variant[]>();
  const add = (key: string, variant: Variant): void => {
    variants.set(key, [...(variants.get(key) ?? []), variant]);
  };
  for (const texture of TEXTURES) {
    const steps = texture.draw();
    const variant = { name: texture.name, mips: mipsOf(new Uint8Array(steps.cells), TEXTURE) };
    if (texture.material === 'desert') {
      for (const ridge of RIDGES) if (!texture.ridge || texture.ridge === ridge) add(`desert:${ridge}`, variant);
    } else {
      add(texture.material, variant);
    }
  }
  return {
    size: TEXTURE,
    steps: STEPS,
    priority: PRIORITY,
    variants,
    masks: new Map(MASKS.map((mask) => [mask.material, mipsOf(mask.cells, TEXTURE)])),
    decals: DECALS.map((decal) => ({ ...decal })),
  };
}
