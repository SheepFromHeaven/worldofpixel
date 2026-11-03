import { Biome } from '../../sim/types.ts';
import { Cover } from '../../sim/covers.ts';
import type { TileIndex } from '../../sim/grid.ts';
import type { World } from '../../sim/world.ts';
import { ItemType } from './items.ts';

export const Environment = {
  Meadow: 0,
  Scrub: 1,
  Thicket: 2,
  Woodland: 3,
  Deadfall: 4,
  Bare: 5,
  Stony: 6,
} as const;

export type Environment = (typeof Environment)[keyof typeof Environment];

export interface Drop {
  readonly kind: ItemType;
  readonly weight: number;
  readonly cap: number;
}

export interface ForageTable {
  readonly nothing: number;
  readonly drops: readonly Drop[];
}

const STONY_BIOMES: ReadonlySet<number> = new Set([Biome.Highland, Biome.Rock, Biome.Karst, Biome.Volcanic, Biome.Badlands]);

export function evaluate(world: World, tile: TileIndex): Environment | null {
  switch (world.coverOf(tile)) {
    case Cover.Grass:
      return Environment.Meadow;
    case Cover.Scrub:
      return Environment.Scrub;
    case Cover.Bush:
      return Environment.Thicket;
    case Cover.Tree:
      return Environment.Woodland;
    case Cover.Fallen:
      return Environment.Deadfall;
    case Cover.Bare:
      return STONY_BIOMES.has(world.biome[tile]!) ? Environment.Stony : Environment.Bare;
    default:
      return null;
  }
}

const drop = (kind: ItemType, weight: number, cap: number): Drop => ({ kind, weight, cap });

export const FORAGE: Readonly<Record<Environment, ForageTable>> = {
  [Environment.Meadow]: { nothing: 27, drops: [drop(ItemType.PlantFibre, 55, 8), drop(ItemType.DryKindling, 8, 3), drop(ItemType.Stone, 8, 3), drop(ItemType.Flint, 2, 3)] },
  [Environment.Scrub]: { nothing: 20, drops: [drop(ItemType.Branch, 40, 8), drop(ItemType.PlantFibre, 22, 8), drop(ItemType.DryKindling, 6, 3), drop(ItemType.Stone, 10, 3), drop(ItemType.Flint, 2, 3)] },
  [Environment.Thicket]: { nothing: 18, drops: [drop(ItemType.Branch, 36, 8), drop(ItemType.PlantFibre, 32, 8), drop(ItemType.DryKindling, 4, 3), drop(ItemType.Stone, 8, 3), drop(ItemType.Flint, 2, 3)] },
  [Environment.Woodland]: { nothing: 25, drops: [drop(ItemType.Branch, 62, 8), drop(ItemType.Stone, 10, 3), drop(ItemType.Flint, 3, 3)] },
  [Environment.Deadfall]: { nothing: 14, drops: [drop(ItemType.Branch, 72, 8), drop(ItemType.DryKindling, 4, 3), drop(ItemType.Stone, 8, 3), drop(ItemType.Flint, 2, 3)] },
  [Environment.Bare]: { nothing: 20, drops: [drop(ItemType.Stone, 60, 3), drop(ItemType.Flint, 20, 3)] },
  [Environment.Stony]: { nothing: 10, drops: [drop(ItemType.Stone, 62, 3), drop(ItemType.Flint, 28, 3)] },
};

export function roll(environment: Environment, random: () => number, loose: (kind: ItemType) => number): ItemType {
  const { nothing, drops } = FORAGE[environment];
  const open = drops.filter((entry) => loose(entry.kind) < entry.cap);
  let pick = random() * (nothing + open.reduce((sum, entry) => sum + entry.weight, 0));
  for (const entry of open) {
    pick -= entry.weight;
    if (pick < 0) return entry.kind;
  }
  return ItemType.None;
}
