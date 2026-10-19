import type { Vec2 } from './geometry.ts';
import type { CellId, Design, DesignId, Settlement } from './types.ts';

/**
 * The whole of the saved world: a seed, and what has been built on it. Everything else — the
 * terrain, the lattice, where the water runs — is a function of the seed, so there is nothing
 * else to keep.
 */
export interface GameWorld {
  seed: number;
  settlements: Map<string, Settlement>;
  /** The first settlement founded, if any. A new world has none. */
  homeSettlementId: string | null;
  /**
   * Every building the player has drawn, and the hearth. Designs are the saved part of a world
   * along with the seed and what stands on it — there is no catalogue behind them.
   */
  library: Map<DesignId, Design>;
}

export function designOf(world: GameWorld, designId: DesignId): Design | undefined {
  return world.library.get(designId);
}

export function settlementOf(world: GameWorld, settlementId: string): Settlement {
  const settlement = world.settlements.get(settlementId);
  if (!settlement) throw new Error(`unknown settlement ${settlementId}`);
  return settlement;
}

/** Whichever settlement has built on this parcel, if any. */
export function settlementAt(world: GameWorld, parcelId: CellId): Settlement | undefined {
  for (const settlement of world.settlements.values()) {
    if (settlement.roads.has(parcelId)) return settlement;
    for (const building of settlement.buildings.values()) {
      if (building.cellId === parcelId) return settlement;
    }
  }
  return undefined;
}

/** The settlement whose hearth is nearest a point, within reach. */
export function settlementNear(
  world: GameWorld,
  point: Vec2,
  reach: number,
): Settlement | undefined {
  let best: Settlement | undefined;
  let bestGap = reach;

  for (const settlement of world.settlements.values()) {
    const hearth = settlement.buildings.get(settlement.hearthId);
    if (!hearth) continue;
    const gap = Math.hypot(hearth.position.x - point.x, hearth.position.y - point.y);
    if (gap <= bestGap) {
      bestGap = gap;
      best = settlement;
    }
  }

  return best;
}
