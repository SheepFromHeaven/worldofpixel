import { hashString } from './rng.ts';
import { give } from './stock.ts';
import type { Building, Design, DesignId, ItemType as Item } from './types.ts';
import { Biome, ItemType } from './types.ts';

export interface Find {
  item: Item;
  chance: number;
}

export type Pool = readonly Find[];

export abstract class LandWork {
  readonly item: Item;
  readonly design: Design;
  readonly batch: number;
  readonly ticks: number;
  readonly where?: readonly Biome[];

  constructor(id: DesignId, label: string, item: Item, batch: number, ticks: number, where?: readonly Biome[]) {
    this.item = item;
    this.batch = batch;
    this.ticks = ticks;
    if (where) this.where = where;
    this.design = { id, label, capacity: Math.max(8, batch) };
  }

  abstract readonly pooled: boolean;

  get choices(): number {
    return 1;
  }

  get pools(): readonly Pool[] {
    return [];
  }

  abstract permits(yields: readonly Item[], item: Item): boolean;

  abstract serves(biome: Biome, yields: readonly Item[]): boolean;

  abstract finds(which?: number): readonly Item[];

  abstract draw(buildingId: string, tick: number, unit: number, which?: number): Item | null;

  deposit(site: Building, item: Item): boolean {
    if (!this.permits(site.yields, item)) return false;
    if (give(site, item, 1) === 0) return false;
    site.producedTotal += 1;
    return true;
  }
}

export class GroundWork extends LandWork {
  readonly pooled = false;

  permits(yields: readonly Item[], item: Item): boolean {
    return yields.includes(item);
  }

  serves(biome: Biome, yields: readonly Item[]): boolean {
    return this.permits(yields, this.item) && (!this.where || this.where.includes(biome));
  }

  finds(): readonly Item[] {
    return [this.item];
  }

  draw(): Item | null {
    return this.item;
  }
}

export class PoolWork extends LandWork {
  readonly pooled = true;
  private readonly all: readonly Pool[];

  constructor(id: DesignId, label: string, batch: number, ticks: number, pools: readonly Pool[]) {
    super(id, label, pools[0]?.[0]?.item ?? ItemType.Deadwood, batch, ticks);
    this.all = pools;
  }

  override get choices(): number {
    return this.all.length;
  }

  override get pools(): readonly Pool[] {
    return this.all;
  }

  permits(): boolean {
    return true;
  }

  serves(): boolean {
    return true;
  }

  pool(which = 0): Pool {
    return this.all[which] ?? this.all[0] ?? [];
  }

  finds(which = 0): readonly Item[] {
    return this.pool(which).map((entry) => entry.item);
  }

  draw(buildingId: string, tick: number, unit: number, which = 0): Item | null {
    const roll = (hashString(`${buildingId}:${tick}:${unit}`) % 10000) / 10000;
    let edge = 0;
    for (const entry of this.pool(which)) {
      edge += entry.chance;
      if (roll < edge) return entry.item;
    }
    return null;
  }
}

export const LAND_WORKS: readonly LandWork[] = [
  new GroundWork('well', 'Well', ItemType.Water, 1, 50),
  new GroundWork('digging', 'Dig site', ItemType.Dirt, 5, 100),
  new GroundWork('woodcutter', 'Woodcutter', ItemType.Wood, 10, 150),
  new PoolWork('forage-camp', 'Forage camp', 4, 140, [
    [
      { item: ItemType.Deadwood, chance: 0.5 },
      { item: ItemType.Stone, chance: 0.5 },
    ],
    [
      { item: ItemType.Berries, chance: 0.2 },
      { item: ItemType.Fibre, chance: 0.7 },
    ],
  ]),
  new GroundWork('bank-dig', 'Bank dig', ItemType.Mud, 4, 110),
  new GroundWork('clay-pit', 'Clay pit', ItemType.Clay, 3, 120),
  new GroundWork('reed-bed', 'Reed bed', ItemType.Fibre, 4, 100, [Biome.Marsh]),
  new GroundWork('fibre-patch', 'Fibre patch', ItemType.Fibre, 2, 140, [
    Biome.Meadow,
    Biome.Forest,
    Biome.Highland,
    Biome.Tundra,
    Biome.Desert,
  ]),
];

export function landWorkById(id: DesignId): LandWork | undefined {
  return LAND_WORKS.find((work) => work.design.id === id);
}
