import type { Vec2 } from './geometry.ts';
import type { Design, DesignId, Settlement } from './types.ts';

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
  /**
   * How many times villagers have stepped on each node of the ground (`footpaths.ts`). The paths
   * on the map are this, worn in; nobody lays them.
   */
  wear: Map<string, number>;
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
