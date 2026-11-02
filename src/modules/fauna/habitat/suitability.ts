import { BIOLOGIES } from '../../lives.manifest.generated.ts';
import { LIVES } from '../life.ts';
import type { Habitat, Life, TileBase } from '../vocabulary.ts';

export { Kind } from '../vocabulary.ts';

export interface TileHabitat extends TileBase {
  readonly samples: readonly unknown[];
}

const HABITATS: readonly Habitat<unknown>[] = BIOLOGIES.map((biology) => biology.habitat as unknown as Habitat<unknown>);

const SLOT_OF_GROUP = new Map(BIOLOGIES.map((biology, slot) => [biology.group, slot]));

const SLOTS = Int8Array.from(LIVES, (life) => SLOT_OF_GROUP.get(life.group) ?? -1);

export const habitatsInUse = (): readonly Habitat<unknown>[] => HABITATS;

export function stageSuitability(life: Life, stage: number, tile: TileHabitat): number {
  const slot = SLOTS[life.index]!;
  return slot < 0 ? 0 : HABITATS[slot]!.suitability(life, stage, tile.samples[slot], tile);
}
