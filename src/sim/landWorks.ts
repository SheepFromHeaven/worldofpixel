import { hashString } from './rng.ts';
import { ItemType } from './types.ts';
import { Biome } from './types.ts';
import type { Design, DesignId, ItemType as Item } from './types.ts';

export interface LandWork {
  item: Item;
  design: Design;
  batch: number;
  ticks: number;
  pool?: readonly { item: Item; chance: number }[];
  pools?: readonly (readonly { item: Item; chance: number }[])[];
  where?: readonly Biome[];
}

function landWork(
  id: DesignId,
  label: string,
  item: Item,
  batch: number,
  ticks: number,
  pool?: readonly { item: Item; chance: number }[],
  where?: readonly Biome[],
  pools?: readonly (readonly { item: Item; chance: number }[])[],
): LandWork {
  const first = pool ?? pools?.[0];
  return {
    item,
    batch,
    ticks,
    ...(first ? { pool: first } : {}),
    ...(pools ? { pools } : {}),
    ...(where ? { where } : {}),
    design: {
      id,
      label,
      capacity: Math.max(8, batch),
    },
  };
}

export const LAND_WORKS: readonly LandWork[] = [
  landWork('well', 'Well', ItemType.Water, 1, 50),
  landWork('digging', 'Dig site', ItemType.Dirt, 5, 100),
  landWork('woodcutter', 'Woodcutter', ItemType.Wood, 10, 150),
  landWork('forage-camp', 'Forage camp', ItemType.Deadwood, 4, 140, undefined, undefined, [
    [
      { item: ItemType.Deadwood, chance: 0.5 },
      { item: ItemType.Stone, chance: 0.5 },
    ],
    [
      { item: ItemType.Berries, chance: 0.2 },
      { item: ItemType.Fibre, chance: 0.7 },
    ],
  ]),
  landWork('bank-dig', 'Bank dig', ItemType.Mud, 4, 110),
  landWork('clay-pit', 'Clay pit', ItemType.Clay, 3, 120),
  landWork('reed-bed', 'Reed bed', ItemType.Fibre, 4, 100, undefined, [Biome.Marsh]),
  landWork('fibre-patch', 'Fibre patch', ItemType.Fibre, 2, 140, undefined, [
    Biome.Meadow,
    Biome.Forest,
    Biome.Highland,
    Biome.Tundra,
    Biome.Desert,
  ]),
];

export function workServes(work: LandWork, biome: Biome, items: readonly Item[]): boolean {
  if (work.pool) return true;
  return items.includes(work.item) && (!work.where || work.where.includes(biome));
}

export function landWorkById(id: DesignId): LandWork | undefined {
  return LAND_WORKS.find((work) => work.design.id === id);
}

export function poolOf(work: LandWork, recipe = 0): readonly { item: Item; chance: number }[] | undefined {
  return work.pools?.[recipe] ?? work.pool;
}

export function drawFromPool(work: LandWork, buildingId: string, tick: number, unit: number, recipe = 0): Item | null {
  const pool = poolOf(work, recipe);
  if (!pool) return work.item;
  const roll = (hashString(`${buildingId}:${tick}:${unit}`) % 10000) / 10000;
  let edge = 0;
  for (const entry of pool) {
    edge += entry.chance;
    if (roll < edge) return entry.item;
  }
  return null;
}
