import { DECALS, MASKS, TEXTURE, TEXTURES } from '../pixel/ground/index.ts';
import { PRIORITY } from '../pixel/ground/masks.ts';
import { STEPS } from '../pixel/ground/steps.ts';
import { RIDGES, mipsOf } from '../render/groundSprites.ts';
import type { GroundSprites, Variant } from '../render/groundSprites.ts';

/**
 * The drawn ground built straight from the authoring code, for the CLI previews: the same data
 * the game loads from `public/ground`, without a browser to decode the sheets in. Kept beside the
 * loader's rules — a desert texture filed under each ridge it lies along — so the preview paints
 * what the game paints.
 */
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
